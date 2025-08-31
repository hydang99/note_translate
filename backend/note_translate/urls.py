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

def list_media_files(request):
    import os
    from django.conf import settings
    
    media_path = settings.MEDIA_ROOT
    files = []
    
    if os.path.exists(media_path):
        for root, dirs, filenames in os.walk(media_path):
            for filename in filenames:
                rel_path = os.path.relpath(os.path.join(root, filename), media_path)
                files.append({
                    'name': filename,
                    'path': rel_path,
                    'url': f"{settings.MEDIA_URL}{rel_path}"
                })
    
    return JsonResponse({
        'media_root': media_path,
        'media_url': settings.MEDIA_URL,
        'files': files,
        'count': len(files)
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', health_check, name='health_check'),
    path('api/media-files/', list_media_files, name='list_media_files'),
    path('api/notes/', include('notes.urls')),
    path('api/vocabulary/', include('vocabulary.urls')),
    path('api/translation/', include('translation.urls')),
]

# Serve media files in both development and production
if settings.DEBUG:
    # In development, use Django's static file serving
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # In production, WhiteNoise will handle media files
    # Add a custom view to serve media files
    from django.views.static import serve
    from django.urls import re_path
    
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
