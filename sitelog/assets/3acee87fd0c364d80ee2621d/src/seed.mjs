import { atomic, meta } from "./store.mjs";
import { workDate, shiftDate, validateTime } from "./domain.mjs";
export const PERSONAS = [
  {
    id: "alex",
    displayName: "Alex Taylor",
    email: "alex@example.test",
    role: "worker",
    active: true,
    initials: "AT",
  },
  {
    id: "sam",
    displayName: "Sam Patel",
    email: "sam@example.test",
    role: "worker",
    active: true,
    initials: "SP",
  },
  {
    id: "morgan",
    displayName: "Morgan Reed",
    email: "office@example.test",
    role: "office_admin",
    active: true,
    initials: "MR",
  },
];
export async function seed() {
  if (await meta("seeded", false)) return;
  const today = workDate(),
    yesterday = shiftDate(today, -1);
  const jobs = [
    {
      id: "harbour",
      name: "Harbour House",
      code: "SL–024",
      address: "18 Kōwhai Lane, Devonport",
      lat: -36.829,
      lng: 174.795,
      radius: 150,
      status: "active",
      estimateMinutes: 240 * 60,
      workerIds: ["alex", "sam"],
      category: "Residential renovation",
      stage: "Interior fit-out",
      instructions:
        "Use the side gate. Keep the driveway clear for deliveries. Kitchen joinery arrives Monday.",
      color: "sage",
    },
    {
      id: "ridge",
      name: "Ridgeway Extension",
      code: "SL–025",
      address: "42 Ridgeway Road, Birkenhead",
      lat: -36.805,
      lng: 174.726,
      radius: 150,
      status: "active",
      estimateMinutes: 160 * 60,
      workerIds: ["alex"],
      category: "Home extension",
      stage: "Framing",
      instructions:
        "Park on the street. The owners are living on site; please close the gate behind you.",
      color: "sand",
    },
    {
      id: "workshop",
      name: "The Workshop",
      code: "SL–026",
      address: "Lot 7, Westbank subdivision",
      lat: -36.868,
      lng: 174.619,
      radius: 200,
      status: "active",
      estimateMinutes: 96 * 60,
      workerIds: ["sam"],
      category: "New commercial space",
      stage: "Site preparation",
      instructions:
        "Undeveloped site. Access from the gravel road beside Lot 6. Meet at the site container.",
      color: "blue",
    },
    {
      id: "cedar",
      name: "Cedar Deck",
      code: "SL–021",
      address: "6 Cedar Crescent, Takapuna",
      lat: -36.785,
      lng: 174.77,
      radius: 100,
      status: "completed",
      estimateMinutes: 48 * 60,
      workerIds: ["alex", "sam"],
      category: "Outdoor living",
      stage: "Complete",
      instructions: "Project complete. Records available for reference.",
      color: "rose",
    },
  ];
  const times = [];
  for (let day = 1; day <= 5; day++)
    for (const [workerId, jobId, start, end, breakMinutes] of [
      ["alex", day === 3 ? "ridge" : "harbour", "07:30", "16:00", 30],
      ["sam", day === 2 ? "workshop" : "harbour", "08:00", "16:00", 30],
    ]) {
      times.push({
        ...validateTime({
          id: `seed-${workerId}-${day}`,
          workerId,
          jobId,
          date: shiftDate(today, -day),
          start,
          end,
          breakMinutes,
          overnight: false,
        }),
        revision: 1,
        createdAt: `${shiftDate(today, -day)}T04:00:00Z`,
        updatedAt: `${shiftDate(today, -day)}T04:00:00Z`,
        status: "open",
      });
    }
  times.push({
    ...validateTime({
      id: "seed-today-alex",
      workerId: "alex",
      jobId: "harbour",
      date: today,
      start: "07:30",
      end: "10:00",
      breakMinutes: 0,
      overnight: false,
    }),
    revision: 1,
    createdAt: `${today}T00:00:00Z`,
    updatedAt: `${today}T00:00:00Z`,
    status: "open",
  });
  const notes = [
    {
      id: "note-today",
      jobId: "harbour",
      authorId: "alex",
      date: today,
      text: "Kitchen framing finished and ready for the joinery team. Measurements checked against the latest plans.",
      createdAt: `${today}T00:10:00Z`,
    },
    {
      id: "note-yesterday",
      jobId: "harbour",
      authorId: "sam",
      date: yesterday,
      text: "All materials moved inside ahead of the rain. Side entrance is clear for the morning delivery.",
      createdAt: `${yesterday}T03:00:00Z`,
    },
    {
      id: "note-ridge",
      jobId: "ridge",
      authorId: "alex",
      date: yesterday,
      text: "Wall frames are up on the north side. Ready to start the roof framing next visit.",
      createdAt: `${yesterday}T02:00:00Z`,
    },
  ];
  await atomic(
    ["meta", "users", "jobs", "timesheets", "notes", "revisions"],
    (s) => {
      for (const u of PERSONAS) s.users.put(u);
      for (const j of jobs) s.jobs.put(j);
      for (const t of times) {
        s.timesheets.put(t);
        s.revisions.put({
          id: `${t.id}-1`,
          entryId: t.id,
          sequence: 1,
          before: null,
          after: t,
          editorId: t.workerId,
          createdAt: t.createdAt,
          reason: "Initial record",
        });
      }
      for (const n of notes) s.notes.put(n);
      s.meta.put({ id: "seeded", value: true });
      s.meta.put({
        id: "session",
        value: { userId: "alex", expiresAt: Date.now() + 7 * 86400000 },
      });
      s.meta.put({ id: "currentJob:alex", value: "harbour" });
      s.meta.put({ id: "currentJob:sam", value: "harbour" });
    },
  );
}
