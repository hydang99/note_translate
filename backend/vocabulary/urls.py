from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VocabularyItemViewSet

router = DefaultRouter()
router.register(r'', VocabularyItemViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
