# backend/apps/catalog/urls.py

from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, CategoryViewSet, UnitOfMeasureViewSet

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("categories", CategoryViewSet, basename="category")
router.register("units", UnitOfMeasureViewSet, basename="unit")

urlpatterns = router.urls
