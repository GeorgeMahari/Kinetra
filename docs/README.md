# Kinetra documentation

Start with **ARCHITECTURE** if you are new to the codebase, and with **DECISIONS** to learn why things are
the way they are.

## How the system works (kept current)

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Backend domains and their dependency direction, mobile folder roles and conventions, routes, error contract |
| [DECISIONS.md](DECISIONS.md) | Every product and technical decision (D1–D45), with its reason |
| [SCIENCE.md](SCIENCE.md) | Screening, tests, norms, recommendations, plans and personalisation, with their sources |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Components, motion, haptics, data visualisation, body map, as built (visual identity: `../DESIGN.md`) |
| [DATA_VISUALIZATION_MAPPING.md](DATA_VISUALIZATION_MAPPING.md) | Which visual each data type uses, and why |
| [SECURITY.md](SECURITY.md) | Threat model, authentication, data protection |
| [TESTING.md](TESTING.md) | Test layers, where tests live, how to run them |
| [SUPABASE_MIGRATION.md](SUPABASE_MIGRATION.md) | Moving the database to Supabase: strategy, security (roles, RLS), rehearsal results, procedure, backup and restore |
| [PRIVATE_DISTRIBUTION_GUIDE.md](PRIVATE_DISTRIBUTION_GUIDE.md) | Running the public API (Cloudflare Tunnel), building and sharing the Android APK and iPhone builds, backups |

## To verify or review by hand

| Document | What it covers |
|---|---|
| [SOURCE_VERIFICATION.md](SOURCE_VERIFICATION.md) | Sources that need a human with a browser or a subscription |
| [TRANSLATION_REVIEW.md](TRANSLATION_REVIEW.md) | Generated review pack for every string (`npm run review-pack` in `mobile/`; checked by CI) |

## Reports and records (snapshots: true at their date)

| Document | What it covers |
|---|---|
| [ARCHITECTURE_CURRENT.md](ARCHITECTURE_CURRENT.md) | Architecture audit before the 2026-11-16 restructuring, with findings and baseline |
| [ARCHITECTURE_PROPOSED.md](ARCHITECTURE_PROPOSED.md) | The restructuring plan: target, migration map, risks |
| [PRIVATE_DISTRIBUTION_AUDIT.md](PRIVATE_DISTRIBUTION_AUDIT.md) | Infrastructure audit before private distribution: what existed, what was added, what needs the owner's accounts |
| [PERSONALIZATION_PROPOSAL.md](PERSONALIZATION_PROPOSAL.md) | Sport and goal personalisation: proposal, and what shipped |
| [REDESIGN_AUDIT.md](REDESIGN_AUDIT.md), [REDESIGN_IMPLEMENTATION_PLAN.md](REDESIGN_IMPLEMENTATION_PLAN.md) | Kinetra Hybrid redesign: audit and plan. File paths in them are from before the restructuring |
| [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md), [REGRESSION_TEST_REPORT.md](REGRESSION_TEST_REPORT.md) | Measured performance and regression checks |
| [ROADMAP.md](ROADMAP.md) | Milestones |
