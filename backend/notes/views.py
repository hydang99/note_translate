from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db import models
from django.utils import timezone
from .models import Note, Translation
from .serializers import NoteSerializer, NoteCreateSerializer, TranslationSerializer
from .services import NoteService, TranslationService
import json


class NoteViewSet(viewsets.ModelViewSet):
    """ViewSet for managing notes"""
    permission_classes = [AllowAny]  # Allow guest users for now
    queryset = Note.objects.all()  # Required for router basename
    
    def get_queryset(self):
        if hasattr(self.request, 'user') and self.request.user.is_authenticated:
            print(f"Notes queryset: User {self.request.user.username} authenticated, filtering by user")
            # Include both user's notes and guest notes (for transfer of ownership)
            return Note.objects.filter(
                models.Q(user=self.request.user) | models.Q(user__isnull=True)
            )
        else:
            # For guest users, return notes that have no user (guest notes)
            print("Notes queryset: No authenticated user, returning guest notes")
            return Note.objects.filter(user__isnull=True)
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return NoteCreateSerializer
        return NoteSerializer
    
    def perform_create(self, serializer):
        # Allow guest users to create temporary notes for trying the system
        if hasattr(self.request, 'user') and self.request.user.is_authenticated:
            note = serializer.save(user=self.request.user)
        else:
            # Guest users can create notes but they won't be saved permanently
            note = serializer.save(user=None)
        
        # Extract text from uploaded file if present
        if note.file:
            try:
                from .services import NoteService
                note_service = NoteService()
                note_service.process_uploaded_file(note)
            except Exception as e:
                print(f"Error processing uploaded file: {e}")
                # Don't fail the creation, just log the error
    
    def perform_update(self, serializer):
        # If the note has no user (guest note) and we have an authenticated user,
        # transfer ownership to the authenticated user
        if hasattr(self.request, 'user') and self.request.user.is_authenticated:
            note = serializer.instance
            if note.user is None:
                print(f"Transferring ownership of guest note {note.id} to user {self.request.user.username}")
                serializer.save(user=self.request.user)
            else:
                serializer.save()
        else:
            serializer.save()
    
    def create(self, request, *args, **kwargs):
        print(f"Create request data: {request.data}")
        print(f"Create request FILES: {request.FILES}")
        print(f"User authenticated: {request.user.is_authenticated if hasattr(request, 'user') else 'No user'}")
        print(f"User: {request.user if hasattr(request, 'user') else 'No user'}")
        print(f"Auth header: {request.META.get('HTTP_AUTHORIZATION', 'None')}")
        return super().create(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def translate(self, request, pk=None):
        """Translate a note"""
        print(f"Translate request for note ID: {pk}")
        print(f"User: {request.user if hasattr(request, 'user') else 'No user'}")
        try:
            note = self.get_object()
            print(f"Found note: {note.id} - {note.title}")
        except Exception as e:
            print(f"Error getting note: {e}")
            print(f"Available notes for user: {list(Note.objects.filter(user=request.user).values_list('id', 'title')) if hasattr(request, 'user') and request.user.is_authenticated else 'No user'}")
            return Response(
                {'error': f'Note not found. This might be because the database was reset. Please try uploading the note again.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if edited content is provided in the request
        edited_content = request.data.get('content')
        if edited_content:
            print(f"Using edited content from request: {len(edited_content)} characters")
            # Temporarily update the note's content for translation
            original_content = note.content
            note.content = edited_content
        else:
            print("Using original content from database")
        
        # If note has no content but has a file, try to extract text first
        if not note.content and note.file:
            try:
                from .services import NoteService
                note_service = NoteService()
                note_service.process_uploaded_file(note)
                note.refresh_from_db()  # Refresh to get the extracted content
            except Exception as e:
                return Response(
                    {'error': f'Failed to extract text from file: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            print(f"Starting translation process...")
            print(f"Note content type: {type(note.content)}")
            print(f"Note content length: {len(note.content) if note.content else 0}")
            print(f"Note content preview: {note.content[:200] if note.content else 'None'}...")
            
            translation_service = TranslationService()
            print(f"Translation service created successfully")
            
            translation = translation_service.translate_note(note)
            print(f"Translation completed successfully: {translation}")
            
            # Save the edited content to the database
            if edited_content:
                note.content = edited_content
                note.save()
                print(f"Saved edited content to database")
            
            serializer = TranslationSerializer(translation)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"❌ Translation failed with error: {str(e)}")
            print(f"Error type: {type(e)}")
            import traceback
            print(f"Full traceback: {traceback.format_exc()}")
            
            # Restore original content if we temporarily changed it and there was an error
            if edited_content:
                note.content = original_content
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['patch'])
    def update_last_viewed_page(self, request, pk=None):
        """Update the last viewed page for a note"""
        note = self.get_object()
        page = request.data.get('page', 1)
        
        note.last_viewed_page = page
        note.save()
        
        return Response({'status': 'success'})
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """Get progress information for a note's processing"""
        note = self.get_object()
        
        # Try to determine page count from content
        total_pages = 0
        current_page = 0
        
        if note.content:
            try:
                # Check if content is JSON (page-based structure)
                if note.content.startswith('[') or note.content.startswith('{'):
                    pages_data = json.loads(note.content)
                    if isinstance(pages_data, list):
                        total_pages = len(pages_data)
                    elif isinstance(pages_data, dict) and 'page_number' in pages_data:
                        total_pages = 1
            except:
                # If not JSON, assume it's plain text (1 page)
                total_pages = 1
        
        # Check if there's a translation in progress
        has_translation = hasattr(note, 'translation') and note.translation is not None
        
        return Response({
            'note_id': note.id,
            'total_pages': total_pages,
            'current_page': current_page,
            'has_translation': has_translation,
            'is_processing': False  # For now, we don't have real-time processing status
        })
    
    @action(detail=True, methods=['post'])
    def re_extract_text(self, request, pk=None):
        """Re-extract text from uploaded file with improved formatting"""
        note = self.get_object()
        
        if not note.file:
            return Response(
                {'error': 'Note has no file to extract text from'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .services import NoteService
            note_service = NoteService()
            note_service.process_uploaded_file(note)
            note.refresh_from_db()
            
            serializer = NoteSerializer(note)
            return Response(serializer.data)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to re-extract text: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def cancel_file_processing(self, request, pk=None):
        """Cancel ongoing file processing/upload"""
        try:
            note = self.get_object()
            print(f"Cancel file processing request for note ID: {pk}")
            
            # Check if note is currently being processed
            if hasattr(note, 'processing_status') and note.processing_status == 'processing':
                # Mark note as cancelled
                note.processing_status = 'cancelled'
                note.save()
                print(f"Note {note.id} file processing marked as cancelled")
                
                return Response({
                    'status': 'cancelled',
                    'message': 'File processing cancelled successfully',
                    'note_id': note.id
                })
            else:
                return Response({
                    'status': 'no_processing',
                    'message': 'No ongoing file processing to cancel'
                })
                
        except Exception as e:
            print(f"Error cancelling file processing: {str(e)}")
            return Response(
                {'error': f'Failed to cancel file processing: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def cancel_translation(self, request, pk=None):
        """Cancel ongoing translation processing"""
        try:
            note = self.get_object()
            print(f"Cancel translation request for note ID: {pk}")
            
            # Check if there's an ongoing translation
            try:
                translation = Translation.objects.get(note=note)
                if translation.translation_metadata and translation.translation_metadata.get('status') == 'processing':
                    # Mark translation as cancelled
                    translation.translation_metadata['status'] = 'cancelled'
                    translation.translation_metadata['cancelled_at'] = timezone.now().isoformat()
                    translation.save()
                    print(f"Translation {translation.id} marked as cancelled")
                    
                    return Response({
                        'status': 'cancelled',
                        'message': 'Translation processing cancelled successfully',
                        'translation_id': translation.id
                    })
                else:
                    return Response({
                        'status': 'no_processing',
                        'message': 'No ongoing translation to cancel'
                    })
            except Translation.DoesNotExist:
                return Response({
                    'status': 'no_translation',
                    'message': 'No translation found for this note'
                })
                
        except Exception as e:
            print(f"Error cancelling translation: {str(e)}")
            return Response(
                {'error': f'Failed to cancel translation: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recently viewed notes"""
        notes = self.get_queryset().order_by('-updated_at')[:10]
        serializer = self.get_serializer(notes, many=True)
        return Response(serializer.data)
