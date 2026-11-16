"""Import every model module here so Alembic autogenerate sees the full metadata."""

from app.core.db import Base
from app.modules.assessments import models as assessments_models  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.consent import models as consent_models  # noqa: F401
from app.modules.onboarding import models as onboarding_models  # noqa: F401
from app.modules.personalization import models as personalization_models  # noqa: F401
from app.modules.plans import models as plans_models  # noqa: F401
from app.modules.progression import models as progression_models  # noqa: F401
from app.modules.users import models as users_models  # noqa: F401

__all__ = ["Base"]
