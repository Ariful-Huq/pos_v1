# backend/config/urls.py

"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/auth/token/", TokenObtainPairView.as_view(),
         name="token_obtain_pair"),
    path("api/auth/token/refresh/",
         TokenRefreshView.as_view(), name="token_refresh"),

    path("api/authz/", include("apps.authz.urls")),
    path("api/catalog/", include("apps.catalog.urls")),
    path("api/sales/", include("apps.sales.urls")),
    path("api/purchases/", include("apps.purchases.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/expenses/", include("apps.expenses.urls")),
    path("api/staff/", include("apps.staff.urls")),
    path("api/accounting/", include("apps.accounting.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/tenants/", include("apps.tenants.urls")),
]
