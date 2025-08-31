"""
URL configuration for note_translate project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'healthy', 'message': 'Note Translate API is running'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', health_check, name='health_check'),
    path('api/notes/', include('notes.urls')),
    path('api/vocabulary/', include('vocabulary.urls')),
    path('api/translation/', include('translation.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
