# backend/apps/ecommerce/admin.py

from django.contrib import admin

from .models import Address, Cart, CartItem, CustomerAccount, HomeBanner, Order, OrderItem, Payment


@admin.register(CustomerAccount)
class CustomerAccountAdmin(admin.ModelAdmin):
    list_display = ("email", "full_name", "phone", "is_active", "created_at")
    search_fields = ("email", "full_name", "phone")


@admin.register(HomeBanner)
class HomeBannerAdmin(admin.ModelAdmin):
    """The intended day-to-day workflow for swapping in a new sale/promo
    banner: add a row here with the image + copy, optionally set
    starts_at/ends_at, save. No deploy needed — the storefront home page
    picks it up on its next fetch (cached at most 60s, see app/page.jsx)."""
    list_display = ("title", "organization", "is_active", "starts_at", "ends_at", "sort_order")
    list_filter = ("organization", "is_active")
    list_editable = ("is_active", "sort_order")
    search_fields = ("title", "subtitle")


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("full_name", "city", "customer", "is_default")


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "customer", "session_key", "created_at")
    list_filter = ("status",)
    inlines = [CartItemInline]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "status", "customer",
                    "fulfillment_branch", "total", "created_at")
    list_filter = ("status", "fulfillment_branch")
    search_fields = ("order_number", "guest_email", "guest_phone")
    inlines = [OrderItemInline, PaymentInline]
