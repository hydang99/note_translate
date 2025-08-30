from django.db import models
from django.contrib.auth.models import User
from notes.models import Note
import uuid


class VocabularyItem(models.Model):
    """Model for storing vocabulary items"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vocabulary_items', null=True, blank=True)
    word = models.CharField(max_length=200)
    definition = models.TextField(blank=True)
    context_definition = models.TextField(blank=True)
    source_note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='vocabulary_items')
    page_number = models.IntegerField(null=True, blank=True)
    context_sentence = models.TextField()
    source_language = models.CharField(max_length=10)
    target_language = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['user', 'word', 'source_note', 'source_language', 'target_language']
    
    def __str__(self):
        return f"{self.word} from {self.source_note.title}"
