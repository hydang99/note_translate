import os
import PyPDF2
from PIL import Image
import google.generativeai as genai
from django.conf import settings
from .models import Note, Translation


class NoteService:
    """Service for handling note operations"""
    
    def __init__(self):
        self.setup_gemini()
    
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
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                # Convert page to image
                mat = fitz.Matrix(2, 2)  # 2x zoom for better quality
                pix = page.get_pixmap(matrix=mat)
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
                    print(f"Error accessing response.text: {text_error}")
                    # Try alternative access methods
                    if hasattr(response, 'parts') and response.parts:
                        page_text = response.parts[0].text
                    elif hasattr(response, 'candidates') and response.candidates:
                        page_text = response.candidates[0].content.parts[0].text
                    else:
                        raise Exception(f"Could not extract text from response: {text_error}")
                
                page_text = page_text if page_text else ""
                pages_data.append({
                    'page_number': page_num + 1,
                    'content': page_text
                })
            
            doc.close()
            
            # Store pages data as JSON in the content field
            return json.dumps(pages_data)
            
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
            return content
            
        except Exception as e:
            print(f"Error processing file: {str(e)}")
            raise e


class TranslationService:
    """Service for handling translations"""
    
    def __init__(self):
        self.setup_gemini()
    
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
        detected_language = None
        
        # Check if content is page-based JSON or plain text
        try:
            import json
            print(f"Content type: {type(note.content)}")
            print(f"Content length: {len(note.content) if note.content else 0}")
            print(f"Content preview: {note.content[:500] if note.content else 'None'}")
            
            pages_data = json.loads(note.content)
            print(f"Parsed JSON successfully, type: {type(pages_data)}")
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
                start_time = time.time()
                
                # Use ThreadPoolExecutor for parallel processing
                # Limit to 3 concurrent requests to avoid overwhelming the API
                max_workers = min(3, len(pages_data))
                
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
                        
                        if success:
                            print(f"✅ Page {page_num} completed successfully")
                        else:
                            print(f"❌ Page {page_num} failed, using original content")
                
                end_time = time.time()
                print(f"Parallel page translation completed in {end_time - start_time:.2f} seconds")
                
                # Sort pages by page number to maintain order
                translated_pages.sort(key=lambda x: x['page_number'])
                
                translated_content = json.dumps(translated_pages)
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
            print(f"JSON parsing failed: {e}")
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
        
        return translation

    def get_word_definition(self, word, source_lang='en', target_lang='vi', context=''):
        """Get comprehensive word definition, translation, and context using AI"""
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            # If auto-detect, assume English for now
            if source_lang == 'auto':
                source_lang = 'en'
            
            prompt = f"""
            Provide a concise analysis of the word/phrase: "{word}"
            
            Context from document: "{context[:300]}..."
            
            Please provide:
            1. **Definition**: A brief, clear definition (max 2 sentences)
            2. **Translation**: Translation to {target_lang} (if different from source language)
            3. **Context**: How this word/phrase is used in the provided context (max 1 sentence)
            4. **Example**: A short example sentence using this word/phrase
            5. **Type**: Part of speech (noun, verb, adjective, etc.)
            6. **Level**: Difficulty level (Beginner, Intermediate, Advanced)
            
            Format your response as JSON with these exact keys:
            {{
                "definition": "brief definition here",
                "translation": "translation in {target_lang} or 'N/A (Already in {target_lang})'",
                "context": "brief explanation of usage",
                "example": "short example sentence",
                "type": "part of speech",
                "level": "difficulty level"
            }}
            
            Keep all responses concise and to the point.
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
                    "level": "Intermediate"
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
                "level": "Intermediate"
            }
