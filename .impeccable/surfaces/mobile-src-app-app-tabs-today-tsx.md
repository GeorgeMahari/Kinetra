---
version: 1
slug: "mobile-src-app-app-tabs-today-tsx"
primary_target: "mobile/src/app/(app)/(tabs)/today.tsx"
related_targets: []
---

Scope: Today tab (home), first surface of the Kinetra visual world "Marcaje turistice". Mode: Operate.
Audience and job: beginners checking where they stand across eight dimensions and what to do next.
Constraints: PRODUCT.md principles (no overall score, no comparison with others, provenance on every value, status never colour alone, server-enforced safety). Logic unchanged.

## Direction contract

THESIS: Each dimension is a marked mountain trail; its blaze (shape + colour on a white plate) tells you which one you are on, everywhere in the app.
FORM: Carpathian trail waymarks (band, dot, cross, triangle in red, blue, yellow, green on white), rock-white ground, forest-green shell. seed:c9714a510c0dbbd4 (pick).
FIRST VIEWPORT: Forest-green hero panel with the greeting and a ridge line carrying eight waypoints, one per dimension, filled when the dimension has data ("8 din 8"); below it the eight dimensions as rows led by their blazes, value right in tabular figures.
SIGNATURE: Blaze plates identify a dimension on Today, Assess, Progress and results; the ridge waypoints show coverage truthfully (filled = has data, ring = reported only, empty = unknown).
MOTION: Waypoints settle one after another on arrival (spring, ~300 ms total), rows fade up staggered by 40 ms, pressables scale to 0.97 with a light haptic; all disabled under Reduce Motion.
RISK: Blaze red must never read as an error: blazes identify, never judge; errors keep their own colour plus icon and text.
