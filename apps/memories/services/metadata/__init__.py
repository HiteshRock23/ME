"""
Metadata package.

This package contains deterministic metadata extractors for each memory type.
Extractors never call AI, never call external APIs, and never modify the database.

Architecture:
    MetadataService          — dispatcher, routes by memory type
    LinkMetadataExtractor    — handles LINK memories
    (future) ImageMetadataExtractor, PDFMetadataExtractor, etc.
"""
