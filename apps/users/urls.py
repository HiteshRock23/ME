from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings

from apps.users.views import LogoutView, MeView, RegisterView, GoogleLoginView, GoogleConfigView

app_name = "users"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("google/config/", GoogleConfigView.as_view(), name="google-config"),
]
