from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.views import ContactViewSet, external_update

router = DefaultRouter()
router.register(r"contacts", ContactViewSet, basename="contact")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/external-update/", external_update),
]
