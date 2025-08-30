from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .services import TranslationService


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow guest users
def translate_text(request):
    """Translate text using AI"""
    try:
        text = request.data.get('text')
        print(text)
        source_lang = request.data.get('source_language', 'auto')
        target_lang = request.data.get('target_language', 'vi')
        
        if not text:
            return Response(
                {'error': 'Text is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        translation_service = TranslationService()
        translated_text = translation_service.translate_text(text, source_lang, target_lang)
        print(translated_text)
        return Response({
            'original_text': text,
            'translated_text': translated_text,
            'source_language': source_lang,
            'target_language': target_lang
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([AllowAny])  # No authentication required
def get_supported_languages(request):
    """Get list of supported languages"""
    languages = [
        {'code': 'auto', 'name': 'Auto-detect'},
        {'code': 'en', 'name': 'English'},
        {'code': 'vi', 'name': 'Vietnamese'},
        {'code': 'zh', 'name': 'Chinese'},
        {'code': 'ja', 'name': 'Japanese'},
        {'code': 'ko', 'name': 'Korean'},
        {'code': 'fr', 'name': 'French'},
        {'code': 'de', 'name': 'German'},
        {'code': 'es', 'name': 'Spanish'},
        {'code': 'it', 'name': 'Italian'},
        {'code': 'pt', 'name': 'Portuguese'},
        {'code': 'ru', 'name': 'Russian'},
        {'code': 'ar', 'name': 'Arabic'},
        {'code': 'hi', 'name': 'Hindi'},
        {'code': 'th', 'name': 'Thai'},
    ]
    
    return Response(languages)


@api_view(['POST'])
@permission_classes([AllowAny])
def define_word(request):
    """Get word definition, translation, and context"""
    try:
        word = request.data.get('word', '').strip()
        source_lang = request.data.get('source_language', 'en')
        target_lang = request.data.get('target_language', 'vi')
        context = request.data.get('context', '')
        
        if not word:
            return Response({'error': 'Word is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from notes.services import TranslationService
        translation_service = TranslationService()
        
        # Get definition and translation using AI
        definition_data = translation_service.get_word_definition(
            word, source_lang, target_lang, context
        )
        
        return Response(definition_data)
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
