/** /catalog and /onboarding routes (backend/app/modules/onboarding/router.py and schemas.py). */
import { route, validate } from "../../core/http.ts";
import * as v from "../../core/validation.ts";
import { pyRepr, reprList } from "../../shared/pyrepr.ts";
import {
  ActivityLevel,
  FloorRise,
  Goal,
  MobilityPractice,
  ReadinessQuestion,
  SleepQuality,
  SportLevel,
  StairsTolerance,
  TrainingExperience,
} from "../../shared/vocab.ts";
import { currentUser, userOf } from "../auth/deps.ts";
import * as service from "./service.ts";

const sessions = () => v.int({ ge: 0, le: 21 });

const SportPractice = v.model({
  code: v.str({ min: 1, max: 40 }),
  sessions_per_week: sessions(),
  level: v.optional(v.nullable(v.enumOf(SportLevel)), () => null),
}, { name: "SportPractice", extraForbid: true });

/** A field_validator(mode="after") on one field: runs only if the field itself is valid. */
function checked<T>(inner: v.Schema<T>, check: (value: T) => string | null): v.Schema<T> {
  return {
    default: inner.default,
    parse(value, loc, issues) {
      const out = inner.parse(value, loc, issues);
      if (out === v.INVALID) return out;
      const problem = check(out);
      return problem ? v.valueError(issues, loc, problem) : out;
    },
  };
}

export const ActivityAnswers = v.model({
  activity_level: v.enumOf(ActivityLevel),
  exercise_sessions_per_week: sessions(),
  typical_session_minutes: v.optional(v.nullable(v.int({ ge: 5, le: 600 })), () => null),
  training_experience: v.enumOf(TrainingExperience),
  sports: v.optional(
    checked(v.list(SportPractice, { max: 10 }), (xs) =>
      new Set(xs.map((s) => s.code)).size !== xs.length ? "Each sport can be listed once." : null),
    () => [],
  ),
}, { name: "ActivityAnswers", extraForbid: true });

const FollowUpAnswers = v.model({
  strength_sessions_per_week: v.optional(v.nullable(v.int({ ge: 0, le: 21 })), () => null),
  cardio_sessions_per_week: v.optional(v.nullable(v.int({ ge: 0, le: 21 })), () => null),
  mobility_practice: v.optional(v.nullable(v.enumOf(MobilityPractice)), () => null),
  stairs_tolerance: v.optional(v.nullable(v.enumOf(StairsTolerance)), () => null),
  floor_rise: v.optional(v.nullable(v.enumOf(FloorRise)), () => null),
  sleep_hours: v.optional(v.nullable(v.decimal({ ge: 2, le: 16, places: 1 })), () => null),
  sleep_quality: v.optional(v.nullable(v.enumOf(SleepQuality)), () => null),
}, { name: "FollowUpAnswers", extraForbid: true });

const emptyFollowUps = () => ({
  strength_sessions_per_week: null, cardio_sessions_per_week: null, mobility_practice: null, stairs_tolerance: null,
  floor_rise: null, sleep_hours: null, sleep_quality: null,
});

const OnboardingAnswers = v.model({
  goals: checked(v.list(v.enumOf(Goal), { min: 1, max: 3 }), (xs) =>
    new Set(xs).size !== xs.length ? "Each goal can be chosen once." : null),
  activity: ActivityAnswers,
  follow_ups: v.optional(FollowUpAnswers, emptyFollowUps),
  readiness: v.dict(v.bool(), v.enumOf(ReadinessQuestion)),
}, {
  name: "OnboardingAnswers",
  extraForbid: true,
  after: (m, loc, issues) => {
    const missing = ReadinessQuestion.filter((q) => q !== "pregnancy" && !(q in m.readiness)).sort();
    if (missing.length) return v.valueError(issues, loc, `Answer every screening question: ${reprList(missing)}`);
    return m;
  },
});

const anyValue: v.Schema<unknown> = { parse: (value) => value };

const DraftUpdate = v.model({
  step: v.int({ ge: 0, le: 20 }),
  answers: v.optional(
    checked(v.dict(anyValue), (d) => {
      if ([...pyRepr(d)].length > 20_000) return "Draft is too large.";
      const unknown = Object.keys(d).filter((k) => !["goals", "activity", "follow_ups", "readiness"].includes(k)).sort();
      return unknown.length ? `Unknown draft sections: ${reprList(unknown)}` : null;
    }),
    () => ({}),
  ),
}, { name: "DraftUpdate" });

const FollowUpRequest = v.model({ activity: ActivityAnswers }, { name: "FollowUpRequest", extraForbid: true });

route({
  method: "GET", path: "/api/v1/catalog/sports",
  handler: (ctx) => service.listSports(ctx.db),
});

route({
  method: "GET", path: "/api/v1/onboarding", deps: [currentUser],
  handler: (ctx) => service.getStatus(ctx.db, userOf(ctx)),
});

route({
  method: "PUT", path: "/api/v1/onboarding/draft", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, DraftUpdate));
    return await service.saveDraft(ctx.db, userOf(ctx), body.step, body.answers as Record<string, unknown>);
  },
});

route({
  method: "POST", path: "/api/v1/onboarding/follow-up-questions", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, FollowUpRequest));
    return await service.followUpQuestions(ctx.db, userOf(ctx), body.activity as service.ActivityAnswers);
  },
});

route({
  method: "POST", path: "/api/v1/onboarding/complete", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, OnboardingAnswers));
    return await service.complete(ctx.db, userOf(ctx), body as unknown as service.OnboardingAnswers);
  },
});

route({
  method: "GET", path: "/api/v1/onboarding/summary", deps: [currentUser],
  handler: (ctx) => service.getSummary(ctx.db, userOf(ctx)),
});
