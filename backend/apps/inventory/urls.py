# backend/apps/inventory/urls.py

from rest_framework.routers import DefaultRouter
from .views import StockLevelViewSet, StockMovementViewSet

router = DefaultRouter()
router.register("stock-levels", StockLevelViewSet, basename="stock-level")
router.register("movements", StockMovementViewSet, basename="stock-movement")

urlpatterns = router.urls
