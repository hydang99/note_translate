import firebase_admin
from firebase_admin import credentials, auth
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User
from django.conf import settings
import os


class FirebaseAuthentication(BaseAuthentication):
    """Custom authentication class for Firebase"""
    
    def __init__(self):
        if not firebase_admin._apps:
            if settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
            else:
                # For development, you can use default credentials
                firebase_admin.initialize_app()
    
    def authenticate(self, request):
        # For development, create a simple user mapping
        # Check if there's an Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            # Extract the token to use as a unique identifier
            token = auth_header.split(' ')[1]
            
            # For development, create a unique user based on the token
            # In production, this would verify the Firebase token and extract user info
            username = f'user_{hash(token) % 1000000}'  # Create unique username from token hash
            
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@example.com', 
                    'first_name': 'User', 
                    'last_name': f'#{username.split("_")[1]}'
                }
            )
            
            # Debug logging
            print(f"Authentication: {'Created' if created else 'Found'} user: {username}")
            
            return (user, None)
        
        # No auth header means guest user
        print("Authentication: No auth header - guest user")
        return None
