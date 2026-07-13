# Memory Enrichment Architecture

The ME Memory Enrichment Engine automatically enhances captured memories with AI-generated metadata (titles and summaries) without slowing down the user's experience.

## Architecture

The enrichment process uses a decoupled, background-worker model:
1. **Source of Truth**: PostgreSQL always stores the original `raw_content`. AI output is completely optional metadata.
2. **Asynchronous Processing**: The Django API saves the memory and immediately returns it to the user. It does not wait for AI generation.
3. **Background Worker**: A standalone process (`enrich_worker`) polls the database for pending memories and orchestrates the enrichment via the `MemoryEnrichmentService`.
4. **Provider Abstraction**: A standard `LLMProvider` interface hides the complexity of talking to OpenAI, Gemini, Ollama, etc.

## Worker Lifecycle

For V1, ME uses a lightweight custom worker instead of Celery:
```bash
python manage.py enrich_worker
```
This loop runs continuously:
1. Finds the oldest memory with `ai_status=PENDING`.
2. Marks it `PROCESSING`.
3. Calls the enrichment service.
4. Updates to `READY` or `FAILED`.
5. Sleeps to prevent CPU spin when idle.

*Future Migration: This command can easily be replaced by a Celery worker without changing the core business logic in `MemoryEnrichmentService`.*

## Provider Abstraction

Located in `apps/memories/services/ai/`, the system supports a pluggable provider model.
* `base.py`: Defines the `LLMProvider` interface.
* `factory.py`: Determines which provider to load based on the `LLM_PROVIDER` environment variable.
* `providers/`: Specific implementations. By default, a `MockProvider` simulates AI if no real keys are configured.

## Prompt Design

The prompt forces strict determinism and valid JSON output:
```text
You are organizing a user's personal memory.

Generate:
1. A short descriptive title. Maximum 10 words.
2. A concise factual summary. Maximum 2 sentences.

Never invent facts. Never assume context. Never change the meaning.
If the memory is too short to summarize, return the original memory as the summary.
Return ONLY valid JSON.

Memory:
{raw_memory}
```

## Validation

The LLM output is strictly validated by `MemoryEnrichmentService`:
1. It must parse cleanly as JSON.
2. It must contain the `title` and `summary` strings.
If validation fails, the memory is safely marked as `FAILED`. Invalid metadata is never saved.

## Failure Recovery & Retry Strategy

Network failures or hallucinations happen. When they do, the `ai_status` becomes `FAILED` and the error is logged in `ai_last_error`.

To recover these failures, administrators can run:
```bash
python manage.py enrich_memories
```
This command finds all memories that aren't `READY` (including `FAILED`) and attempts to process them in bulk. It prints a summary of successes and failures.
