import asyncio
import contextlib
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import SecurityMiddleware
from app.modules.assessments.router import router as assessments_router
from app.modules.auth.router import router as auth_router
from app.modules.consent.jobs import purge_forever
from app.modules.consent.router import me_router as consent_me_router
from app.modules.consent.router import public_router as consent_public_router
from app.modules.devices.router import router as devices_router
from app.modules.health.router import API_VERSION
from app.modules.health.router import router as health_router
from app.modules.insights.router import router as insights_router
from app.modules.onboarding.router import catalog_router
from app.modules.onboarding.router import router as onboarding_router
from app.modules.personalization.router import router as personalization_router
from app.modules.plans.router import router as plans_router
from app.modules.progression.router import router as progression_router
from app.modules.users.router import router as users_router


def create_app(background_jobs: bool = True) -> FastAPI:
    """`background_jobs=False` in tests: the hourly purge must never touch the development database."""
    settings = get_settings()
    configure_logging(settings.log_level)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        task = asyncio.create_task(purge_forever()) if background_jobs else None
        yield
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    production = settings.environment == "production"
    app = FastAPI(
        lifespan=lifespan,
        title="Kinetra API",
        version=API_VERSION,
        description="Personal physical wellness assessment platform. "
        "Provides general wellness information, not medical diagnosis.",
        # The interactive API explorer is a development tool, not a public surface.
        docs_url=None if production else "/docs",
        redoc_url=None if production else "/redoc",
        openapi_url=None if production else "/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Accept-Language"],
    )
    # Outermost: size limit and security headers apply to every response, errors and CORS included.
    app.add_middleware(SecurityMiddleware, hsts=production)
    register_error_handlers(app)
    for router in (
        health_router,
        auth_router,
        users_router,
        consent_me_router,
        consent_public_router,
        catalog_router,
        onboarding_router,
        assessments_router,
        insights_router,
        progression_router,
        plans_router,
        personalization_router,
        devices_router,
    ):
        app.include_router(router, prefix=settings.api_prefix)
    return app


app = create_app()
