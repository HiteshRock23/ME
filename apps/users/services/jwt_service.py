from rest_framework_simplejwt.tokens import RefreshToken
from typing import Dict, Any

def get_tokens_for_user(user) -> Dict[str, Any]:
    """
    Generate standard access and refresh tokens for a user
    using the existing SimpleJWT configuration.
    """
    refresh = RefreshToken.for_user(user)

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }
