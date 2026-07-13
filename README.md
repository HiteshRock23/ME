# ME — AI-Powered Personal Memory

An intelligent personal memory application that helps you capture, organize, and recall your thoughts, experiences, and knowledge using AI.

## Tech Stack

- **Backend**: Django + Django REST Framework
- **Database**: PostgreSQL + pgvector
- **AI**: NVIDIA API (z-ai/glm-5.2) via OpenAI-compatible endpoint
- **Frontend**: HTML, CSS, Vanilla JavaScript (SPA)
- **Deployment**: Ubuntu VPS, Gunicorn, Nginx

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- NVIDIA API key ([build.nvidia.com](https://build.nvidia.com))

### Installation

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd ME
   ```

2. **Create and activate virtual environment**

   ```bash
   # Create
   python -m venv venv

   # Activate (Windows)
   venv\Scripts\activate

   # Activate (Linux/Mac)
   source venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**

   Copy `.env.example` to `.env` and update with your values:

   ```
   SECRET_KEY=your-secret-key
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1

   DB_NAME=me_db
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_HOST=localhost
   DB_PORT=5432

   AI_API=your-nvidia-api-key
   ```

5. **Create the PostgreSQL database**

   ```sql
   CREATE DATABASE me_db;
   ```

6. **Run migrations**

   ```bash
   python manage.py migrate
   ```

7. **Start the development server**

   ```bash
   python manage.py runserver
   ```

   Visit `http://127.0.0.1:8000/`

## Project Structure

```
ME/
├── config/                      # Django project settings
│   ├── settings.py              # Main configuration
│   ├── urls.py                  # Root URL routing
│   ├── wsgi.py                  # WSGI entry point
│   └── asgi.py                  # ASGI entry point
├── apps/
│   ├── users/                   # Authentication & user management
│   └── memories/                # Core memory app
│       ├── models.py            # Memory model
│       ├── views.py             # API views
│       ├── serializers.py       # Request/response serializers
│       └── services/            # Business logic
│           ├── capture_service.py   # Capture → Understand pipeline
│           ├── ai_service.py        # AI title/summary generation
│           ├── llm_client.py        # LLM API client (OpenAI-compatible)
│           └── exceptions.py        # Typed exceptions
├── docs/
│   ├── product_principles.md    # Core product philosophy
│   └── ai_pipeline.md           # AI pipeline architecture
├── static/                      # Static files (CSS, JS, images)
├── media/                       # User-uploaded files
├── manage.py                    # Django management script
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variable template
└── .gitignore                   # Git ignore rules
```

## AI Pipeline

When a user captures a memory:

1. Raw memory is saved immediately (source of truth)
2. AI generates a title and summary via NVIDIA API
3. Memory is updated with AI metadata (status: `ready`)
4. If AI fails, memory is preserved (status: `failed`)

See [docs/ai_pipeline.md](docs/ai_pipeline.md) for the full architecture.

## License

Private — All rights reserved.

