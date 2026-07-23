"""
Django settings for the ME project.

AI-powered personal memory application.
"""

from datetime import timedelta
from pathlib import Path

from decouple import config, Csv

# =============================================================================
# PATH CONFIGURATION
# =============================================================================

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# =============================================================================
# SECURITY
# =============================================================================

SECRET_KEY = config("SECRET_KEY")

GOOGLE_CLIENT_ID = config("GOOGLE_CLIENT_ID", default="")
GOOGLE_CLIENT_SECRET = config("GOOGLE_CLIENT_SECRET", default="")

DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="", cast=Csv())

# Cross-Origin-Opener-Policy for OAuth/GIS popups
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups"


# =============================================================================
# APPLICATION DEFINITION
# =============================================================================

INSTALLED_APPS = [
    # Django built-in
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    # Local apps
    "apps.users",
    "apps.memories",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# =============================================================================
# DATABASE
# =============================================================================
# Using PostgreSQL as specified in architecture.
# pgvector extension will be added in a future milestone.

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

# =============================================================================
# PASSWORD VALIDATION
# =============================================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# =============================================================================
# INTERNATIONALIZATION
# =============================================================================

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

# =============================================================================
# STATIC FILES
# =============================================================================
# collectstatic will gather files into STATIC_ROOT for production (Nginx).

STATIC_URL = "/static/"

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

STATIC_ROOT = BASE_DIR / "staticfiles"

# =============================================================================
# MEDIA FILES
# =============================================================================
# User-uploaded content (profile images, documents, etc.)

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"

# =============================================================================
# DJANGO REST FRAMEWORK
# =============================================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "PAGE_SIZE": 20,
}

# =============================================================================
# AUTHENTICATION
# =============================================================================

AUTH_USER_MODEL = "users.User"

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# =============================================================================
# DEFAULT PRIMARY KEY FIELD TYPE
# =============================================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =============================================================================
# SUPERMEMORY CONFIGURATION (Memory Engine)
# =============================================================================
SUPERMEMORY_URL = config("SUPERMEMORY_URL", default="http://195.35.6.26:6767")
SUPERMEMORY_API_KEY = config("SUPERMEMORY_API_KEY", default="")
SUPERMEMORY_TIMEOUT = config("SUPERMEMORY_TIMEOUT", default=10, cast=int)


# =============================================================================
# AI CONFIGURATION
# =============================================================================
AI_API = config('AI_API', default='')
AI_MODEL = config('AI_MODEL', default='meta/llama-3.1-8b-instruct')
LLM_PROVIDER = config('LLM_PROVIDER', default='mock')

# =============================================================================
# LOGGING
# =============================================================================
# Structured, production-safe logging configuration.
#
# Security rules enforced here:
#   - HTTP request/response detail blocks are emitted at DEBUG level only.
#     Because _log_request/_log_response check settings.DEBUG before calling
#     logger.debug(), they are fully silent when DEBUG=False — regardless of
#     the level set here.
#   - Headers, API keys, and authentication tokens are NEVER logged anywhere.
# =============================================================================

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            # e.g. 2026-07-17 17:38:07 INFO     apps.memories.services.supermemory_service: ...
            "format": "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "loggers": {
        # Supermemory integration — DEBUG enables request/response blocks in dev.
        # In production (DEBUG=False) those blocks never fire; only ERROR logs surface.
        "apps.memories.services.supermemory_service": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        # Capture pipeline, ask service, search service, etc.
        "apps.memories": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # Suppress Django's own verbose internal logs below WARNING.
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

