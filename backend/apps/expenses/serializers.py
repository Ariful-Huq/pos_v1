# backend/apps/expenses/serializers.py

from rest_framework import serializers
from apps.tenants.models import Branch
from .models import ExpenseCategory, Expense


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ["id", "name", "is_active"]


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name", read_only=True)
    branch_code = serializers.CharField(source="branch.code", read_only=True)
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), required=False)

    class Meta:
        model = Expense
        fields = [
            "id", "branch", "branch_code", "category", "category_name",
            "amount", "expense_date", "payment_method", "description", "receipt_reference",
        ]
