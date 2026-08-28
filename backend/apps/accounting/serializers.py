# backend/apps/accounting/serializers.py

from rest_framework import serializers
from .models import Account, JournalEntry, JournalEntryLine
from .services import get_account_balance


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ["id", "code", "name", "account_type", "is_active", "balance"]

    def get_balance(self, obj):
        return get_account_balance(obj)


class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = ["id", "account", "account_code",
                  "account_name", "debit", "credit"]


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    branch_code = serializers.CharField(source="branch.code", read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            "id", "branch", "branch_code", "entry_date", "description",
            "reference_type", "reference_id", "lines",
        ]
