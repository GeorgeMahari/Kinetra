# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

One Expo / React Native app ships to Android and iOS with the same Kinetra design language on both
(confirmed by the owner, 2026-11-13). Android is the primary target today: Health Connect import and
the development emulator are Android. iOS is not adapted per-OS.

## Users

Anyone who wants to know where they stand physically, **with no sports or medical background**
(confirmed). They use the app on their own phone, usually at home, doing simple tests (push-ups, a
plank, a step test, a 12-minute run) and entering the result. Ages 14 and up: 14–15 need a parent's
consent, 16–17 are minors with lower intensity limits, 18+ adults.

## Product Purpose

Kinetra builds a multidimensional physical profile across eight independent dimensions
(cardiovascular endurance, cardiovascular recovery, strength, muscular endurance, mobility, balance,
body measurements, recovery and lifestyle) and tracks how it changes over time. Success: a person
knows each dimension well enough to act on it, keeps measuring, and improves against themselves.

It is general wellness information, not a medical device, and never diagnoses.

## Positioning

An honest profile instead of a score. There is no overall score, no ranking against others, and no
invented norms: a comparison appears only when its reference was read in the primary source (FRIEND,
WHO, NICE). Every value is labelled measured, calculated, estimated or self-reported. The coverage
map shows how well each dimension is *known*, not how good it is.

## Operating Context

- Onboarding questionnaire (goals, activity, sports, adaptive follow-ups, a safety screening) that
  caps how intense suggested tests may be.
- Test flow: instructions and safety note → enter the result (with timers where needed) → result →
  next suggested test or back to Today.
- Today (coverage map, recommendations, recent results, the eight dimensions), Assess, Progress
  (trends per protocol, table view), Profile and Account & data (language, export, deletion).
- Optional read-only Health Connect import (development build only).

## Capabilities and Constraints

- Stack: Expo SDK 58, React Native 0.88, TypeScript, Expo Router; FastAPI + PostgreSQL backend.
- Languages: English, Romanian, Russian, all with full parity. Light and dark themes plus Automatic.
- Safety is enforced on the server: tests above the user's intensity ceiling are hidden and refused;
  maximal-effort tests are adults-only; a "consult" screening suppresses effort recommendations.
- The product is intended for public release in the app stores (confirmed). Store listing, pricing
  and licensing are undecided.

## Brand Commitments

- Name **Kinetra**; tagline "Know your body's full spectrum."; own logo and own 22-icon SVG set.
- Voice: calm, neutral, never judging. Changes are shown as signed numbers without good/bad colouring;
  no confetti, no streak-loss shaming; recommendations propose the next small step.
- Gamification rewards knowing and consistency (measuring, repeating, own records), never performance
  against others.

## Evidence on Hand

- Scientific basis and references: `docs/SCIENCE.md`, `docs/SOURCE_VERIFICATION.md`.
- Product decisions: `docs/DECISIONS.md`.
- No users, testimonials, reviews, press or usage numbers exist yet. Do not fabricate any.

## Product Principles

1. Truth over engagement: raw values beat unverified norms; unknown stays "not assessed".
2. Safety first, enforced by the server, never by the client alone.
3. Compare people only with themselves.
4. Explain for a beginner: every test says what it measures, what you need and how to do it safely.
5. Proportional guidance: the next small step, always with a cited source.

## Accessibility & Inclusion

- Minors from 14 (parental consent for 14–15); content and intensity adapt by age.
- Three languages including Cyrillic; system fonts for full coverage.
- Status is never colour alone (the coverage map uses length and shape with a legend).
