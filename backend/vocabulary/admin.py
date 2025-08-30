from django.contrib import admin
from .models import VocabularyItem


@admin.register(VocabularyItem)
class VocabularyItemAdmin(admin.ModelAdmin):
    list_display = ['word', 'user', 'source_note', 'source_language', 'target_language', 'created_at']
    list_filter = ['source_language', 'target_language', 'created_at']
    search_fields = ['word', 'definition', 'context_definition', 'user__email', 'source_note__title']
    readonly_fields = ['created_at', 'updated_at']
