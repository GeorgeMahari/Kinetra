# Sport- and goal-based personalisation: technical proposal

**Status:** proposal, awaiting approval (the database changes in §4 are not applied).
**Date:** 2026-11-16

## 1. What exists today (analysis)

| Area | Current behaviour | Where | Gap for personalisation |
|---|---|---|---|
| Sports | 30 sports in 7 categories (`endurance`, `strength`, `team`, `racket`, `combat`, `mind_body`, `mixed`); the user picks up to 10, each with sessions per week | `sports`, `activity_profile_sports` (migration 0003); `onboarding/vocab.py` | Only the **category** is used anywhere, and only for the `sport_performance` goal. There is no level per sport and no athletics. |
| Goals | 1–3 of 9 goals; the set is replaced on update | `user_goals` (no order) | There is no primary or secondary goal (the API list order is lost in the DB), and no goals for muscle mass, power/speed or agility. |
| Experience | one value for all training (`training_experience`) | `activity_profiles` | Not per sport; nothing reads it. |
| Priorities | `dimension_priorities`: +2 for a goal match, +1 for an information gap, over 8 dimensions | `onboarding/rules.py` | Fixed at onboarding. Sports matter only through their category. There is no finer notion than the 8 health dimensions, such as power, speed, agility or hypertrophy. |
| Tests | 10 fixed tests, one dimension each; "suggested" means allowed by the safety ceiling and not done in 8 weeks | `assessments/engine/catalog.py`, `assessments/service.overview` | Every user gets the same battery. There is no notion of why a test is suggested. |
| Scoring | norm tables and interpretation per indicator (engine-2); standings per dimension (insights-3) | `engine/norms.py`, `insights/rules.standing` | Must not change, and won't. |
| Recommendations | WHO/AASM habit rules + "assess unknown dimension" + "retest after 8 weeks" | `insights/rules.recommend` (insights-3) | They ignore sports and goals beyond the initial priority order. |
| Plan focus | the lowest-standing measured dimension, with ties broken by health evidence | `plans/rules.choose_focus` (plan-1) | Ignores what the user is training for. |
| Profile changes | goals and activity are only written by `/onboarding/complete`; activity profiles are snapshots (`source` can already be `update`) | `onboarding/service.py` | There is no endpoint to edit the sport profile after onboarding. |

Results are stored as `test_results(test_code text, inputs JSONB, indicators JSONB, engine_version)`
with no constraint on `test_code`, so **new tests need no migration**.

## 2. Design principles

1. **Two layers, one source of truth.** The 8 **health dimensions** (profile map, zones, plan, norms)
   stay exactly as they are. Above them sits a new, finer layer of **performance capacities**. Each
   capacity belongs to one dimension, so nothing that reads dimensions breaks.
2. **Knowledge as data, not conditions.** Which capacities a sport demands, which capacities a goal
   targets and which capacities a test measures live in three declarative, cited tables in one pure
   module. The UI never branches on a sport.
3. **One combined battery.** Capacity weights from every sport, goal and explicit priority are summed
   first, and tests are chosen from the combined weights. A test that serves both the gym and tennis
   appears once, with both reasons.
4. **Evidence is explicit.** Every test is labelled `validated_norms` (it has a published norm table),
   `documented_threshold` (a published cut-off that is not a norm, such as limb symmetry) or
   `self_comparison` (only your own trend, no rating). Nothing is presented as a medical assessment.
5. **Real data drives advice.** A sport choice alone never creates training advice. It can only make
   a test relevant. Training recommendations fire only from real results: a low band against a norm,
   a trend that declines over at least 3 results, or a documented asymmetry.
6. **Versioned and reversible.** `personalization-1` is a new rule version. Existing results, scores
   and plan-1 plans keep their versions. Old accounts without the new profile fields fall back to
   today's behaviour.

## 3. The personalisation engine (backend, pure module)

`backend/app/modules/personalization/` (new; no I/O in the rules, unit-tested like `onboarding/rules.py`):

| File | Content |
|---|---|
| `capacities.py` | `Capacity` enum, each mapped to a dimension: `aerobic_endurance`→cardio, `recovery_hr`→recovery, `max_strength`→strength, `hypertrophy`→body, `muscular_endurance`→muscularEndurance, `power`→strength, `speed`→strength, `agility`→balance, `reaction`→balance, `mobility`→mobility, `balance`→balance, `body_composition`→body, `sleep_recovery`→lifestyle. The mapping is final once approved. |
| `knowledge.py` | `SPORT_DEMANDS[sport] = {capacity: 1..3}` with a citation per sport; `GOAL_CAPACITIES[goal] = {capacity: 1..3}`; `TEST_CAPACITIES[test] = {capacity: primary/secondary}` plus `evidence`, `retest_weeks`, `intensity` and `equipment` |
| `engine.py` | `capacity_weights(profile)` returns the weight per capacity with its reasons: sport weight × a frequency factor × a level factor, goal weight × rank (primary ×3, secondary ×2, other ×1), and explicit priority ×2. `battery(weights, tests, ceiling, history)` returns the **core** tests (today's general tests, always shown), the **priority** tests (top capacities) and the **additional** tests (activated but lower). Each test carries a `why` (a list of reason codes with parameters) and `status` (not done / up to date / due). |

Example: gym (4×/week, advanced) and tennis (2×/week), primary goal `build_muscle`. This gives high
weights for hypertrophy, max strength and agility, a medium weight for power and mobility, and a low
weight for aerobic endurance. The battery is the core tests (push-ups, chair stand, plank,
sit-and-reach and so on, unchanged), priority **circumferences** (because of the gym and
`build_muscle`), priority **505 agility** (because of tennis), and additional **vertical jump**
(because of tennis and the gym's power weight). Push-ups appear once, with two reasons.

## 4. Data changes (migration 0010, additive only; awaiting confirmation)

| Change | Why | Compatibility |
|---|---|---|
| `user_goals.rank SMALLINT NULL` (1 = primary, CHECK 1–3) | primary vs secondary goal | Existing rows keep NULL, read as unordered (today's behaviour) |
| New `Goal` values: `build_muscle`, `power_speed`, `agility_coordination` (CHECK constraint widened) | hypertrophy and athletic goals the user asked for | Old values unchanged |
| `activity_profile_sports.level VARCHAR(20) NULL` (`beginner`/`intermediate`/`advanced`) | level per sport | NULL for existing snapshots means "not stated" |
| New table `user_capacity_priorities(user_id, capacity, weight 1–3, created_at)`, replaced on update like goals | explicit priorities (strength, mass, speed and so on) | Empty for existing users |
| Seed `sports`: `athletics_sprints`, `athletics_jumps_throws`, `athletics_distance` | athletics was missing | Insert only |

The rendered SQL will be saved as `db/sql/0010_sport_personalization.sql` and the migration will be
reversible (downgrade drops only what it adds). `~/.claude/db-docs/Kinetra.md` will be updated
afterwards. No existing row is modified or deleted.

## 5. API (additive; no existing field changes meaning)

| Endpoint | Change |
|---|---|
| `GET /profile/sport` (new) | sports (with level, frequency and main flag), ranked goals, capacity priorities |
| `PUT /profile/sport` (new) | writes a new activity snapshot (`source='update'`), replaces the goals with ranks and the priorities, and returns the new battery. Readiness is untouched, and so is the safety ceiling. |
| `GET /assessments/tests` | each test gains `tier` (`core`/`priority`/`additional`), `capacities[]`, `evidence`, `retest_weeks` and `why[]`. Existing fields are unchanged. |
| `GET /assessments/overview` | `suggested_tests` keeps its meaning, and a new `battery` field is added |
| `GET /insights/dashboard` | new `focus_capacities[]`: the top capacities with their latest result, band if normed, and trend |
| Recommendations | new codes (`assess_capacity_*`, `train_capacity_*`) with `params` naming the sport or goal and the result that triggered them, and new `reasons` codes. Existing codes are unchanged. |
| `POST /plans` | plan-2: focus = the lowest standing **weighted by profile relevance**. plan-1 plans keep running unchanged. |

## 6. Mobile integration

- **Onboarding:** after picking sports, a level for each sport (optional); goals ranked by the first
  being primary; an optional "what matters most" step (capacity chips, weight by tapping 1–3 times).
- **Profile:** a "Sport profile" editor (the same steps), showing what changes in your battery before
  saving.
- **Assess tab:** sections "Priority for you", "Activated by your profile" and "General". Each tile
  shows its evidence label (norms / threshold / self-comparison) and a **"Why this test?"** sheet that
  lists the reasons.
- **Today:** a "Your goal" card showing progress on the primary goal's capacities (latest value,
  trend, band only where a norm exists).
- **Progress:** a "Performance profile" (capacity bars ordered by your weights, self-comparison
  trends) next to the existing health map, which stays.
- **Recommendations** show their context ("for tennis · based on your 505 result of 12 Nov").

## 7. Phases (each tested, documented and committed)

1. Engine and knowledge tables (pure), with unit tests, so every scenario in the brief (bodybuilder,
   tennis, cycling, volleyball, gym + tennis) has a test.
2. Migration 0010 and the profile API, after your confirmation of the SQL.
3. New tests in the catalogue (engine-3), each with its protocol, units, evidence label, safety and
   retest interval, and norms only where a source was read.
4. Recommendations (insights-4) and plan focus (plan-2).
5. Mobile: onboarding, profile editor, Assess sections and "why", Today goal card, performance profile.
6. Documentation: SCIENCE.md sections, DECISIONS D43–D45, translation of new strings in en/ro/ru.

## 8. Test catalogue

See §8 below (filled from the source research).
