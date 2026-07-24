from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.users.managers import UserManager


class User(AbstractUser):
    """
    Custom User model that uses email for authentication instead of username.

    Inherits from AbstractUser to keep all built-in fields (is_staff,
    is_active, date_joined, etc.) and Django admin compatibility.
    """

    username = None
    email = models.EmailField("email address", unique=True)
    first_name = models.CharField("first name", max_length=150)
    last_name = models.CharField("last name", max_length=150)

    # Google Authentication
    google_sub = models.CharField(max_length=255, blank=True, null=True, unique=True)
    google_picture = models.URLField(max_length=1024, blank=True, null=True)
    google_last_login = models.DateTimeField(blank=True, null=True)

    USERNAME_FIELD = "email"

    # REQUIRED_FIELDS is used by createsuperuser command.
    # email is already required via USERNAME_FIELD so we don't list it here.
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self) -> str:
        return self.email
