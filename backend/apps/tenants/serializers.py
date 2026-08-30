# backend/apps/tenants/serializers.py

from rest_framework import serializers
from .models import Organization, Branch


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "legal_name",
                  "contact_email", "contact_phone", "is_active"]


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "code", "address", "phone", "is_active"]
