# AI Pipeline — Architecture Documentation

## Overview

ME uses AI to **understand** captured memories. When a user captures a thought, the AI generates a concise title and a useful summary. The user's raw memory is the source of truth — AI metadata is an enhancement that is never allowed to replace or modify the original content.

This is the **Understand** stage of the Capture → Understand → Retrieve pipeline.

---

## Pipeline Flow

```
User captures a thought
        ↓
CaptureView (HTTP layer)
        ↓
CaptureSerializer (validation)
        ↓
capture_memory() — Capture Service
    │
    ├── 1. Save raw memory (status=PENDING)
    │
    ├── 2. Call AIService.generate_metadata()
    │       │
    │       ├── Construct prompt
    │       ├── Call LLMClient.generate()
    │       │       │
    │       │       ├── Send to NVIDIA API (OpenAI-compatible)
    │       │       ├── Retry on failure (3 attempts, exponential backoff)
    │       │       └── Return raw text response
    │       │
    │       ├── Parse JSON response
    │       └── Return AIMetadata(title, summary)
    │
    ├── 3. Update memory (ai_title, ai_summary, status=READY)
    │
    └── On failure: status=FAILED, raw memory preserved
```

---

## Layer Architecture

### CaptureView / CaptureSerializer
- **Responsibility:** HTTP handling, request validation.
- **AI awareness:** None. These layers do not know AI exists.
- **Location:** `apps/memories/views.py`, `apps/memories/serializers.py`

### Capture Service (`capture_service.py`)
- **Responsibility:** Orchestrate the full capture pipeline.
- **AI awareness:** Knows that AI processing exists, but not how it works.
- **Error handling:** Catches all `AIServiceError` exceptions, marks memory as FAILED.
- **Guarantee:** The raw memory is ALWAYS saved before any AI call. If AI fails, the memory is preserved.

### AI Service (`ai_service.py`)
- **Responsibility:** Construct prompts, call the LLM, parse responses.
- **AI awareness:** Knows about prompt engineering and response format. Does NOT know about the Memory model.
- **Output:** Returns `AIMetadata(title, summary)` — a clean data structure.

### LLM Client (`llm_client.py`)
- **Responsibility:** Raw API communication with any OpenAI-compatible endpoint.
- **AI awareness:** None — it just sends messages and returns text.
- **Features:** Retry with exponential backoff, timeout handling, typed exceptions.
- **Current provider:** NVIDIA's `z-ai/glm-5.2` via `https://integrate.api.nvidia.com/v1`

### Exceptions (`exceptions.py`)
- **`AIServiceError`** — base for all AI failures
- **`LLMConfigError`** — missing/invalid API key
- **`LLMAPIError`** — API call failed (timeout, network, rate limit)
- **`AIProcessingError`** — response parsing failed

---

## Error Handling

| Failure | What Happens | Memory Status |
|---|---|---|
| Missing API key | `LLMConfigError` raised, caught by capture service | `FAILED` |
| Invalid API key | `LLMConfigError` raised on auth failure | `FAILED` |
| Network failure | 3 retries with backoff, then `LLMAPIError` | `FAILED` |
| Timeout | 3 retries with backoff, then `LLMAPIError` | `FAILED` |
| Rate limiting | 3 retries with backoff, then `LLMAPIError` | `FAILED` |
| Invalid JSON response | `AIProcessingError` raised | `FAILED` |

**In every failure case:**
- The raw memory is preserved in the database.
- The error is logged with full context.
- The application never crashes.
- The API returns 201 with the memory (status=FAILED).

---

## Configuration

All configuration is via environment variables (loaded by `python-decouple`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_API` | Yes | — | API key for the LLM provider |
| `AI_BASE_URL` | No | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible API endpoint |
| `AI_MODEL` | No | `z-ai/glm-5.2` | Model name |
| `AI_MAX_RETRIES` | No | `3` | Max retry attempts |
| `AI_TIMEOUT` | No | `30` | Request timeout in seconds |

---

## Prompt Design

The prompt instructs the LLM to:
- Generate a concise title (under 10 words)
- Generate a useful summary (1-3 sentences)
- Return ONLY a JSON object: `{"title": "...", "summary": "..."}`
- Never invent facts
- Never hallucinate
- Never rewrite the user's memory
- Never change dates, names, or numbers

---

## Future: Supermemory Integration

The current architecture is designed to accommodate future expansion:

```
capture_memory()
    ├── Save raw memory
    ├── AIService.generate_metadata()     ← Current milestone
    ├── EmbeddingService.generate()       ← Future milestone
    └── SupermemoryService.index()        ← Future milestone
```

Each future service follows the same pattern:
1. Create a dedicated service module
2. Call it from `capture_memory()`
3. Catch failures independently — one service failing doesn't affect others
4. The raw memory is always preserved

The `LLMClient` is reusable — future milestones can use it for embeddings, Q&A, or any other LLM task without modification.
