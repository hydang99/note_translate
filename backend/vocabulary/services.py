import google.generativeai as genai
from django.conf import settings
from django.utils import timezone
from .models import VocabularyItem
from notes.models import Note


class VocabularyService:
    """Service for handling vocabulary operations"""
    
    def __init__(self):
        self.setup_gemini()
    
    def setup_gemini(self):
        """Initialize AI service"""
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
    
    def get_word_definition(self, word, context_sentence, source_lang, target_lang='en'):
        """Get word definition using AI"""
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            prompt = f"""
            Given the word "{word}" in the context: "{context_sentence}"
            
            Please provide:
            1. A general definition of the word in {target_lang}
            2. A contextual definition based on how it's used in the given sentence
            
            Format your response as:
            General Definition: [definition]
            Contextual Definition: [contextual definition]
            """
            
            response = model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            return f"Error getting definition: {str(e)}"
    
    def save_word_from_selection(self, user, word, context_sentence, source_note_id, 
                                page_number=None, source_language='auto', target_language='en'):
        """Save a word from text selection with definitions"""
        
        # Get the source note
        try:
            source_note = Note.objects.get(id=source_note_id, user=user)
        except Note.DoesNotExist:
            raise Exception("Source note not found")
        
        # Get definitions
        definition_text = self.get_word_definition(word, context_sentence, source_language, target_language)
        
        # Parse definitions
        general_definition = ""
        context_definition = ""
        
        if "General Definition:" in definition_text and "Contextual Definition:" in definition_text:
            parts = definition_text.split("Contextual Definition:")
            if len(parts) == 2:
                general_definition = parts[0].replace("General Definition:", "").strip()
                context_definition = parts[1].strip()
        else:
            general_definition = definition_text
        
        # Create vocabulary item
        vocab_item, created = VocabularyItem.objects.get_or_create(
            user=user,
            word=word,
            source_note=source_note,
            source_language=source_language,
            target_language=target_language,
            defaults={
                'definition': general_definition,
                'context_definition': context_definition,
                'context_sentence': context_sentence,
                'page_number': page_number
            }
        )
        
        if not created:
            # Update existing item
            vocab_item.definition = general_definition
            vocab_item.context_definition = context_definition
            vocab_item.context_sentence = context_sentence
            vocab_item.page_number = page_number
            vocab_item.updated_at = timezone.now()
            vocab_item.save()
        
        return vocab_item
