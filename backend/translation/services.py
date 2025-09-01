import google.generativeai as genai
from django.conf import settings


class TranslationService:
    """Service for handling translations"""
    
    def __init__(self):
        self.setup_gemini()
    
    def setup_gemini(self):
        """Initialize AI service"""
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
    
    def translate_text(self, text, source_lang='auto', target_lang='vi'):
        """Translate text using AI"""
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            prompt = f"""
            Translate the following text from {source_lang} to {target_lang}.
            Preserve all formatting, markdown syntax, line breaks, and structure.
            Do not summarize or omit any content.
            Return only the translated text without any additional commentary or explanations.
            
            Text to translate:
            {text}
            """
            
            response = model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            raise Exception(f"Translation failed: {str(e)}")
