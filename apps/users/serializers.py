from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "password"]

    def validate_email(self, value: str) -> str:
        """Normalize email to lowercase."""
        return value.lower()

    def create(self, validated_data: dict) -> User:
        """Delegate user creation to the service layer."""
        from apps.users.services import create_user

        return create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Read-only serializer for user profile data."""

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "date_joined"]
        read_only_fields = fields
