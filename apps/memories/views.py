from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.memories.models import Memory
from apps.memories.serializers import CaptureSerializer, MemoryReadSerializer
from apps.memories.services.search_service import perform_search, SearchServiceError
from apps.memories.services.exceptions import SupermemoryError


class CaptureView(generics.CreateAPIView):
    """
    POST /api/memories/capture/

    Capture a new memory. Accepts raw_content only.
    Returns the saved memory with status="pending".

    This is the entry point of the Capture pipeline.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CaptureSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        memory = serializer.save()

        return Response(
            MemoryReadSerializer(memory).data,
            status=status.HTTP_201_CREATED,
        )


from rest_framework.pagination import CursorPagination

class MemoryCursorPagination(CursorPagination):
    ordering = "-created_at"


class MemoryListView(generics.ListAPIView):
    """
    GET /api/memories/

    List the authenticated user's memories, newest first.
    No filters — retrieval is handled by semantic search (future milestone).
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MemoryReadSerializer
    pagination_class = None

    def get_queryset(self):
        return Memory.objects.filter(user=self.request.user)


class MemoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/memories/<id>/  — retrieve a single memory
    PATCH  /api/memories/<id>/  — update link_title (only for link memories)
    DELETE /api/memories/<id>/  — delete a memory

    Scoped to the authenticated user — returns 404 for other users' memories.
    """

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            from apps.memories.serializers import MemoryUpdateSerializer
            return MemoryUpdateSerializer
        return MemoryReadSerializer

    def get_queryset(self):
        return Memory.objects.filter(user=self.request.user)

class SearchView(generics.GenericAPIView):
    """
    GET /api/search/?q=<query>
    
    Search memories using Supermemory Local semantic engine.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        query = request.query_params.get("q", "").strip()
        
        if not query:
            return Response({"error": "Search query cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            results = perform_search(request.user, query)
            return Response({"results": results}, status=status.HTTP_200_OK)
        except SearchServiceError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except SupermemoryError as e:
            return Response({"error": "Semantic search is currently unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({"error": "An unexpected error occurred during search."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AskView(generics.GenericAPIView):
    """
    POST /api/ask/
    
    Ask a natural language question about the user's memories.
    Uses RAG to generate an answer grounded in their memories.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        question = request.data.get("question", "").strip()
        if not question:
            return Response({"error": "Question cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
            
        from apps.memories.services.ask_service import AskService, AskServiceError
        
        try:
            response_data = AskService.ask_question(request.user, question)
            return Response(response_data, status=status.HTTP_200_OK)
        except AskServiceError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except SupermemoryError as e:
            return Response({"error": "Retrieval engine is currently unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({"error": "An unexpected error occurred while generating the answer."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
