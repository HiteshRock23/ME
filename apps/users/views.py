from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings

from apps.users.serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/

    Create a new user account and return JWT tokens.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens for the newly registered user
        # so they don't need to login separately after registering.
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Blacklist the refresh token to invalidate the session.
    Requires: { "refresh": "<refresh_token>" }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"detail": "Successfully logged out."},
            status=status.HTTP_200_OK,
        )


class MeView(generics.RetrieveAPIView):
    """
    GET /api/auth/me/

    Return the authenticated user's profile.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

from apps.users.serializers import GoogleLoginSerializer
from apps.users.services.google_auth import GoogleAuthService
from apps.users.services.jwt_service import get_tokens_for_user

class GoogleLoginView(APIView):
    """
    POST /api/auth/google/

    Authenticate a user via Google Identity Services.
    Requires: { "credential": "<Google ID Token>" }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        print("[BACKEND TRACE] GoogleLoginView.post reached. Request data keys:", list(request.data.keys()))
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        credential = serializer.validated_data["credential"]
        print("[BACKEND TRACE] Received credential token (first 20 chars):", credential[:20] if credential else "None")
        
        try:
            auth_service = GoogleAuthService()
            idinfo = auth_service.verify_token(credential)
            print("[BACKEND TRACE] Token verified successfully for email:", idinfo.get("email"))
            user = auth_service.get_or_create_user(idinfo)
            print("[BACKEND TRACE] User authenticated/created:", user.id, user.email)
            
            tokens = get_tokens_for_user(user)
            print("[BACKEND TRACE] Generated JWT tokens successfully for user:", user.email)
            
            return Response(
                {
                    "user": UserSerializer(user).data,
                    "access": tokens["access"],
                    "refresh": tokens["refresh"],
                },
                status=status.HTTP_200_OK,
            )
        except ValueError as e:
            print("[BACKEND TRACE] ValueError in GoogleLoginView:", str(e))
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            print("[BACKEND TRACE] Exception in GoogleLoginView:", str(e))
            return Response({"detail": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GoogleConfigView(APIView):
    """
    GET /api/auth/google/config/
    Returns the Google Client ID for the frontend.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
        if not client_id:
            return Response({"detail": "Google Client ID not configured."}, status=status.HTTP_501_NOT_IMPLEMENTED)
        return Response({"client_id": client_id})

