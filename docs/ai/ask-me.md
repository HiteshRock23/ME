# Ask ME (Grounded RAG Assistant)

The Ask ME feature allows users to query their personal memories using natural language. It is built as a strictly grounded Retrieval-Augmented Generation (RAG) pipeline. The LLM acts purely as a synthesizer for retrieved information, preventing hallucination.

## Architecture

The pipeline is split into distinct, single-responsibility services:

1.  **AskView (`POST /api/ask/`)**: Receives the user question and returns the structured response.
2.  **AskService (`apps.memories.services.ask_service`)**: The central orchestrator.
3.  **SearchService (`apps.memories.services.search_service`)**: Queries Supermemory Local for semantically relevant memories.
4.  **ContextBuilder (`apps.memories.services.context_builder`)**: Formats retrieved `Memory` models into a structured string for the LLM.
5.  **LLMProvider (`apps.memories.services.ai.providers`)**: Interface for LLM communication.

## RAG Pipeline Flow

1.  **Retrieval**: `AskService` calls `SearchService`.
2.  **Ranking & Thresholding**: Supermemory returns results with a semantic relevance score. `AskService` enforces a strict threshold (e.g., `0.60`).
3.  **Empty State**: If no memories pass the threshold, the pipeline halts immediately, returning an empty state without calling the LLM.
4.  **Context Building**: `ContextBuilder` formats the top memories (up to a limit, e.g., 5) into deterministic text blocks.
5.  **LLM Generation**: The prompt strictly instructs the LLM to answer using *only* the context and to output JSON.
6.  **Source Attribution**: The backend maps the LLM response to the exact `Memory` objects used to build the context. This guarantees 100% trustworthy source attribution because the LLM is not trusted to cite sources itself.

## Failure Handling

*   **Empty Question**: Returns 400 Bad Request.
*   **Search Failure (Supermemory Down)**: Returns 503 Service Unavailable.
*   **LLM Timeout/Failure**: Returns 400 Bad Request.
*   **Invalid JSON from LLM**: Returns 400 Bad Request. The raw LLM response is never exposed to the client.

## Future Improvements

*   **Conversational Memory**: Implement chat history (multi-turn RAG).
*   **Dynamic Thresholding**: Adjust the relevance threshold based on the question length or density.
*   **Hybrid Search**: Combine semantic search with keyword search (BM25) for better retrieval.
