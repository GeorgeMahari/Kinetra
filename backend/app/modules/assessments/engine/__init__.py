"""Kinetra assessment engine: pure, deterministic, versioned.

No FastAPI, no SQLAlchemy, no randomness. Given validated inputs and the context they were
measured in, it returns indicators tagged with provenance and — only where a cited reference
covers the person — an interpretation. See docs/SCIENCE.md.
"""

ENGINE_VERSION = "engine-1"
