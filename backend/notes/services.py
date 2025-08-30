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
        try:
            # Always use AI Vision for better formatting preservation
            return self.extract_text_from_pdf_with_vision(file_path)
        except Exception as e:
            # Fallback to basic PyPDF2 if vision fails
            try:
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text() + "\n\n"
                    return text.strip()
            except Exception as basic_error:
                raise Exception(f"Error extracting text from PDF: {str(e)}. Basic fallback also failed: {str(basic_error)}")
    
    def extract_text_from_pdf_with_vision(self, file_path):
        """Extract text from PDF using AI Vision API for better formatting"""
        try:
            import fitz  # PyMuPDF for converting PDF to images
            from PIL import Image
            import io
            import json
            
            # Convert PDF to images
            doc = fitz.open(file_path)
            pages_data = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                # Convert page to image
                mat = fitz.Matrix(2, 2)  # 2x zoom for better quality
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                
                # Use AI Vision to extract text with formatting
                model = genai.GenerativeModel('gemini-2.5-flash')
                response = model.generate_content([
                    """Extract all text from this PDF page and convert it to well-formatted markdown. 

CRITICAL FORMATTING RULES:
1. **Headings**: Use # for main titles, ## for major sections, ### for subsections
2. **Lists**: Use - for bullet points, 1. 2. 3. for numbered lists
3. **Emphasis**: Use **bold** for important text, *italic* for emphasis
4. **Structure**: Preserve all indentation, spacing, and line breaks
5. **Sections**: Add proper spacing between different sections
6. **Lists**: If you see bullet points or numbered items, format them as proper markdown lists
7. **Contact info**: Format addresses, emails, phone numbers clearly
8. **Dates**: Keep dates and time periods clearly formatted
9. **Education/Experience**: Use consistent formatting for entries

FORMATTING EXAMPLES:
- For education: Use ## EDUCATION with proper spacing
- For experience: Use ## EXPERIENCE with bullet points for details
- For skills: Use ## SKILLS with bullet points
- For publications: Use ## PUBLICATIONS with numbered lists
- For contact: Use ## CONTACT with clear formatting

Extract and format the text with proper markdown structure:""",
                    img
                ])
                
                page_text = response.text if response.text else ""
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
        if not note.file:
            return note.content
        
        file_path = note.file.path
        
        if note.file_type == 'pdf':
            content = self.extract_text_from_pdf(file_path)
        elif note.file_type == 'image':
            content = self.extract_text_from_image(file_path)
        else:
            # For text files, read directly
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
        
        note.content = content
        note.save()
        return content


class TranslationService:
    """Service for handling translations"""
    
    def __init__(self):
        self.setup_gemini()
    
    def setup_gemini(self):
        """Initialize AI service"""
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
    
    def translate_text(self, text, source_lang='auto', target_lang='vi'):
        """Translate text using AI and detect actual source language"""
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            detected_lang = source_lang
            
            # If auto-detect, first detect the language
            if source_lang == 'auto':
                detection_prompt = f"""
                Detect the language of the following text. Return only the language code (e.g., 'en', 'es', 'fr', 'de', 'vi', 'zh', 'ja', 'ko').
                
                Text: {text[:500]}  # Use first 500 chars for detection
                """
                
                detection_response = model.generate_content(detection_prompt)
                detected_lang = detection_response.text.strip().lower()
                
                # Clean up the response (remove quotes, extra text)
                detected_lang = detected_lang.replace('"', '').replace("'", '').strip()
                
                # Map common language names to codes
                lang_mapping = {
                    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
                    'vietnamese': 'vi', 'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
                    'portuguese': 'pt', 'italian': 'it', 'russian': 'ru', 'arabic': 'ar'
                }
                detected_lang = lang_mapping.get(detected_lang, detected_lang)
            
            prompt = f"""
            Translate the following text from {detected_lang} to {target_lang}.
            
            IMPORTANT: Preserve ALL markdown formatting, structure, headings (# ## ###), bullet points (- *), line breaks, and layout exactly as they appear.
            Do not change the markdown syntax, only translate the text content.
            Return only the translated text without any additional commentary.
            
            Text to translate:
            {text}
            """
            
            response = model.generate_content(prompt)
            return {
                'translated_text': response.text.strip(),
                'detected_language': detected_lang
            }
            
        except Exception as e:
            raise Exception(f"Translation failed: {str(e)}")
    
    def translate_note(self, note):
        """Translate a note and save the translation"""
        if not note.content:
            raise Exception("Note has no content to translate")
        
        detected_language = None
        
        # Check if content is page-based JSON or plain text
        try:
            import json
            pages_data = json.loads(note.content)
            if isinstance(pages_data, list) and len(pages_data) > 0 and 'page_number' in pages_data[0]:
                # Page-based content - translate each page
                translated_pages = []
                for page_data in pages_data:
                    result = self.translate_text(
                        page_data['content'],
                        note.source_language,
                        note.target_language
                    )
                    translated_pages.append({
                        'page_number': page_data['page_number'],
                        'content': result['translated_text']
                    })
                    # Use the detected language from the first page
                    if detected_language is None:
                        detected_language = result['detected_language']
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
        except (json.JSONDecodeError, KeyError, TypeError):
            # Plain text content
            result = self.translate_text(
                note.content,
                note.source_language,
                note.target_language
            )
            translated_content = result['translated_text']
            detected_language = result['detected_language']
        
        # Update the note with detected language
        if detected_language and note.source_language == 'auto':
            note.detected_language = detected_language
            note.save()
        
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
                'model_used': 'gemini-2.5-flash'
            })
            translation.save()
        
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
