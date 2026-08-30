# backend/apps/tenants/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrganizationView, BranchViewSet

router = DefaultRouter()
router.register("branches", BranchViewSet, basename="branch")

urlpatterns = [
    path("organization/", OrganizationView.as_view(), name="organization"),
    path("", include(router.urls)),
]
