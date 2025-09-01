import google.generativeai as genai
from django.conf import settings
from notes.cancellation import cancellation_registry


class TranslationService:
    """Service for handling translations"""
    
    def __init__(self):
        self.setup_gemini()
        self.current_note_id = None  # Track which note is being translated
    
    def check_cancelled(self, note_id: str = None):
        """Check if processing has been cancelled"""
        if note_id and cancellation_registry.is_cancelled(note_id):
            print(f"🛑 Translation cancelled by user for note {note_id}")
            raise Exception("Translation cancelled by user")
        return False
    
    def set_current_note(self, note_id: str):
        """Set the current note being translated"""
        self.current_note_id = note_id
        cancellation_registry.register_note(note_id)
        print(f"📝 TranslationService now translating note {note_id}")
    
    def clear_current_note(self):
        """Clear the current note and unregister from processing"""
        if self.current_note_id:
            cancellation_registry.unregister_note(self.current_note_id)
            print(f"📝 TranslationService finished translating note {self.current_note_id}")
            self.current_note_id = None
    
    def setup_gemini(self):
        """Initialize AI service"""
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
    
    def translate_text(self, text, source_lang='auto', target_lang='vi', note_id=None):
        """Translate text using AI"""
        # Check if processing has been cancelled
        self.check_cancelled(note_id)
        
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
