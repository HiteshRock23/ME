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
        
        from apps.memories.services.exceptions import DuplicateMemoryError
        
        try:
            memory = serializer.save()
            return Response(
                MemoryReadSerializer(memory).data,
                status=status.HTTP_201_CREATED,
            )
        except DuplicateMemoryError as e:
            return Response(
                {
                    "error": "You've already saved this link.",
                    "existing_memory": MemoryReadSerializer(e.memory).data
                },
                status=status.HTTP_409_CONFLICT,
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
    PATCH  /api/memories/<id>/  — update link_title and/or raw_content
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


class RelatedMemoriesView(generics.GenericAPIView):
    """
    GET /api/memories/<id>/related/

    Retrieve semantically related memories for a given memory.
    Target memory ID is excluded from the returned list.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int, *args, **kwargs):
        try:
            target_memory = Memory.objects.get(pk=pk, user=request.user)
        except Memory.DoesNotExist:
            return Response({"error": "Memory not found."}, status=status.HTTP_404_NOT_FOUND)

        query = target_memory.ai_title or target_memory.ai_summary or target_memory.raw_content[:200]
        if not query:
            return Response({"results": []}, status=status.HTTP_200_OK)

        from apps.memories.services.retrieval_pipeline import RetrievalPipeline, RetrievalConfig
        
        try:
            config = RetrievalConfig(min_confidence_score=0.40, max_results=5)
            dtos = RetrievalPipeline.execute(request.user, query, config=config)
            filtered = [mem.to_dict() for mem in dtos if mem.id != target_memory.id][:3]
            return Response({"results": filtered}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"results": []}, status=status.HTTP_200_OK)


from rest_framework.throttling import AnonRateThrottle

class AnalyzeLinkThrottle(AnonRateThrottle):
    rate = '10/min'

class AnalyzeLinkDayThrottle(AnonRateThrottle):
    rate = '50/day'

class AnalyzeLinkView(generics.GenericAPIView):
    """
    POST /api/memories/analyze-link/

    Public endpoint to analyze a URL and generate a rich preview.
    Uses LinkAnalysisService which validates the URL and returns a PendingCapture ID.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnalyzeLinkThrottle, AnalyzeLinkDayThrottle]

    def post(self, request, *args, **kwargs):
        url = request.data.get("url", "").strip()
        
        from apps.memories.services.link_intelligence.analysis_service import LinkAnalysisService
        from rest_framework.exceptions import ValidationError
        
        try:
            result = LinkAnalysisService.analyze_public_link(url)
            return Response(result, status=status.HTTP_200_OK)
        except ValidationError as e:
            # We want to return exactly what LinkAnalysisService raised
            return Response({"error": str(e.detail[0] if isinstance(e.detail, list) else e.detail)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


from django.db import transaction
from django.utils import timezone


class MemoryPinView(generics.GenericAPIView):
    """
    POST /api/memories/<pk>/pin/

    Pins an existing memory if current pinned count < 5.
    Returns 400 with a friendly error if 5 memories are already pinned.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int, *args, **kwargs):
        try:
            with transaction.atomic():
                memory = Memory.objects.select_for_update().get(pk=pk, user=request.user)
                if memory.pinned_at is not None:
                    return Response(MemoryReadSerializer(memory).data, status=status.HTTP_200_OK)

                current_pinned_count = Memory.objects.filter(user=request.user, pinned_at__isnull=False).select_for_update().count()
                if current_pinned_count >= 5:
                    return Response(
                        {"error": "You can pin up to 5 memories. Unpin one to pin another."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                memory.pinned_at = timezone.now()
                memory.save(update_fields=["pinned_at", "updated_at"])
                return Response(MemoryReadSerializer(memory).data, status=status.HTTP_200_OK)

        except Memory.DoesNotExist:
            return Response({"error": "Memory not found."}, status=status.HTTP_404_NOT_FOUND)


class MemoryUnpinView(generics.GenericAPIView):
    """
    POST /api/memories/<pk>/unpin/

    Unpins an existing memory.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int, *args, **kwargs):
        try:
            memory = Memory.objects.get(pk=pk, user=request.user)
            if memory.pinned_at is not None:
                memory.pinned_at = None
                memory.save(update_fields=["pinned_at", "updated_at"])
            return Response(MemoryReadSerializer(memory).data, status=status.HTTP_200_OK)
        except Memory.DoesNotExist:
            return Response({"error": "Memory not found."}, status=status.HTTP_404_NOT_FOUND)


from django.http import Http404
from apps.memories.serializers import SharedMemorySerializer
from apps.memories.services import share_service


class MemoryShareView(generics.GenericAPIView):
    """
    POST   /api/memories/<pk>/share/ — Enable knowledge sharing for a memory
    DELETE /api/memories/<pk>/share/ — Revoke knowledge sharing for a memory
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int, *args, **kwargs):
        try:
            memory = Memory.objects.get(pk=pk, user=request.user)
            share_data = share_service.share_memory(memory, request=request)
            return Response(share_data, status=status.HTTP_200_OK)
        except Memory.DoesNotExist:
            return Response({"error": "Memory not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk: int, *args, **kwargs):
        try:
            memory = Memory.objects.get(pk=pk, user=request.user)
            share_data = share_service.revoke_memory_share(memory)
            return Response(share_data, status=status.HTTP_200_OK)
        except Memory.DoesNotExist:
            return Response({"error": "Memory not found."}, status=status.HTTP_404_NOT_FOUND)


class MemoryShareRegenerateView(generics.GenericAPIView):
    """
    POST /api/memories/<pk>/share/regenerate/

    Regenerates a share link, invalidating any existing link immediately.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int, *args, **kwargs):
        try:
            memory = Memory.objects.get(pk=pk, user=request.user)
            share_data = share_service.regenerate_share_link(memory, request=request)
            return Response(share_data, status=status.HTTP_200_OK)
        except Memory.DoesNotExist:
            return Response({"error": "Memory not found."}, status=status.HTTP_404_NOT_FOUND)


class PublicSharedMemoryView(generics.RetrieveAPIView):
    """
    GET /api/shared/<token>/

    Public unauthenticated endpoint to retrieve a shared memory.
    Exposes strictly public fields via SharedMemorySerializer.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = SharedMemorySerializer

    def get_object(self):
        token = self.kwargs.get("token")
        try:
            return share_service.get_shared_memory(token)
        except share_service.SharedMemoryNotFoundError:
            raise Http404("Shared memory not found or link has been revoked.")

