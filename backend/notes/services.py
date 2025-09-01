import os
import gc
import psutil
import PyPDF2
from PIL import Image
import google.generativeai as genai
from django.conf import settings
from .models import Note, Translation
from .cancellation import cancellation_registry
from .thread_manager import thread_manager, check_cancellation


class NoteService:
    """Service for handling note operations"""
    
    def __init__(self):
        self.setup_gemini()
        self.current_note_id = None  # Track which note is being processed
    
    def log_memory_usage(self, stage=""):
        """Log current memory usage to help with debugging"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            print(f"Memory usage {stage}: {memory_mb:.1f} MB")
            return memory_mb
        except Exception as e:
            print(f"Could not log memory usage: {e}")
            return 0
    
    def check_memory_limit(self, limit_mb=500):
        """Check if memory usage is within safe limits"""
        try:
            memory_mb = self.log_memory_usage("memory check")
            if memory_mb > limit_mb:
                print(f"⚠️  Memory usage {memory_mb:.1f} MB exceeds limit {limit_mb} MB")
                return False
            return True
        except Exception as e:
            print(f"Could not check memory limit: {e}")
            return True  # Allow processing if we can't check
    
    def check_cancelled(self):
        """Check if processing has been cancelled"""
        if self.current_note_id and cancellation_registry.is_cancelled(self.current_note_id):
            print(f"🛑 Processing cancelled by user for note {self.current_note_id}")
            raise Exception("Processing cancelled by user")
        return False
    
    def set_current_note(self, note_id: str):
        """Set the current note being processed"""
        self.current_note_id = note_id
        cancellation_registry.register_note(note_id)
        print(f"📝 NoteService now processing note {note_id}")
    
    def clear_current_note(self):
        """Clear the current note and unregister from processing"""
        if self.current_note_id:
            cancellation_registry.unregister_note(self.current_note_id)
            print(f"📝 NoteService finished processing note {self.current_note_id}")
            self.current_note_id = None
    
    def get_optimal_batch_size(self, file_size_mb, page_count):
        """Calculate optimal batch size based on file size and page count - Railway Hobby plan has 8GB RAM"""
        if file_size_mb > 50:  # Very large files
            return 5  # Increased from 3
        elif file_size_mb > 20:  # Large files
            return 6  # Increased from 4
        elif file_size_mb > 10:  # Medium files
            return 8  # Increased from 5
        else:  # Small files
            return min(12, page_count)  # Increased from 8
    
    def setup_gemini(self):
        """Initialize AI service"""
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
    
    def extract_text_from_pdf(self, file_path):
        """Extract text from PDF file with better formatting preservation"""
        print(f"Starting PDF text extraction from: {file_path}")
        
        # Try AI Vision first for better formatting preservation
        try:
            print("Attempting AI Vision extraction for better formatting...")
            result = self.extract_text_from_pdf_with_vision(file_path)
            print(f"AI Vision extraction successful, content length: {len(result) if result else 0}")
            return result
        except Exception as vision_error:
            print(f"AI Vision extraction failed: {str(vision_error)}")
            
            # Fallback to PyPDF2 if AI Vision fails
            try:
                print("Falling back to PyPDF2 extraction...")
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text() + "\n\n"
                    result = text.strip()
                    print(f"PyPDF2 extraction successful, content length: {len(result)}")
                    return result
            except Exception as basic_error:
                print(f"PyPDF2 fallback also failed: {str(basic_error)}")
                raise Exception(f"Error extracting text from PDF: AI Vision failed: {str(vision_error)}. PyPDF2 also failed: {str(basic_error)}")
    
    def extract_text_from_pdf_with_vision(self, file_path):
        """Extract text from PDF using AI Vision API for better formatting"""
        try:
            import fitz  # PyMuPDF for converting PDF to images
            from PIL import Image
            import io
            import json
            
            print(f"Opening PDF file: {file_path}")
            # Convert PDF to images
            doc = fitz.open(file_path)
            print(f"PDF has {len(doc)} pages")
            pages_data = []
            
            # Function to process a single page
            def process_page(page_data):
                page_num, page = page_data
                print(f"Processing page {page_num + 1}/{len(doc)}")
                
                # Check if processing has been cancelled
                if self.cancelled:
                    print(f"🛑 Processing cancelled while processing page {page_num + 1}")
                    return page_num, {
                        'page_number': page_num + 1,
                        'content': f"[Processing cancelled]"
                    }
                
                try:
                    # Convert page to image (no zoom to keep it simple)
                    pix = page.get_pixmap()
                    img_data = pix.tobytes("png")
                    img = Image.open(io.BytesIO(img_data))
                    
                    # Use AI Vision to extract text with proper sentence formatting
                    model = genai.GenerativeModel('gemini-2.5-flash')
                    response = model.generate_content([
                        """Extract all text from this PDF page and format it as proper, readable text.

CRITICAL FORMATTING RULES:
1. **Preserve complete sentences** - do not break sentences into individual words
2. **Maintain paragraph structure** - keep paragraphs together with proper spacing
3. **Preserve punctuation** - maintain periods, commas, and other punctuation
4. **Keep proper spacing** - use single spaces between words, double line breaks between paragraphs
5. **Maintain text flow** - ensure text reads naturally as continuous prose
6. **Preserve formatting** - keep headings, lists, and emphasis as they appear
7. **Do not split words** - keep words together within sentences

IMPORTANT: Return the text as it would appear in a well-formatted document, with complete sentences and proper paragraph breaks. Do not return individual words on separate lines.

Extract the text maintaining proper sentence structure and formatting:""",
                        img
                    ])
                    
                    # Handle different response formats
                    try:
                        page_text = response.text
                    except Exception as text_error:
                        print(f"Error accessing response.text for page {page_num + 1}: {text_error}")
                        # Try alternative access methods
                        if hasattr(response, 'parts') and response.parts:
                            page_text = response.parts[0].text
                        elif hasattr(response, 'candidates') and response.candidates:
                            page_text = response.candidates[0].content.parts[0].text
                        else:
                            raise Exception(f"Could not extract text from response: {text_error}")
                    
                    page_text = page_text if page_text else ""
                    print(f"✅ Page {page_num + 1} processed successfully ({len(page_text)} characters)")
                    
                    # Clean up memory after processing each page
                    del img, pix, img_data, response
                    gc.collect()
                    
                    return page_num, {
                        'page_number': page_num + 1,
                        'content': page_text
                    }
                    
                except Exception as e:
                    print(f"❌ Page {page_num + 1} processing failed: {e}")
                    return page_num, {
                        'page_number': page_num + 1,
                        'content': f"[Error processing page {page_num + 1}: {str(e)}]"
                    }
            
            # Process pages in smaller batches to manage memory better
            from concurrent.futures import ThreadPoolExecutor, as_completed
            import time
            
            print(f"Starting batch processing of {len(doc)} pages...")
            self.log_memory_usage("before batch processing")
            start_time = time.time()
            
            # Calculate optimal batch size based on file size
            file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            batch_size = self.get_optimal_batch_size(file_size_mb, len(doc))
            print(f"File size: {file_size_mb:.1f} MB, using batch size: {batch_size}")
            pages_data = []
            
            # Create thread manager executor for this note
            note_id = getattr(self, 'current_note_id', 'unknown')
            executor = thread_manager.create_executor(note_id, max_workers=2)
            
            for batch_start in range(0, len(doc), batch_size):
                # Check if processing has been cancelled
                if check_cancellation(note_id):
                    print(f"🛑 Processing cancelled for note {note_id}, stopping batch processing")
                    break
                
                batch_end = min(batch_start + batch_size, len(doc))
                print(f"Processing batch {batch_start//batch_size + 1}/{(len(doc) + batch_size - 1)//batch_size} (pages {batch_start + 1}-{batch_end})")
                
                # Check memory before processing batch - Railway Hobby plan has 8GB RAM
                if not self.check_memory_limit(1500):  # 1.5GB limit for Railway
                    print(f"⚠️  Memory limit exceeded, forcing cleanup before batch {batch_start//batch_size + 1}")
                    gc.collect()
                    time.sleep(1)  # Give system time to free memory
                    
                    # If still high memory, reduce batch size for remaining batches
                    if batch_start + batch_size < len(doc):
                        old_batch_size = batch_size
                        batch_size = max(2, batch_size // 2)  # Reduce batch size but keep at least 2
                        print(f"⚠️  Reduced batch size from {old_batch_size} to {batch_size} due to memory pressure")
                
                batch_pages = []
                
                # Submit batch pages for processing using thread manager
                futures = []
                for page_num in range(batch_start, batch_end):
                    if check_cancellation(note_id):
                        print(f"🛑 Processing cancelled for note {note_id}, stopping page submission")
                        break
                    
                    future = thread_manager.submit_task(note_id, process_page, (page_num, doc.load_page(page_num)))
                    if future:
                        futures.append(future)
                
                # Collect batch results
                for future in futures:
                    if check_cancellation(note_id):
                        print(f"🛑 Processing cancelled for note {note_id}, stopping result collection")
                        break
                    
                    try:
                        page_num, page_data = future.result(timeout=30)  # 30 second timeout per page
                        batch_pages.append(page_data)
                        print(f"✅ Completed page {page_data['page_number']}")
                    except Exception as e:
                        print(f"❌ Page processing failed: {e}")
                
                # Check if processing has been cancelled after batch
                if check_cancellation(note_id):
                    print(f"🛑 Processing cancelled for note {note_id}, stopping batch processing")
                    break
                
                # Add batch results to main list
                pages_data.extend(batch_pages)
                
                # Force memory cleanup after each batch
                gc.collect()
                self.log_memory_usage(f"after batch {batch_start//batch_size + 1}")
            
            end_time = time.time()
            print(f"Batch processing completed in {end_time - start_time:.2f} seconds")
            self.log_memory_usage("after batch processing")
            
            # Sort pages by page number
            pages_data.sort(key=lambda x: x['page_number'])
            
            doc.close()
            
            # Store pages data as JSON in the content field
            result = json.dumps(pages_data)
            
            # Final memory cleanup
            del pages_data, doc
            gc.collect()
            self.log_memory_usage("after final cleanup")
            
            return result
            
        except ImportError:
            # If PyMuPDF is not available, fall back to basic extraction
            raise Exception("PyMuPDF not available for advanced PDF processing")
        except Exception as e:
            raise Exception(f"Error extracting text from PDF with vision: {str(e)}")
    
    def extract_text_from_image(self, file_path):
        """Extract text from image using AI Vision with formatting preservation"""
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            image = Image.open(file_path)
            response = model.generate_content([
                "Extract all text from this image. Preserve the original formatting, structure, headings, bullet points, and layout as much as possible. Use markdown formatting to represent the structure (use # for headings, - for bullet points, etc.). Return only the extracted text with markdown formatting.",
                image
            ])
            return response.text
        except Exception as e:
            raise Exception(f"Error extracting text from image: {str(e)}")
    
    def process_uploaded_file(self, note):
        """Process uploaded file and extract content"""
        print(f"Processing uploaded file for note {note.id}")
        
        # Set this note as the current one being processed
        self.set_current_note(str(note.id))
        
        self.log_memory_usage("before file processing")
        
        # Check if processing has been cancelled
        self.check_cancelled()
        
        # Check initial memory state - Railway Hobby plan has 8GB RAM
        if not self.check_memory_limit(1000):  # 1GB initial limit for Railway
            print("⚠️  High memory usage detected at start, forcing cleanup")
            gc.collect()
        
        if not note.file:
            print("No file attached to note")
            return note.content
        
        file_path = note.file.path
        print(f"File path: {file_path}")
        print(f"File type: {note.file_type}")
        
        try:
            if note.file_type == 'pdf':
                print("Extracting text from PDF...")
                content = self.extract_text_from_pdf(file_path)
            elif note.file_type == 'image':
                print("Extracting text from image...")
                content = self.extract_text_from_image(file_path)
            else:
                print("Reading text file...")
                # For text files, read directly
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
            
            print(f"Extracted content length: {len(content) if content else 0}")
            
            # Save the extracted content to the note
            note.content = content
            note.save()
            print(f"Content saved to note {note.id}")
            self.log_memory_usage("after file processing")
            return content
            
        except Exception as e:
            print(f"Error processing file: {str(e)}")
            # Always clear the current note, even on error
            self.clear_current_note()
            raise e
        finally:
            # Always clear the current note when done
            self.clear_current_note()


class TranslationService:
    """Service for handling translations"""
    
    def __init__(self):
        self.setup_gemini()
    
    def log_memory_usage(self, stage=""):
        """Log current memory usage to help with debugging"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            print(f"Memory usage {stage}: {memory_mb:.1f} MB")
            return memory_mb
        except Exception as e:
            print(f"Could not log memory usage: {e}")
            return 0
    
    def check_memory_limit(self, limit_mb=500):
        """Check if memory usage is within safe limits"""
        try:
            memory_mb = self.log_memory_usage("memory check")
            if memory_mb > limit_mb:
                print(f"⚠️  Memory usage {memory_mb:.1f} MB exceeds limit {limit_mb} MB")
                return False
            return True
        except Exception as e:
            print(f"Could not check memory limit: {e}")
            return True  # Allow processing if we can't check
    
    def setup_gemini(self):
        """Initialize AI service"""
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            print("Gemini API configured successfully")
        else:
            print("WARNING: GEMINI_API_KEY not found in settings")
    
    def translate_text(self, text, source_lang='auto', target_lang='vi'):
        """Translate text using AI and detect actual source language"""
        print(f"Starting translate_text with {len(text)} characters")
        print(f"Source language: {source_lang}, Target language: {target_lang}")
        
        # Clean and validate text
        if not text or not text.strip():
            raise Exception("Empty text provided for translation")
        
        # Remove any problematic characters that might cause API issues
        cleaned_text = text.strip()
        print(f"Text cleaned, length: {len(cleaned_text)}")
        
        try:
            # Use gemini-2.5-flash consistently
            model = genai.GenerativeModel('gemini-2.5-flash')
            print("AI model (gemini-2.5-flash) initialized successfully")
            
            detected_lang = source_lang
            
            # If auto-detect, first detect the language
            if source_lang == 'auto':
                print("Detecting language...")
                detection_prompt = f"""
                Detect the language of the following text. Return only the language code (e.g., 'en', 'es', 'fr', 'de', 'vi', 'zh', 'ja', 'ko').
                
                Text: {cleaned_text[:500]}  # Use first 500 chars for detection
                """
                
                detection_response = model.generate_content(detection_prompt)
                detected_lang = detection_response.text.strip().lower()
                print(f"Detected language: {detected_lang}")
                
                # Clean up the response (remove quotes, extra text)
                detected_lang = detected_lang.replace('"', '').replace("'", '').strip()
                
                # Map common language names to codes
                lang_mapping = {
                    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
                    'vietnamese': 'vi', 'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
                    'portuguese': 'pt', 'italian': 'it', 'russian': 'ru', 'arabic': 'ar'
                }
                detected_lang = lang_mapping.get(detected_lang, detected_lang)
            
            print(f"Starting translation from {detected_lang} to {target_lang}")
            prompt = f"""
            Translate the following text from {detected_lang} to {target_lang}.
            
            IMPORTANT: Preserve ALL markdown formatting, structure, headings (# ## ###), bullet points (- *), line breaks, and layout exactly as they appear.
            Do not change the markdown syntax, only translate the text content.
            Return only the translated text without any additional commentary.
            
            Text to translate:
            {cleaned_text}
            """
            
            print("Sending translation request to AI...")
            
            # Add generation configuration similar to chatbot behavior
            generation_config = {
                "temperature": 0.1,  # Slightly higher for more natural translation
                "top_p": 0.95,  # Higher diversity like chatbot
                "top_k": 40,
                "max_output_tokens": 32768,  # Large but not excessive
            }
            
            response = model.generate_content(
                prompt,
                generation_config=generation_config
            )
            print("Translation response received")
            
            translated_text = response.text.strip()
            print(f"Translation completed, length: {len(translated_text)}")
            print(translated_text[:500])
            
            return {
                'translated_text': translated_text,
                'detected_language': detected_lang
            }
            
        except Exception as e:
            raise Exception(f"Translation failed: {str(e)}")
    
    def translate_large_text(self, text, source_lang='auto', target_lang='vi'):
        """Translate large text by chunking it into smaller pieces"""
        print(f"Translating large text: {len(text)} characters")
        
        # Detect language once at the beginning
        detected_lang = source_lang
        if source_lang == 'auto':
            print("Detecting language for large text...")
            try:
                # Use first chunk for language detection
                first_chunk = text[:1000]  # Use first 1000 chars for detection
                detection_result = self.translate_text(first_chunk, 'auto', target_lang)
                detected_lang = detection_result['detected_language']
                print(f"Detected language: {detected_lang}")
            except Exception as e:
                print(f"Language detection failed, using 'en' as default: {e}")
                detected_lang = 'en'
        
        # Split text into smaller chunks to avoid API issues
        chunk_size = 10000  # Much smaller chunks to avoid 500 errors
        chunks = []
        
        # Split by paragraphs first, then by sentences if needed
        paragraphs = text.split('\n\n')
        current_chunk = ""
        
        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) < chunk_size:
                current_chunk += paragraph + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = paragraph + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        print(f"Split into {len(chunks)} chunks")
        
        # Function to translate a single chunk with retry logic
        def translate_chunk_with_retry(chunk_data):
            chunk_index, chunk = chunk_data
            print(f"Starting translation of chunk {chunk_index + 1}/{len(chunks)} ({len(chunk)} characters)")
            
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    # Use detected language instead of 'auto' for all chunks
                    result = self.translate_text(chunk, detected_lang, target_lang)
                    print(f"Chunk {chunk_index + 1} translated successfully (attempt {attempt + 1})")
                    return chunk_index, result['translated_text'], True
                except Exception as e:
                    print(f"Chunk {chunk_index + 1} translation failed (attempt {attempt + 1}): {e}")
                    if attempt < max_retries - 1:
                        # Shorter backoff: 1, 2, 3 seconds
                        wait_time = attempt + 1
                        print(f"Retrying chunk {chunk_index + 1} in {wait_time} seconds...")
                        import time
                        time.sleep(wait_time)
            
            print(f"Chunk {chunk_index + 1} failed after {max_retries} attempts, using original text")
            return chunk_index, chunk, False
        
        # Process chunks in parallel
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import time
        
        print(f"Starting parallel translation of {len(chunks)} chunks...")
        start_time = time.time()
        
        translated_chunks = [None] * len(chunks)  # Pre-allocate list to maintain order
        
        # Use ThreadPoolExecutor for parallel processing
        # Limit to 3 concurrent requests to avoid overwhelming the API
        max_workers = min(3, len(chunks))
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all chunks for translation
            future_to_chunk = {
                executor.submit(translate_chunk_with_retry, (i, chunk)): i 
                for i, chunk in enumerate(chunks)
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_chunk):
                chunk_index, translated_text, success = future.result()
                translated_chunks[chunk_index] = translated_text
                
                if success:
                    print(f"✅ Chunk {chunk_index + 1} completed successfully")
                else:
                    print(f"❌ Chunk {chunk_index + 1} failed, using original text")
        
        end_time = time.time()
        print(f"Parallel translation completed in {end_time - start_time:.2f} seconds")
        
        # Combine all translated chunks
        final_translation = "\n\n".join(translated_chunks)
        print(f"Large text translation completed: {len(final_translation)} characters")
        return final_translation, detected_lang
    
    def translate_note(self, note):
        """Translate a note and save the translation"""
        if not note.content:
            raise Exception("Note has no content to translate")
        
        print(f"Starting translation for note {note.id} - {note.title}")
        
        # Set this note as the current one being translated
        self.set_current_note(str(note.id))
        
        print(f"Content type: {type(note.content)}")
        print(f"Content length: {len(note.content) if note.content else 0}")
        print(f"Content preview: {note.content[:500] if note.content else 'None'}...")
        self.log_memory_usage("before translation start")
        detected_language = None
        
        # Check if content is page-based JSON or plain text
        try:
            import json
            print(f"🔍 Attempting to parse content as JSON...")
            print(f"Content type: {type(note.content)}")
            print(f"Content length: {len(note.content) if note.content else 0}")
            print(f"Content preview: {note.content[:500] if note.content else 'None'}")
            
            pages_data = json.loads(note.content)
            print(f"✅ Parsed JSON successfully, type: {type(pages_data)}")
            print(f"JSON length: {len(pages_data) if isinstance(pages_data, list) else 'Not a list'}")
            
            if isinstance(pages_data, list) and len(pages_data) > 0 and 'page_number' in pages_data[0]:
                # Page-based content - translate each page individually for better accuracy
                translated_pages = []
                print(f"Translating {len(pages_data)} pages individually")
                print(f"Content preview: {note.content[:200]}...")
                
                # Function to translate a single page
                def translate_single_page(page_data):
                    page_num = page_data['page_number']
                    content = page_data['content']
                    print(f"Translating page {page_num} ({len(content)} characters)")
                    
                    try:
                        result = self.translate_text(
                            content,
                            note.source_language,
                            note.target_language
                        )
                        print(f"Page {page_num} translated successfully")
                        return page_num, result['translated_text'], result['detected_language'], True
                    except Exception as e:
                        print(f"Page {page_num} translation failed: {e}")
                        return page_num, content, None, False
                
                # Process pages in parallel for better performance
                from concurrent.futures import ThreadPoolExecutor, as_completed
                import time
                
                print(f"Starting parallel translation of {len(pages_data)} pages...")
                self.log_memory_usage("before translation")
                start_time = time.time()
                completed_translations = 0
                
                # Use ThreadPoolExecutor for parallel processing
                # Limit to 2 concurrent requests to reduce memory usage
                max_workers = min(2, len(pages_data))
                
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    # Submit all pages for translation
                    future_to_page = {
                        executor.submit(translate_single_page, page_data): page_data['page_number'] 
                        for page_data in pages_data
                    }
                    
                    # Collect results as they complete
                    for future in as_completed(future_to_page):
                        page_num, translated_text, detected_lang, success = future.result()
                        
                        # Use the detected language from the first successful translation
                        if detected_language is None and detected_lang:
                            detected_language = detected_lang
                        
                        translated_pages.append({
                            'page_number': page_num,
                            'content': translated_text
                        })
                        
                        completed_translations += 1
                        if success:
                            print(f"✅ Page {page_num} translated successfully ({completed_translations}/{len(pages_data)})")
                        else:
                            print(f"❌ Page {page_num} failed, using original content ({completed_translations}/{len(pages_data)})")
                        
                        # Clean up memory after each translation
                        gc.collect()
                
                end_time = time.time()
                print(f"Parallel page translation completed in {end_time - start_time:.2f} seconds")
                self.log_memory_usage("after translation")
                
                # Sort pages by page number to maintain order
                translated_pages.sort(key=lambda x: x['page_number'])
                
                translated_content = json.dumps(translated_pages)
                
                # Clean up memory after translation
                del translated_pages
                gc.collect()
                self.log_memory_usage("after translation cleanup")
            else:
                # Plain text content
                result = self.translate_text(
                    note.content,
                    note.source_language,
                    note.target_language
                )
                translated_content = result['translated_text']
                detected_language = result['detected_language']
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            # Plain text content
            print(f"❌ JSON parsing failed: {e}")
            print(f"Error type: {type(e)}")
            print("Treating as plain text content")
            print(f"About to translate {len(note.content)} characters of plain text")
            
            # Try direct translation first, fallback to chunking if it fails
            if len(note.content) > 10000:  # 10KB limit per chunk
                print("Large text detected, trying direct translation first...")
                try:
                    # Try to translate the entire text at once (like the chatbot does)
                    result = self.translate_text(
                        note.content,
                        note.source_language,
                        note.target_language
                    )
                    print("Direct translation successful!")
                    translated_content = result['translated_text']
                    detected_language = result['detected_language']
                except Exception as direct_error:
                    print(f"Direct translation failed: {direct_error}")
                    print("Falling back to chunked translation...")
                    translated_content, detected_language = self.translate_large_text(
                        note.content,
                        note.source_language,
                        note.target_language
                    )
            else:
                try:
                    result = self.translate_text(
                        note.content,
                        note.source_language,
                        note.target_language
                    )
                    print("Translation completed successfully")
                    translated_content = result['translated_text']
                    detected_language = result['detected_language']
                except Exception as translate_error:
                    print(f"Translation failed: {translate_error}")
                    raise translate_error
        
        # Update the note with detected language
        if detected_language and note.source_language == 'auto':
            note.detected_language = detected_language
            note.save()
        
        print(f"Translation completed. Content length: {len(translated_content) if translated_content else 0}")
        print(f"Translated content preview: {translated_content[:200] if translated_content else 'None'}...")
        self.log_memory_usage("after translation completion")
        
        # Create or update translation
        translation, created = Translation.objects.get_or_create(
            note=note,
            defaults={
                'translated_content': translated_content,
                'translation_metadata': {
                    'source_language': note.source_language,
                    'detected_language': detected_language,
                    'target_language': note.target_language,
                    'model_used': 'ai-translation'
                }
            }
        )
        
        if not created:
            translation.translated_content = translated_content
            translation.translation_metadata.update({
                'source_language': note.source_language,
                'target_language': note.target_language,
                'model_used': 'ai-translation'
            })
            translation.save()
        
        print(f"Translation saved. Created: {created}, ID: {translation.id}")
        print(f"Final translation length: {len(translation.translated_content) if translation.translated_content else 0}")
        
        # Final memory cleanup
        gc.collect()
        self.log_memory_usage("after saving translation")
        
        return translation

    def get_word_definition(self, word, source_lang='en', target_lang='vi', context=''):
        """Get comprehensive word definition, translation, and context using AI"""
        try:
            print(f"🔍 Getting definition for word: '{word}'")
            print(f"📖 Context length: {len(context)} characters")
            print(f"📖 Context preview: {context[:300]}...")
            
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            # If auto-detect, assume English for now
            if source_lang == 'auto':
                source_lang = 'en'
            
            prompt = f"""
Provide a comprehensive analysis of the word/phrase: "{word}"

**Full Context from Document:**
{context}

Please provide:
1. **Definition**: A clear, detailed definition that explains what this word/phrase means
2. **Translation**: Accurate translation to {target_lang} (if different from source language)
3. **Context Analysis**: Explain how this word/phrase is specifically used in the provided context. What does it contribute to the meaning? How does it relate to the surrounding text?
4. **Example**: A relevant example sentence that shows how this word/phrase is used in context
5. **Type**: Part of speech (noun, verb, adjective, adverb, phrase, etc.)
6. **Level**: Difficulty level (Beginner, Intermediate, Advanced) based on complexity
7. **Usage Notes**: Any important notes about how this word/phrase is used in academic/professional contexts

Format your response as JSON with these exact keys:
{{
    "definition": "detailed definition here",
    "translation": "translation in {target_lang} or 'N/A (Already in {target_lang})'",
    "context": "detailed explanation of how the word contributes to the context",
    "example": "relevant example sentence",
    "type": "part of speech",
    "level": "difficulty level",
    "usage_notes": "important usage information"
}}

The context provided is the full paragraph/section where this word appears. Use it to provide a thorough analysis of how this specific word contributes to the meaning and flow of the text.
"""
            
            response = model.generate_content(prompt)
            
            # Try to parse JSON response
            try:
                import json
                import re
                
                # Clean the response text - remove markdown code blocks if present
                clean_text = response.text.strip()
                if clean_text.startswith('```json'):
                    clean_text = clean_text[7:]  # Remove ```json
                if clean_text.endswith('```'):
                    clean_text = clean_text[:-3]  # Remove ```
                clean_text = clean_text.strip()
                
                definition_data = json.loads(clean_text)
            except (json.JSONDecodeError, ValueError):
                # Fallback if JSON parsing fails
                definition_data = {
                    "definition": f"Definition for '{word}': {response.text[:200]}...",
                    "translation": f"Translation to {target_lang}",
                    "context": f"Used in the context: {context[:100]}...",
                    "example": f"Example: The word '{word}' is commonly used in academic texts.",
                    "type": "Unknown",
                    "level": "Intermediate",
                    "usage_notes": "Analysis based on AI response parsing"
                }
            
            return definition_data
            
        except Exception as e:
            # Fallback response
            return {
                "definition": f"Definition for '{word}' could not be retrieved: {str(e)}",
                "translation": f"Translation to {target_lang}",
                "context": f"Used in the provided context",
                "example": f"Example: The term '{word}' appears in the document.",
                "type": "Unknown",
                "level": "Intermediate",
                "usage_notes": "Error occurred during analysis"
            }
