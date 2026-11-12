# Testing strategy

Totals at Milestone 8: **backend 217**, **mobile 119**, all passing.

## Layers

| Layer | What | Where | Database |
|---|---|---|---|
| Pure rules | Engine calculations with hand-computed values, reference band boundaries, coverage edges; onboarding, insights and progression rules | `backend/tests/test_*_rules.py`, `test_engine.py`, `test_security_unit.py` | No |
| API | Each module through HTTP: validation, ownership, history, export, cascade deletion | `backend/tests/test_*_api.py` | `kinetra_test` |
| Migrations | Models and migrations in sync (autogenerate diff is empty), constraints, downgrade and upgrade | `test_migrations.py` | `kinetra_test` |
| HTTP hardening | Headers, 413 for large or chunked bodies, production docs off and HSTS, JWT secret required, no leaked internals | `test_security_hardening.py` | No |
| End-to-end | One user through every module, then deletion leaving zero rows; heavy-account performance budget (400 results, each endpoint < 1 s; measured 19–74 ms) | `test_journey.py` | `kinetra_test` |
| Mobile units | Validation, form parsing, flow logic, recommendation text, chart ticks, stepper | `mobile/src/**/__tests__` | — |
| Mobile components | Forms, result view, series card (tooltip and table view), states, banner, profile map | `__tests__/*-test.tsx` | — |
| Mobile flows | Real route tree: boot, protected routes, sign-in/out routing (regression), onboarding journey with the exact payload, assessment record flow, dashboard, progress, check-in | `src/app/__tests__` | In-memory fake backend |
| Manual / visual | Charts in headless Edge (light and dark); the app on an Android emulator via Expo Go | — | Dev DB |

## Rules for writing tests

- Scientific calculations are tested against values computed by hand, and boundaries are tested
  exactly at the cut-points.
- Every "no interpretation" path is tested (outside the age range, sex not specified, stopped early,
  BMI ≥ 35 for the waist-to-height ratio…), so the product never invents a classification.
- Privacy: each module has an isolation test (user B never sees user A) and is covered by the cascade
  deletion check.
- Mobile flow tests assert the exact request body sent, so a skipped answer stays absent (never `0`).
- Bugs get a regression test first. For example, `auth-routing-test.tsx` reproduced the "Unmatched Route"
  after sign-in before the fix.

## Running

```bash
# backend (DB tests need POSTGRES_PASSWORD and the db container; they wipe kinetra_test only)
cd backend && pytest && ruff check app tests alembic && mypy app && pip-audit --skip-editable

# mobile
cd mobile && npm test && npm run typecheck && npx expo-doctor
```

Run backend suites one at a time: two concurrent runs against `kinetra_test` will block each other,
because each run drops and recreates the schema.
