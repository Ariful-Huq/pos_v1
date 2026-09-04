from django.urls import path

from . import views

app_name = "ecommerce"

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),

    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/<slug:slug>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("categories/", views.CategoryListView.as_view(), name="category-list"),

    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/items/<uuid:item_id>/", views.CartItemDetailView.as_view(), name="cart-item-detail"),

    path("checkout/", views.CheckoutView.as_view(), name="checkout"),

    path("orders/", views.OrderListView.as_view(), name="order-list"),
    path("orders/<uuid:pk>/", views.OrderDetailView.as_view(), name="order-detail"),
]
