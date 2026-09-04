from rest_framework import serializers

from .models import Address, Cart, CartItem, CustomerAccount, Order, OrderItem, Payment


class CustomerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomerAccount
        fields = ["id", "email", "full_name", "phone", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        customer = CustomerAccount(**validated_data)
        customer.set_password(password)
        customer.save()
        return customer


class CustomerLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "label", "full_name", "phone", "line1", "line2", "city", "area", "is_default"]


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_name", "variant", "quantity", "unit_price_snapshot"]
        read_only_fields = ["unit_price_snapshot"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "status", "items", "total"]

    def get_total(self, obj):
        return sum((i.unit_price_snapshot * i.quantity for i in obj.items.all()), 0)


class CheckoutSerializer(serializers.Serializer):
    # Either pass shipping_address_id (a saved address, e.g. a logged-in
    # customer picking one from their account) OR shipping_address (inline
    # dict, the guest-checkout path — one step, no separate "save address
    # first" round trip).
    shipping_address_id = serializers.UUIDField(required=False)
    shipping_address = AddressSerializer(required=False)
    payment_method = serializers.ChoiceField(choices=["cod", "bkash", "nagad", "card"])
    guest_email = serializers.EmailField(required=False, allow_blank=True)
    guest_phone = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if not data.get("shipping_address_id") and not data.get("shipping_address"):
            raise serializers.ValidationError(
                "Provide either shipping_address_id or shipping_address."
            )
        return data


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "variant", "product_name_snapshot", "unit_price_snapshot", "quantity"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "method", "status", "amount", "provider_reference"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "subtotal", "total",
            "guest_email", "guest_phone", "items", "payments", "created_at",
        ]


class CategoryPublicSerializer(serializers.Serializer):
    """Deliberately not a ModelSerializer against apps.catalog.serializers'
    CategorySerializer — that one exposes `organization` (fine internally,
    unnecessary on a public endpoint). Minimal public shape instead."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    parent = serializers.UUIDField(source="parent_id", allow_null=True)
