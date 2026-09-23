# backend/apps/sales/urls.py

from rest_framework.routers import DefaultRouter
from .views import SaleViewSet, CustomerViewSet

router = DefaultRouter()
router.register("sales", SaleViewSet, basename="sale")
router.register("customers", CustomerViewSet, basename="customer")

urlpatterns = router.urls
