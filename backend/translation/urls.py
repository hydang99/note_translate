from django.urls import path
from .views import translate_text, get_supported_languages, define_word

urlpatterns = [
    path('translate/', translate_text, name='translate_text'),
    path('languages/', get_supported_languages, name='supported_languages'),
    path('define/', define_word, name='define_word'),
]
