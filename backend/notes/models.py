from django.db import models
from django.contrib.auth.models import User
import uuid


class Note(models.Model):
    """Model for storing user notes"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notes', null=True, blank=True)
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    file = models.FileField(upload_to='notes/', blank=True, null=True)
    file_type = models.CharField(max_length=10, choices=[
        ('pdf', 'PDF'),
        ('txt', 'Text'),
        ('image', 'Image'),
    ], default='txt')
    source_language = models.CharField(max_length=10, default='auto')
    detected_language = models.CharField(max_length=10, blank=True, null=True)  # Store the actual detected language
    target_language = models.CharField(max_length=10, default='vi')
    tags = models.TextField(blank=True, help_text="Comma-separated tags for organization")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_viewed_page = models.IntegerField(default=1)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        return self.title


class Translation(models.Model):
    """Model for storing translations of notes"""
    note = models.OneToOneField(Note, on_delete=models.CASCADE, related_name='translation')
    translated_content = models.TextField()
    translation_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Translation for {self.note.title}"
