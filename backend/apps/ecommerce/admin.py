# backend/apps/ecommerce/admin.py

from django.contrib import admin

from .models import Address, Cart, CartItem, CustomerAccount, Order, OrderItem, Payment


@admin.register(CustomerAccount)
class CustomerAccountAdmin(admin.ModelAdmin):
    list_display = ("email", "full_name", "phone", "is_active", "created_at")
    search_fields = ("email", "full_name", "phone")


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
