from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta
from .models import VocabularyItem
from .serializers import VocabularyItemSerializer, VocabularyItemCreateSerializer
from .services import VocabularyService


class VocabularyItemViewSet(viewsets.ModelViewSet):
    """ViewSet for managing vocabulary items"""
    permission_classes = [AllowAny]  # Allow guest users for development
    queryset = VocabularyItem.objects.all()  # Required for router basename
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['source_note', 'source_language', 'target_language']
    search_fields = ['word', 'definition', 'context_definition']
    ordering_fields = ['created_at', 'word']
    ordering = ['-created_at']
    
    def get_queryset(self):
        # For authenticated users, return their vocabulary items
        if hasattr(self.request, 'user') and self.request.user and self.request.user.is_authenticated:
            return VocabularyItem.objects.filter(user=self.request.user)
        else:
            # For guest users, return empty queryset - they can use the app but can't see saved vocabulary
            return VocabularyItem.objects.none()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return VocabularyItemCreateSerializer
        return VocabularyItemSerializer
    
    def perform_create(self, serializer):
        # Check if user is authenticated
        if not (hasattr(self.request, 'user') and self.request.user and self.request.user.is_authenticated):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be logged in to save vocabulary. Please create an account or log in.")
        
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def save_word(self, request):
        """Save a word from text selection"""
        try:
            # Check if user is authenticated
            if not (hasattr(request, 'user') and request.user and request.user.is_authenticated):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You must be logged in to save vocabulary. Please create an account or log in.")
            
            vocabulary_service = VocabularyService()
            vocab_item = vocabulary_service.save_word_from_selection(
                user=request.user,
                word=request.data.get('word'),
                context_sentence=request.data.get('context_sentence'),
                source_note_id=request.data.get('source_note_id'),
                page_number=request.data.get('page_number'),
                source_language=request.data.get('source_language'),
                target_language=request.data.get('target_language')
            )
            
            serializer = VocabularyItemSerializer(vocab_item)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get vocabulary statistics"""
        queryset = self.get_queryset()
        
        stats = {
            'total_words': queryset.count(),
            'by_language': {},
            'recent_count': queryset.filter(created_at__gte=timezone.now() - timedelta(days=7)).count()
        }
        
        # Count by language pairs
        for item in queryset.values('source_language', 'target_language').distinct():
            lang_pair = f"{item['source_language']}-{item['target_language']}"
            stats['by_language'][lang_pair] = queryset.filter(
                source_language=item['source_language'],
                target_language=item['target_language']
            ).count()
        
        return Response(stats)
