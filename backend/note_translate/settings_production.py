import os
from .settings import *

# Production settings
DEBUG = False

# Security settings
SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")

ALLOWED_HOSTS = [host.strip() for host in os.getenv('ALLOWED_HOSTS', '').split(',') if host.strip()]
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['*']  # Fallback for development

# Database - PostgreSQL for production
import dj_database_url

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

DATABASES = {
    'default': dj_database_url.parse(DATABASE_URL)
}

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# WhiteNoise configuration for serving static and media files
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = True

# Media files - Use Railway's persistent volume
MEDIA_URL = '/media/'
# Use Railway's persistent volume at /data for media files
MEDIA_ROOT = '/data/media'

# Timeout settings for large file processing
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB

# Request timeout settings
REQUEST_TIMEOUT = 1200  # 20 minutes for translation requests

# Additional timeout settings for Railway
TIMEOUT = 1200  # 20 minutes

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://web-production-4646.up.railway.app",
    "https://note-translate-meowj9nn8-hy-dangs-projects-9554bf41.vercel.app",  # Vercel frontend
    "https://note-translate-gpqbikl97-hy-dangs-projects-9554bf41.vercel.app",  # New Vercel deployment
    "https://note-translate-1q5s2uu1z-hy-dangs-projects-9554bf41.vercel.app",  # Latest Vercel deployment
    "https://note-translate-hjj84a8fc-hy-dangs-projects-9554bf41.vercel.app",  # Fresh Vercel deployment
    "https://note-translate-ni1icez72-hy-dangs-projects-9554bf41.vercel.app",  # Latest Vercel deployment
    "https://note-translate-7b6rs3apj-hy-dangs-projects-9554bf41.vercel.app",  # Latest Vercel deployment
    "https://note-translate-bxsmru8sy-hy-dangs-projects-9554bf41.vercel.app",  # Latest Vercel deployment
    "https://note-translate-8c0ttelzg-hy-dangs-projects-9554bf41.vercel.app",  # Manual deployment
    "https://note-translate-iry2x2en5-hy-dangs-projects-9554bf41.vercel.app",  # Latest deployment
    "https://note-translate-u10xxzpy5-hy-dangs-projects-9554bf41.vercel.app",  # Scrolling fix deployment
    "https://note-translate-8wxffhxto-hy-dangs-projects-9554bf41.vercel.app",  # Sync toggle deployment
    "https://note-translate-kbidgegne-hy-dangs-projects-9554bf41.vercel.app",  # Enhanced sync deployment
    "https://note-translate-5tphyie4b-hy-dangs-projects-9554bf41.vercel.app",  # Section navigation deployment
    "https://note-translate-ldfg1g7fp-hy-dangs-projects-9554bf41.vercel.app",  # Dual highlighting deployment
    "https://note-translate-hzt2dk26a-hy-dangs-projects-9554bf41.vercel.app",  # Accurate section pairing deployment
    "https://note-translate.vercel.app",  # Vercel custom domain
    "http://localhost:3000",  # For local development
]
CORS_ALLOW_ALL_ORIGINS = False  # Explicitly set to False for production
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Security settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# HTTPS settings (uncomment when you have SSL)
# SECURE_SSL_REDIRECT = True
# SESSION_COOKIE_SECURE = True
# CSRF_COOKIE_SECURE = True

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'django.log'),
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'ERROR',
            'propagate': True,
        },
    },
}
