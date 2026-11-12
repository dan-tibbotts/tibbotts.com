import test from "node:test";
import assert from "node:assert/strict";
import { suggestTime } from "../src/time-suggestions.mjs";
import { validateSchedule, effectiveSchedule } from "../src/work-schedules.mjs";
import { validateTime, entryMinutes } from "../src/domain.mjs";
import { assertTimeAccess, projectWorkspace } from "../src/permissions.mjs";
import { rankNearbyJobs } from "../src/nearby-jobs.mjs";
const date = "2026-11-13",
  user = { id: "alex", active: true, role: "worker" };
const day = {
  start: "07:30",
  end: "16:00",
  breakMinutes: 30,
  overnight: false,
};
const schedule = {
  id: "usual",
  workerId: "alex",
  effectiveFrom: "2026-01-01",
  timeZone: "Pacific/Auckland",
  days: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, day])),
  revision: 1,
};
const entry = (id, start, end, breakMinutes = 0, extra = {}) => ({
  ...validateTime({
    id,
    workerId: "alex",
    jobId: id,
    date,
    start,
    end,
    breakMinutes,
    overnight: false,
    ...extra,
  }),
  revision: 1,
  status: "open",
});
const suggest = (entries = [], extra = {}) =>
  suggestTime({
    schedules: [schedule],
    entries,
    workerId: "alex",
    date,
    ...extra,
  });
test("no entries use effective usual hours, no guessed company fallback", () => {
  assert.deepEqual(suggest().suggestion, {
    id: "gap-0",
    date,
    start: "07:30",
    end: "16:00",
    overnight: false,
    breakMinutes: 30,
    breakNeedsReview: false,
    availableMinutes: 510,
  });
  assert.equal(suggest([], { schedules: [] }).state, "unconfigured");
});
test("effective schedules change on the boundary and differing weekdays apply", () => {
  const newer = {
    ...schedule,
    id: "next",
    effectiveFrom: "2026-11-16",
    days: { 1: { ...day, start: "08:00" } },
  };
  assert.equal(
    effectiveSchedule([newer, schedule], "alex", date).schedule.id,
    "usual",
  );
  assert.equal(
    effectiveSchedule([schedule, newer], "alex", "2026-11-16").day.start,
    "08:00",
  );
  assert.equal(suggest([], { date: "2026-11-14" }).state, "nonworking");
});
test("split-day example totals 480 minutes and deducts lunch once", () => {
  const a = entry("a", "07:30", "11:00");
  const s = suggest([a]).suggestion;
  assert.equal(s.start, "11:00");
  assert.equal(s.end, "16:00");
  assert.equal(s.breakMinutes, 30);
  const b = validateTime({ ...s, id: "b", workerId: "alex", jobId: "b" });
  assert.equal(a.totalMinutes + b.totalMinutes, 480);
  assert.equal(
    suggest([entry("a", "07:30", "11:00", 30)]).suggestion.breakMinutes,
    0,
  );
});
test("earlier/intermediate gaps are explicit choices, bounded by later records", () => {
  const s = suggest([entry("a", "12:00", "16:00", 30)]);
  assert.equal(s.state, "choose-gap");
  assert.equal(s.suggestion, null);
  assert.equal(s.gaps[0].start, "07:30");
  assert.equal(s.gaps[0].end, "12:00");
  assert.equal(s.gaps[0].breakMinutes, 0);
  const multi = suggest([
    entry("a", "08:30", "10:00"),
    entry("b", "12:00", "16:00", 30),
  ]);
  assert.deepEqual(
    multi.gaps.map((g) => [g.start, g.end]),
    [
      ["07:30", "08:30"],
      ["10:00", "12:00"],
    ],
  );
});
test("next available interval is preferred, other-worker records do not affect it", () => {
  const s = suggest([
    entry("a", "08:30", "10:00"),
    entry("b", "10:00", "16:00", 0, { workerId: "sam" }),
  ]);
  assert.equal(s.suggestion.start, "10:00");
  assert.equal(s.gaps.length, 2);
});
test("fully covered shift requests explicit additional time", () => {
  const s = suggest([entry("a", "07:30", "16:00", 30)]);
  assert.equal(s.state, "covered");
  assert.equal(s.suggestion, null);
});
test("editing excludes itself, while existing fields remain the form responsibility", () => {
  const s = suggest([entry("a", "07:30", "16:00", 30)], { excludeId: "a" });
  assert.equal(s.suggestion.start, "07:30");
});
test("legacy hours-only entries never get a guessed position", () => {
  const legacy = {
    id: "old",
    workerId: "alex",
    jobId: "a",
    date,
    totalMinutes: 210,
  };
  assert.equal(suggest([legacy]).state, "legacy");
  assert.doesNotThrow(() =>
    validateTime(
      {
        id: "new",
        workerId: "alex",
        jobId: "a",
        date,
        start: "12:00",
        end: "16:00",
        breakMinutes: 0,
      },
      [legacy],
    ),
  );
  assert.equal(entryMinutes({ hours: 3.5 }), 210);
});
test("gaps do not count as unpaid breaks and too-short gaps request review", () => {
  const s = suggest([
    entry("a", "07:30", "11:00"),
    entry("b", "12:00", "15:45"),
  ]);
  assert.equal(s.breakRemaining, 30);
  assert.equal(s.suggestion.start, "15:45");
  assert.equal(s.suggestion.breakMinutes, 0);
  assert.equal(s.suggestion.breakNeedsReview, true);
});
test("overnight schedule clips entries from the following date", () => {
  const night = {
    ...schedule,
    days: {
      5: { start: "22:00", end: "06:00", overnight: true, breakMinutes: 30 },
    },
  };
  const s = suggest([entry("a", "00:00", "03:00", 0, { date: "2026-11-14" })], {
    schedules: [night],
  });
  assert.equal(s.suggestion.date, "2026-11-14");
  assert.equal(s.suggestion.start, "03:00");
  assert.equal(s.suggestion.end, "06:00");
});
test("schedule validation rejects invalid dates, timezone, breaks and implied overnight", () => {
  for (const change of [
    { effectiveFrom: "2026-02-30" },
    { timeZone: "UTC" },
    { days: { 1: { ...day, breakMinutes: -1 } } },
    { days: { 1: { ...day, start: "22:00", end: "06:00" } } },
  ])
    assert.throws(() => validateSchedule({ ...schedule, ...change }));
  assert.equal(validateSchedule({ ...schedule, days: {} }).needsReview, false);
});
test("workers cannot edit other workers, unlock, or correct locked entries", () => {
  const old = entry("a", "07:30", "11:00");
  assert.throws(
    () => assertTimeAccess(user, { ...old, workerId: "sam" }, old),
    /own/,
  );
  assert.throws(
    () => assertTimeAccess(user, { ...old, status: "locked" }, old),
    /status/,
  );
  assert.throws(
    () =>
      assertTimeAccess(
        user,
        { ...old, status: "locked" },
        { ...old, status: "locked" },
      ),
    /locked/,
  );
  const admin = { ...user, role: "office_admin" },
    locked = { ...old, status: "locked" };
  assert.throws(() => assertTimeAccess(admin, locked, locked), /explicit/);
  assert.doesNotThrow(() =>
    assertTimeAccess(admin, locked, locked, {
      adminCorrection: true,
      reason: "Actual break corrected",
    }),
  );
});
test("worker DTOs exclude commercial fields and other workers private records", () => {
  const data = {
    jobs: [
      {
        id: "a",
        workerIds: ["alex"],
        name: "A",
        estimateMinutes: 480,
        supplierBuyCost: 99,
        margin: 40,
        profit: 9,
      },
    ],
    timesheets: [
      entry("one", "07:30", "11:00"),
      entry("two", "11:00", "16:00", 0, { workerId: "sam" }),
    ],
    users: [{ ...user, email: "private@test" }],
    meta: [{ id: "code:other@test", value: { code: "123456" } }],
    notes: [],
    media: [],
    operations: [],
    drafts: [],
    revisions: [],
    workSchedules: [schedule, { ...schedule, id: "sam", workerId: "sam" }],
    scheduleRevisions: [],
    auditEvents: [],
    invites: [],
  };
  const projected = projectWorkspace(data, user);
  assert.equal(projected.timesheets.length, 1);
  assert.equal(projected.workSchedules.length, 1);
  assert.equal(projected.meta.length, 0);
  assert.ok(!JSON.stringify(projected).includes("supplierBuyCost"));
  assert.ok(!Object.hasOwn(projected.jobs[0], "estimateMinutes"));
  assert.ok(!Object.hasOwn(projected.users[0], "email"));
});
const jobs = [
  {
    id: "a",
    name: "A",
    status: "active",
    lat: -36.829,
    lng: 174.795,
    radius: 150,
    workerIds: ["alex"],
  },
  {
    id: "secret",
    name: "Secret",
    status: "active",
    lat: -36.829,
    lng: 174.795,
    radius: 150,
    workerIds: ["sam"],
  },
];
test("GPS ranks only assigned jobs and confirms credibility with radius/accuracy", () => {
  const result = rankNearbyJobs(jobs, user, {
    latitude: -36.829,
    longitude: 174.795,
    accuracy: 10,
  });
  assert.equal(result.state, "match");
  assert.equal(result.matches.length, 1);
  assert.equal(result.suggestedJobId, "a");
  assert.equal(
    rankNearbyJobs(jobs, user, {
      latitude: -36.829,
      longitude: 174.795,
      accuracy: 500,
    }).state,
    "poor-accuracy",
  );
  assert.equal(
    rankNearbyJobs([...jobs, { ...jobs[0], id: "adjacent" }], user, {
      latitude: -36.829,
      longitude: 174.795,
      accuracy: 10,
    }).state,
    "ambiguous",
  );
});
test("GPS absence, no nearby site and missing coordinates preserve manual selection", () => {
  assert.equal(
    rankNearbyJobs(jobs, user, { latitude: 0, longitude: 0, accuracy: 10 })
      .state,
    "no-match",
  );
  assert.equal(
    rankNearbyJobs([{ ...jobs[0], lat: null }], user, {
      latitude: 0,
      longitude: 0,
      accuracy: 10,
    }).state,
    "no-coordinates",
  );
  assert.equal(
    rankNearbyJobs(jobs, user, { latitude: NaN, longitude: 0, accuracy: 0 })
      .state,
    "poor-accuracy",
  );
});

test("missing break input is not silently treated as zero", () => {
  for (const value of ["", null, undefined, false])
    assert.throws(() =>
      validateTime({
        id: "missing",
        workerId: "alex",
        jobId: "a",
        date,
        start: "07:30",
        end: "11:00",
        breakMinutes: value,
      }),
    );
  assert.throws(() =>
    validateSchedule({
      ...schedule,
      days: { 1: { ...day, breakMinutes: "" } },
    }),
  );
});
