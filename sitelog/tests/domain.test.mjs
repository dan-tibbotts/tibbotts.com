import test from "node:test";
import assert from "node:assert/strict";
import {
  validateTime,
  workDate,
  shiftDate,
  zonedInstant,
  distanceMetres,
  mediaAllowed,
  canAccessJob,
  assertRevision,
  csvCell,
} from "../src/domain.mjs";
import { mergeRecords } from "../src/records.mjs";
const base = {
  id: "a",
  workerId: "alex",
  jobId: "one",
  date: "2026-11-13",
  start: "07:30",
  end: "16:00",
  breakMinutes: 30,
  overnight: false,
};
test("calculates integer worked minutes and NZDT UTC timestamps", () => {
  const t = validateTime(base);
  assert.equal(t.totalMinutes, 480);
  assert.equal(t.startAt, "2026-11-12T18:30:00.000Z");
  assert.equal(t.timeZone, "Pacific/Auckland");
});
test("rejects invalid, backwards and excessive breaks", () => {
  for (const change of [
    { start: "25:00" },
    { end: "07:00" },
    { breakMinutes: -1 },
    { breakMinutes: 510 },
    { breakMinutes: 1.5 },
    { date: "2026-02-30" },
  ])
    assert.throws(() => validateTime({ ...base, ...change }));
});
test("blocks overlapping work across jobs but permits adjacent entries", () => {
  assert.throws(
    () =>
      validateTime(
        { ...base, id: "b", jobId: "two", start: "15:00", end: "17:00" },
        [base],
      ),
    /overlaps/,
  );
  assert.equal(
    validateTime({ ...base, id: "b", start: "16:00", end: "17:00" }, [base])
      .totalMinutes,
    30,
  );
});
test("editing same entry and another worker do not count as overlaps", () => {
  assert.doesNotThrow(() => validateTime(base, [base]));
  assert.doesNotThrow(() => validateTime({ ...base, workerId: "sam" }, [base]));
});
test("cross-midnight overlap is caught on next business date", () => {
  const overnight = { ...base, start: "22:00", end: "06:00", overnight: true };
  assert.equal(validateTime(overnight).totalMinutes, 450);
  assert.throws(
    () =>
      validateTime(
        { ...base, id: "b", date: "2026-11-14", start: "05:30", end: "08:00" },
        [overnight],
      ),
    /overlaps/,
  );
});
test("accounts for spring-forward elapsed time", () => {
  assert.equal(
    validateTime({
      ...base,
      date: "2026-09-27",
      start: "01:00",
      end: "04:00",
      breakMinutes: 0,
    }).totalMinutes,
    120,
  );
});
test("accounts for fall-back elapsed time", () => {
  assert.equal(
    validateTime({
      ...base,
      date: "2026-04-05",
      start: "01:00",
      end: "04:00",
      breakMinutes: 0,
    }).totalMinutes,
    240,
  );
});
test("rejects ambiguous and nonexistent daylight-saving wall times", () => {
  assert.throws(() => zonedInstant("2026-04-05", "02:30"), /ambiguous/);
  assert.throws(() => zonedInstant("2026-09-27", "02:30"), /unavailable/);
});
test("uses Auckland business date independently of host timezone", () => {
  assert.equal(workDate(new Date("2026-11-12T12:00:00Z")), "2026-11-13");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
});
test("media respects unknown, offline, explicit network and manual override", () => {
  assert.equal(mediaAllowed("wifi", "unknown"), false);
  assert.equal(mediaAllowed("mobile", "wifi"), false);
  assert.equal(mediaAllowed("wifi", "wifi"), true);
  assert.equal(mediaAllowed("any", "unknown"), true);
  assert.equal(mediaAllowed("wifi", "unknown", true), true);
  assert.equal(mediaAllowed("any", "offline", true), false);
});
test("access checks require active identity and assigned job or office role", () => {
  const job = { workerIds: ["alex"] };
  assert.equal(
    canAccessJob({ id: "alex", active: true, role: "worker" }, job),
    true,
  );
  assert.equal(
    canAccessJob({ id: "sam", active: true, role: "worker" }, job),
    false,
  );
  assert.equal(
    canAccessJob({ id: "alex", active: false, role: "worker" }, job),
    false,
  );
  assert.equal(canAccessJob({ active: true, role: "office_admin" }, job), true);
});
test("optimistic revisions produce an explicit conflict", () => {
  assert.doesNotThrow(() => assertRevision(2, 2));
  assert.throws(
    () => assertRevision(1, 2),
    (e) => e.code === "CONFLICT",
  );
});
test("queue projection overlays a correction without duplicating accepted entries", () => {
  const accepted = [{ id: "a", value: 1 }],
    operations = [
      {
        kind: "time",
        state: "queued",
        id: "op",
        createdAt: "2026",
        data: { id: "a", value: 2 },
      },
    ];
  assert.deepEqual(mergeRecords(accepted, operations, "time"), [
    {
      id: "a",
      value: 2,
      localState: "queued",
      operationId: "op",
      error: undefined,
    },
  ]);
  assert.equal(
    mergeRecords(accepted, [{ ...operations[0], state: "synced" }], "time")[0]
      .value,
    1,
  );
});
test("CSV safely quotes content and neutralises spreadsheet formulas", () => {
  assert.equal(csvCell('hello,"world"'), '"hello,""world"""');
  assert.equal(csvCell("=SUM(A1)"), `"'=SUM(A1)"`);
});
test("distance calculation ranks identical and nearby coordinates", () => {
  const a = { lat: -36.829, lng: 174.795 };
  assert.equal(distanceMetres(a, a), 0);
  const d = distanceMetres(a, { lat: -36.83, lng: 174.795 });
  assert.ok(d > 110 && d < 112);
});
