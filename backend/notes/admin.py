from django.contrib import admin
from .models import Note, Translation


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'file_type', 'source_language', 'target_language', 'created_at']
    list_filter = ['file_type', 'source_language', 'target_language', 'created_at']
    search_fields = ['title', 'content', 'user__email']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Translation)
class TranslationAdmin(admin.ModelAdmin):
    list_display = ['note', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['note__title', 'translated_content']
    readonly_fields = ['created_at', 'updated_at']
