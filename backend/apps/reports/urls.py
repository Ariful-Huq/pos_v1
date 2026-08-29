# backend/apps/reports/urls.py

from django.urls import path
from .views import DashboardSummaryView, TopProductsView

urlpatterns = [
    path("summary/", DashboardSummaryView.as_view(), name="reports-summary"),
    path("top-products/", TopProductsView.as_view(), name="reports-top-products"),
]
