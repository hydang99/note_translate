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

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Timeout settings for large file processing
FILE_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50MB

# Request timeout settings
REQUEST_TIMEOUT = 300  # 5 minutes for translation requests

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://web-production-4646.up.railway.app",
    "https://note-translate-meowj9nn8-hy-dangs-projects-9554bf41.vercel.app",  # Vercel frontend
    "https://note-translate-gpqbikl97-hy-dangs-projects-9554bf41.vercel.app",  # New Vercel deployment
    "https://note-translate-1q5s2uu1z-hy-dangs-projects-9554bf41.vercel.app",  # Latest Vercel deployment
    "https://note-translate-hjj84a8fc-hy-dangs-projects-9554bf41.vercel.app",  # Fresh Vercel deployment
    "https://note-translate-ni1icez72-hy-dangs-projects-9554bf41.vercel.app",  # Latest Vercel deployment
    "https://note-translate.vercel.app",  # Vercel custom domain
    "http://localhost:3000",  # For local development
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
