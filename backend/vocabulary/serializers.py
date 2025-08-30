from rest_framework import serializers
from .models import VocabularyItem
from notes.serializers import NoteSerializer


class VocabularyItemSerializer(serializers.ModelSerializer):
    source_note = NoteSerializer(read_only=True)
    
    class Meta:
        model = VocabularyItem
        fields = [
            'id', 'word', 'definition', 'context_definition',
            'source_note', 'page_number', 'context_sentence',
            'source_language', 'target_language', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class VocabularyItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VocabularyItem
        fields = [
            'word', 'definition', 'context_definition',
            'source_note', 'page_number', 'context_sentence',
            'source_language', 'target_language'
        ]
