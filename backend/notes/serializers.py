from rest_framework import serializers
from .models import Note, Translation


class NoteSerializer(serializers.ModelSerializer):
    translation = serializers.SerializerMethodField()
    
    class Meta:
        model = Note
        fields = [
            'id', 'title', 'content', 'file', 'file_type',
            'source_language', 'detected_language', 'target_language', 'tags',
            'created_at', 'updated_at', 'last_viewed_page', 'translation'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_translation(self, obj):
        if hasattr(obj, 'translation'):
            return TranslationSerializer(obj.translation).data
        return None


class TranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Translation
        fields = ['id', 'translated_content', 'translation_metadata', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class NoteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = [
            'id', 'title', 'content', 'file', 'file_type',
            'source_language', 'detected_language', 'target_language', 'tags'
        ]
        read_only_fields = ['id']
