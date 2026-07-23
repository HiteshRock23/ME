import logging
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests
from django.utils import timezone
from apps.users.models import User
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

class GoogleAuthService:
    def __init__(self):
        self.client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
        if not self.client_id:
            raise ImproperlyConfigured("GOOGLE_CLIENT_ID must be set in settings.")
            
    def verify_token(self, credential: str) -> dict:
        """
        Verify the Google ID Token and extract its claims.
        """
        try:
            # Specify the CLIENT_ID of the app that accesses the backend
            idinfo = id_token.verify_oauth2_token(credential, requests.Request(), self.client_id)
            
            # Check if email is verified
            if not idinfo.get("email_verified"):
                logger.warning(f"Google auth failed: Email not verified. Payload: {idinfo}")
                raise ValueError("Google account email must be verified.")
            
            return idinfo
        except ValueError as e:
            # Invalid token
            logger.warning(f"Google token verification failed: {e}")
            raise e
        except Exception as e:
            logger.exception("Unexpected error verifying Google token.")
            raise ValueError("Failed to verify Google token.")

    def get_or_create_user(self, idinfo: dict) -> User:
        """
        Find an existing user or create a new one based on Google ID Info.
        """
        google_sub = idinfo.get("sub")
        email = idinfo.get("email")
        first_name = idinfo.get("given_name", "")
        last_name = idinfo.get("family_name", "")
        picture = idinfo.get("picture")

        if not email:
            raise ValueError("Google token missing email address.")
            
        if not google_sub:
            raise ValueError("Google token missing subject ID.")

        # Try to find by google_sub first
        user = User.objects.filter(google_sub=google_sub).first()
        
        if user:
            # Link/Update existing Google user
            user.google_last_login = timezone.now()
            if picture and user.google_picture != picture:
                user.google_picture = picture
            user.save(update_fields=["google_last_login", "google_picture"])
            logger.info(f"Existing Google user logged in: {user.email}")
            return user

        # Try to find by email
        user = User.objects.filter(email=email).first()
        if user:
            # Link Google account to existing email user
            user.google_sub = google_sub
            user.google_picture = picture
            user.google_last_login = timezone.now()
            user.save(update_fields=["google_sub", "google_picture", "google_last_login"])
            logger.info(f"Existing email user linked to Google account: {user.email}")
            return user
            
        # Create new user
        user = User.objects.create(
            email=email,
            first_name=first_name,
            last_name=last_name,
            google_sub=google_sub,
            google_picture=picture,
            google_last_login=timezone.now(),
        )
        # Marking password as unusable since they use Google
        user.set_unusable_password()
        user.save()
        logger.info(f"New Google user created: {user.email}")
        
        return user
