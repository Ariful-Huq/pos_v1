# backend/apps/staff/serializers.py

from rest_framework import serializers
from .models import StaffProfile


class StaffProfileSerializer(serializers.ModelSerializer):
    """Read/update serializer — does NOT handle account creation (username/
    password), since that spans both User and StaffProfile. See views.py
    create() for that. This serializer is used for list/retrieve/update."""
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="user.email", read_only=True)
    primary_branch_name = serializers.CharField(
        source="primary_branch.name", read_only=True, default=None)

    class Meta:
        model = StaffProfile
        fields = [
            "id", "username", "full_name", "email", "employee_id", "phone",
            "designation", "primary_branch", "primary_branch_name",
            "date_joined", "is_active",
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
