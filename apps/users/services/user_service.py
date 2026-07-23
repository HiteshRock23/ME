from django.contrib.auth import get_user_model

User = get_user_model()


def create_user(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
) -> User:
    """
    Create a new user account.

    Business logic for user registration lives here,
    not in serializers or views.
    """
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    return user
