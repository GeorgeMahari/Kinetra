# Kinetra --- Product & Technical Specification

**Document status:** Working specification / draft\
**Version:** 0.1\
**Purpose:** Establish a clear, reviewable direction for the next
Kinetra development phase.\
**Primary source:** Feedback received from the company
reviewer/superior, as provided by the product owner.\
**Important:** This document separates confirmed feedback from proposals
and unresolved decisions. Do not treat assumptions as approved product
requirements.

------------------------------------------------------------------------

## 1. Product direction

Kinetra is intended primarily for active people. Its central purpose is
to assess a user's physical capabilities across several dimensions,
create a physical score from the assessment, track the user's
activities, and use the assessment results as the basis for an
appropriate plan.

The assessment is the primary product concept. Plan creation must follow
the required tests rather than precede them.

### 1.1 Core product principles

1.  **Assessment first:** required physical tests must be completed
    before a personalized plan can be created.
2.  **Evidence-based scoring:** physical scores and dimensions must
    follow the company's approved methodology. Do not invent tests,
    thresholds, weights, formulas, or medical interpretations.
3.  **Activity tracking:** the app should understand which activities a
    user generally practices and allow the user to log activities they
    actually perform.
4.  **Clarity over information density:** the interface should be
    intuitive and avoid redundant explanatory text.
5.  **Reliable infrastructure:** the current server has reportedly been
    frequently unavailable. The company has suggested using its Helfcode
    server, subject to receiving access details and API documentation.
6.  **Preserve working functionality:** improve the existing product
    without unnecessary rewrites or regressions.

------------------------------------------------------------------------

## 2. Confirmed reviewer feedback

The following points reflect the reviewer's message.

### 2.1 Assessment must precede plan creation

-   Users should complete the tests first.
-   The small test/assessment that produces a physical score across
    different directions is the primary idea.
-   A plan should be created only after the relevant tests have been
    completed.

**Requirement:** inspect the current onboarding, test, score, and
plan-generation flows. Identify every route or UI action that currently
allows plan creation before the required assessment. Propose how to
enforce the correct order.

**Not yet defined:** the exact required tests, physical dimensions,
scoring formula, thresholds, weighting, and retest rules.

### 2.2 General activities and activity logging

-   The app should track user activities.
-   It should ask which activities the user generally does.
-   The intended audience is primarily active people.
-   The reviewer supplied a YAZIO screenshot as a reference for an
    activity picker.
-   In that reference, previously used activities appear near the top,
    followed by a searchable activity list.

**Requirement:** distinguish two related concepts: 1. **Usual
activities:** activities the user says they generally practice. 2.
**Activity log:** dated records of activities the user actually
performed.

A proposed activity-picker experience: - Recently used activities near
the top. - Search field. - Browseable activity list, preferably grouped
or alphabetically organized. - Ability to select an activity. - Custom
activity support only if compatible with product rules and data model. -
Clear selected state and accessible controls.

The screenshot is a UX reference only. Do not copy YAZIO branding,
assets, proprietary design, or assume Kinetra is a calorie/nutrition
tracker.

**Not yet defined:** official activity taxonomy, required fields per
activity, units, intensity model, duration/distance/calorie
requirements, and whether activity data is manually entered or
integrated from device services.

### 2.3 Spider/radar diagram

Reviewer observations: - Some icons in the spider diagram look strange
or do not match the marker/dimension they represent. - The diagram
performs an inappropriate animation when clicked.

**Requirements:** - Audit the diagram's data-to-axis/marker/icon
mapping. - Ensure every icon clearly represents the corresponding
physical dimension and matches its label/marker. - Review click, press,
focus, hover, and state-change animations. - Remove or tone down
unexpected, distracting, or excessive animation. - Preserve useful
interactions and accessibility. - Do not change the underlying score
calculations while fixing presentation unless separately approved.

**Not yet defined:** final icon set, visual design tokens, and exact
desired interaction behavior.

### 2.4 Reduce information density

Reviewer observation: the app contains too much information; much of it
could be removed because users can understand the interface intuitively.

**Requirements:** - Audit screens for redundant descriptions, repeated
information, unnecessary helper text, and low-value visual elements. -
Prefer concise labels and progressive disclosure for secondary
explanations. - Keep safety-critical instructions, test protocols,
consent/privacy notices, and information necessary to interpret
results. - Do not remove information merely to make screens shorter if
doing so could make a test unsafe or a score misleading.

### 2.5 Server reliability and Helfcode

Reviewer observation: - The current server is frequently down. - The
reviewer recommends using the company's Helfcode server.

**Requirements:** - Audit current backend deployment assumptions, API
base URLs, environment configuration, health checks, authentication,
database dependencies, and error handling. - Identify what would be
required to integrate with the Helfcode server. - Keep secrets out of
source control and logs. - Avoid hardcoding production endpoints. -
Preserve data integrity and authentication behavior.

**Blocked pending company input:** Helfcode base URL, API
documentation/OpenAPI schema, credentials or authentication flow,
environment details, database ownership/migration expectations,
networking/access restrictions, and support/contact process.

Do not migrate, rewrite, or point production traffic to Helfcode until
the company provides the necessary information and the owner approves a
migration plan.

------------------------------------------------------------------------

## 3. Proposed target user journey

This is a proposed flow derived from the reviewer's feedback. Validate
it against the existing product and company methodology before
implementation.

1.  **Account and profile**
    -   Sign up / sign in.
    -   Collect only the profile information required by approved
        product rules.
    -   Explain why any sensitive or health-related information is
        collected.
2.  **Usual activities**
    -   Ask which activities the user generally practices.
    -   Allow the user to skip only if product policy permits; otherwise
        explain why the information is required.
    -   Store usual activities separately from activity-session records.
3.  **Initial physical assessment**
    -   Present the approved tests and instructions.
    -   Record results with units, timestamps, and relevant test
        metadata.
    -   Support incomplete assessments and safe resume behavior if
        appropriate.
4.  **Physical Score**
    -   Calculate and display scores using only the company's approved
        methodology.
    -   Explain dimensions and results in concise, understandable
        language.
    -   Clearly distinguish measured results from estimates or
        unavailable values.
5.  **Personalized plan**
    -   Unlock plan creation only when all required assessment
        conditions are satisfied.
    -   Base the plan on the approved score and other permitted inputs.
    -   Do not generate fabricated or unsupported recommendations.
6.  **Ongoing activity tracking**
    -   Allow users to log completed activities.
    -   Provide recent activities, search, and browsing.
    -   Show history and progress in a simple way.
7.  **Reassessment**
    -   Support reassessment when the product methodology defines
        when/how it should happen.
    -   Compare results only when tests and measurement conditions are
        sufficiently comparable.

------------------------------------------------------------------------

## 4. Functional requirements

### FR-01 --- Assessment gating

-   The application must identify whether the user's required initial
    assessment is complete.
-   Plan creation must be unavailable or clearly locked until the
    required assessment is complete.
-   Backend authorization/business logic must enforce the rule; hiding a
    button in the UI alone is insufficient.
-   Existing users with historical data must be handled safely. Do not
    silently invalidate or overwrite their data.
-   The exact completion rule must be configurable or implemented from
    company-approved test requirements.

### FR-02 --- Assessment records

-   Inspect existing test definitions, result schemas, endpoints, and
    validation.
-   Preserve units, precision, timestamps, and provenance.
-   Validate inputs and reject invalid values using approved rules.
-   Do not invent clinical or performance thresholds.

### FR-03 --- Physical Score

-   Trace the score from raw test result through backend calculation to
    API response and UI display.
-   Document formulas, weights, normalization, missing-data behavior,
    and rounding as they exist today.
-   Flag undocumented or hardcoded assumptions.
-   Do not change scoring semantics without explicit approval and
    regression tests.

### FR-04 --- Usual activities

-   Provide a way to select and update activities generally practiced by
    the user.
-   Store these as profile/preferences data, not as completed activity
    logs.
-   Avoid duplicate entries and define how retired/renamed catalog
    entries are handled.

### FR-05 --- Activity log

-   Allow users to create, view, edit, and delete their own activity
    records, subject to current authorization and product policy.
-   Each record should support only fields confirmed by product
    requirements. Candidate fields for review include activity type,
    date/time, duration, distance, intensity, notes, and source.
-   Do not assume all fields apply to every activity.
-   Ensure users cannot access or modify another user's records.

### FR-06 --- Activity picker

-   Show recently used activities when history exists.
-   Provide search and a discoverable list.
-   Ensure the empty state works for new users.
-   Support localization and accessibility consistent with the existing
    app.
-   Do not use YAZIO assets or copy its proprietary interface.

### FR-07 --- Spider/radar diagram

-   Ensure each axis, label, icon, marker, and value uses the same
    stable dimension identifier.
-   Avoid index-based mappings that can become misaligned when order
    changes.
-   Reduce unwanted click animations.
-   Respect reduced-motion/accessibility preferences if the existing
    stack supports them.
-   Add tests for dimension-to-icon/label/value mapping where feasible.

### FR-08 --- UX simplification

-   Identify redundant content screen by screen.
-   Keep critical safety, privacy, consent, and interpretation
    information.
-   Use concise labels and progressive disclosure.
-   Do not remove features or content without documenting the impact.

### FR-09 --- Backend availability and errors

-   Audit server health and failure modes.
-   Provide clear loading, offline, retry, and error states.
-   Avoid treating a failed request as an empty dataset.
-   Ensure retry behavior does not create duplicate records.
-   Review timeouts, request cancellation, token refresh, and API error
    handling.

------------------------------------------------------------------------

## 5. Non-functional requirements

-   **Security:** secrets must be stored in environment/secret
    management, never committed.
-   **Authorization:** enforce per-user access on the backend.
-   **Privacy:** collect only necessary data; do not expose
    health-related or personal data in logs.
-   **Reliability:** handle network interruptions and server downtime
    predictably.
-   **Data integrity:** use safe migrations, constraints, and
    transactional behavior where appropriate.
-   **Compatibility:** preserve supported Android/iOS behavior and
    existing API contracts unless a migration is approved.
-   **Accessibility:** labels, touch targets, contrast, and motion
    behavior should remain usable.
-   **Maintainability:** follow existing project conventions; avoid
    unnecessary dependencies and duplicate abstractions.
-   **Testing:** add/update unit, integration, and UI tests for changed
    behavior.

------------------------------------------------------------------------

## 6. Technical investigation required

Before implementation, inspect and document:

1.  Repository structure and app entry points.
2.  Mobile framework, navigation, state management, and build
    configuration.
3.  Backend framework, API routes, authentication, and authorization.
4.  Database schema, migrations, and relationships.
5.  Assessment/test definitions and result persistence.
6.  Physical Score calculation and data flow.
7.  Plan-generation logic and gating.
8.  Spider/radar chart implementation and animation triggers.
9.  Activity-related screens, models, endpoints, and existing catalog
    data.
10. API URL/environment configuration and current deployment.
11. Existing tests, CI workflows, and build/release process.
12. Any Supabase, hosted database, or third-party service dependencies
    currently in use.

Do not infer architecture from folder names alone. Trace actual runtime
paths and data flow.

------------------------------------------------------------------------

## 7. Unresolved questions / company dependencies

These must be tracked explicitly rather than guessed.

### Assessment methodology

-   What are the official physical dimensions?
-   What tests are required for each dimension?
-   What are the exact protocols, units, and instructions?
-   What are the score formulas, weights, normalization, and thresholds?
-   How is an incomplete assessment handled?
-   When can a user retest?

### Plans

-   Which plan types are allowed?
-   Which score dimensions influence plan generation?
-   Are there rules, templates, or company-approved algorithms?
-   What conditions must be met before a plan is unlocked?

### Activities

-   Is there an official activity list/catalog?
-   Which activity categories and localized names are required?
-   Which fields are required for each activity type?
-   Are custom activities allowed?
-   Are wearable/HealthKit/Health Connect integrations in scope?

### Helfcode server

-   What is the API base URL for development, staging, and production?
-   Is OpenAPI/Swagger documentation available?
-   What authentication mechanism is used?
-   Who provisions credentials and access?
-   Who owns the database and migrations?
-   Is data migration required?
-   What are the deployment, backup, monitoring, and support
    expectations?

### Product and design

-   Is there a design system or reference UI?
-   Which information is mandatory for legal, safety, or company
    reasons?
-   What exact behavior should happen when a user taps a spider-chart
    dimension?

------------------------------------------------------------------------

## 8. Suggested implementation phases

These are proposals; revise them after the code audit and company
clarification.

### Phase 0 --- Audit and baseline

-   Map architecture and data flows.
-   Run existing tests and record baseline failures.
-   Identify current behavior versus this specification.
-   Produce a gap analysis and risk register.
-   Make no product-code changes.

### Phase 1 --- Confirm product rules

-   Obtain assessment methodology and activity catalog.
-   Obtain Helfcode API details.
-   Resolve blocking questions.
-   Approve target user journey and acceptance criteria.

### Phase 2 --- Assessment-first flow

-   Implement backend and UI gating.
-   Ensure assessment persistence and resume behavior.
-   Verify score calculations against approved examples.

### Phase 3 --- Activity experience

-   Separate usual activities from activity logs.
-   Implement activity catalog/search/recently used experience.
-   Add secure CRUD and tests.

### Phase 4 --- Spider diagram and UX refinement

-   Correct dimension/icon/marker mappings.
-   Fix unwanted animation.
-   Reduce redundant content while preserving essential information.

### Phase 5 --- Infrastructure integration

-   Prepare Helfcode integration plan.
-   Implement only after access, API contract, and migration decisions
    are approved.
-   Test staging, authentication, data integrity, rollback, and
    production readiness.

### Phase 6 --- Release and validation

-   Run full test suite and platform builds.
-   Test new-user and existing-user journeys.
-   Validate backend authorization and failure states.
-   Prepare release notes and rollback plan.

------------------------------------------------------------------------

## 9. Acceptance criteria

The following high-level criteria must be met before the work can be
considered complete:

-   A new user cannot create a personalized plan before completing the
    company-defined required assessment.
-   The backend enforces the assessment requirement, not only the
    frontend.
-   Physical Score calculations match the approved company methodology
    and verified test cases.
-   Usual activities are distinct from dated activity logs.
-   Users can find and log activities through a clear
    searchable/recently-used picker.
-   Spider diagram labels, icons, axes, markers, and values are
    correctly associated.
-   Clicking the diagram does not trigger unwanted animation.
-   Redundant content is reduced without removing essential safety,
    consent, privacy, or result-interpretation information.
-   Server failures are handled transparently and do not cause silent
    data loss or duplicate records.
-   Helfcode integration is performed only against an approved API
    contract and environment.
-   Existing functionality and user data are preserved, with regression
    tests covering changed flows.

------------------------------------------------------------------------

## 10. Change-control rules for AI-assisted development

Any AI coding agent working on Kinetra must:

1.  Read this document before proposing or changing code.
2.  Treat confirmed reviewer feedback as requirements and clearly label
    proposals.
3.  Never invent company methodology, score formulas, test protocols, or
    Helfcode API details.
4.  Audit existing code before recommending rewrites.
5.  Preserve existing behavior unless a change is required and approved.
6.  Avoid destructive database operations and unsafe migrations.
7.  Never expose, print, commit, or request secrets in source files or
    logs.
8.  Work in small, reviewable phases.
9.  Run relevant tests after each implementation phase and report exact
    results.
10. Document assumptions, unresolved questions, changed files, migration
    effects, and rollback steps.
11. Do not claim a feature is complete merely because code was written;
    verify it.
12. Ask for approval before implementing decisions that depend on
    unresolved company input.

------------------------------------------------------------------------

## 11. Source and confidence labels

Use these labels in plans and reports:

-   **CONFIRMED:** explicitly stated in the reviewer's feedback.
-   **EXISTING:** verified in the current codebase.
-   **PROPOSED:** a recommended design or implementation approach, not
    yet approved.
-   **UNKNOWN / BLOCKED:** requires information from the company or
    product owner.
-   **RISK:** could affect user data, security, scoring correctness, or
    production availability.

This specification is a working baseline. Update it when the company
provides the full list of feedback, official assessment methodology,
activity catalog, or Helfcode documentation.
