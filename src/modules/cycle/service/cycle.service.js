/**
 * cycle.service.js
 * Business logic for period / cycle tracking.
 */

import Cycle from '../../../models/Cycle.js';
import dayjs from 'dayjs';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute average cycle length from a sorted (desc) array of cycles.
 * Returns null if fewer than 2 cycles.
 */
function avgCycleLength(cycles) {
  if (cycles.length < 2) return null;
  let total = 0;
  let count = 0;
  for (let i = 0; i < cycles.length - 1; i++) {
    const diff = dayjs(cycles[i].startDate).diff(
      dayjs(cycles[i + 1].startDate),
      "day"
    );
    if (diff > 0 && diff <= 60) {
      total += diff;
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : null;
}

/**
 * Detect irregularity: if any cycle length deviates > 7 days from the average.
 */
function detectIrregularity(cycles) {
  const avg = avgCycleLength(cycles);
  if (!avg) return false;
  for (let i = 0; i < cycles.length - 1; i++) {
    const diff = dayjs(cycles[i].startDate).diff(
      dayjs(cycles[i + 1].startDate),
      "day"
    );
    if (Math.abs(diff - avg) > 7) return true;
  }
  return false;
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * Start a new period cycle.
 * Closes any ongoing cycle if one exists.
 */
async function startPeriod(userId, { startDate, flowLevel, symptoms, notes }) {
  const start = dayjs(startDate).startOf("day").toDate();

  // Close previous open cycle if it has no endDate
  const openCycle = await Cycle.findOne({
    user: userId,
    endDate: null,
  }).sort({ startDate: -1 });

  if (openCycle && dayjs(openCycle.startDate).isBefore(dayjs(start))) {
    openCycle.endDate = dayjs(start).subtract(1, "day").endOf("day").toDate();
    openCycle.periodDuration = dayjs(openCycle.endDate).diff(
      dayjs(openCycle.startDate),
      "day"
    ) + 1;
    await openCycle.save();
  }

  const flowLogs = flowLevel
    ? [{ date: start, level: flowLevel }]
    : [];

  const cycle = await Cycle.create({
    user: userId,
    startDate: start,
    flowLogs,
    symptoms: symptoms || [],
    notes: notes || null,
  });

  return cycle;
}

/**
 * End an ongoing period.
 */
async function endPeriod(userId, { endDate, cycleId }) {
  const query = cycleId
    ? { _id: cycleId, user: userId }
    : { user: userId, endDate: null };

  const cycle = await Cycle.findOne(query).sort({ startDate: -1 });
  if (!cycle) throw { status: 404, message: "No active cycle found." };

  const end = dayjs(endDate).endOf("day").toDate();
  cycle.endDate = end;
  cycle.periodDuration =
    dayjs(end).diff(dayjs(cycle.startDate), "day") + 1;

  await cycle.save();

  // Recalculate cycleLength for the previous cycle
  const allCycles = await Cycle.find({ user: userId }).sort({ startDate: -1 });
  const idx = allCycles.findIndex((c) => c._id.toString() === cycle._id.toString());
  if (idx < allCycles.length - 1) {
    const prevCycle = allCycles[idx + 1];
    prevCycle.cycleLength = dayjs(cycle.startDate).diff(
      dayjs(prevCycle.startDate),
      "day"
    );
    await prevCycle.save();
  }

  return cycle;
}

/**
 * Log or update flow for a specific day in the current (or specified) cycle.
 */
async function logFlow(userId, { date, level, cycleId }) {
  const query = cycleId
    ? { _id: cycleId, user: userId }
    : { user: userId, endDate: null };
  const cycle = await Cycle.findOne(query).sort({ startDate: -1 });
  if (!cycle) throw { status: 404, message: "No active cycle found." };

  const targetDate = dayjs(date).startOf("day").toDate();
  const existing = cycle.flowLogs.find(
    (fl) =>
      dayjs(fl.date).startOf("day").isSame(dayjs(targetDate).startOf("day"))
  );
  if (existing) {
    existing.level = level;
  } else {
    cycle.flowLogs.push({ date: targetDate, level });
  }
  await cycle.save();
  return cycle;
}

/**
 * Update a cycle (edit missed / incorrect entries).
 */
async function updateCycle(userId, cycleId, updates) {
  const cycle = await Cycle.findOne({ _id: cycleId, user: userId });
  if (!cycle) throw { status: 404, message: "Cycle not found." };

  const allowed = [
    "startDate",
    "endDate",
    "flowLogs",
    "symptoms",
    "notes",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) cycle[key] = updates[key];
  }

  if (cycle.startDate && cycle.endDate) {
    cycle.periodDuration =
      dayjs(cycle.endDate).diff(dayjs(cycle.startDate), "day") + 1;
  }

  await cycle.save();
  return cycle;
}

/**
 * Delete a cycle.
 */
async function deleteCycle(userId, cycleId) {
  const result = await Cycle.findOneAndDelete({ _id: cycleId, user: userId });
  if (!result) throw { status: 404, message: "Cycle not found." };
  return result;
}

/**
 * Get dashboard / home summary for a user.
 */
async function getSummary(userId) {
  const cycles = await Cycle.find({ user: userId })
    .sort({ startDate: -1 })
    .limit(12);

  if (!cycles.length) {
    return { hasData: false };
  }

  const latest = cycles[0];
  const today = dayjs().startOf("day");
  const avgLen = avgCycleLength(cycles) || 28;
  const avgPeriodDur =
    cycles
      .filter((c) => c.periodDuration)
      .reduce((s, c) => s + c.periodDuration, 0) /
      (cycles.filter((c) => c.periodDuration).length || 1) || 5;

  const isOngoing = !latest.endDate;
  const cycleStart = dayjs(latest.startDate);

  // Days into current cycle
  const cycleDay = today.diff(cycleStart, "day") + 1;

  // Next period prediction
  const nextPeriodDate = cycleStart.add(avgLen, "day");
  const daysUntilNextPeriod = nextPeriodDate.diff(today, "day");

  // Fertile window: ~5 days before ovulation (ovulation = day 14 of cycle)
  const ovulationDate = cycleStart.add(avgLen - 14, "day");
  const fertileWindowStart = ovulationDate.subtract(5, "day");
  const fertileWindowEnd = ovulationDate.add(1, "day");

  // Phase
  let phase = "follicular";
  if (isOngoing && cycleDay <= (avgPeriodDur || 5)) {
    phase = "menstrual";
  } else if (
    today.isSame(ovulationDate, "day") ||
    (today.isAfter(fertileWindowStart) && today.isBefore(fertileWindowEnd))
  ) {
    phase = "ovulation";
  } else if (today.isAfter(ovulationDate)) {
    phase = "luteal";
  }

  const irregular = detectIrregularity(cycles);

  return {
    hasData: true,
    currentCycle: latest,
    isOngoing,
    cycleDay,
    avgCycleLength: Math.round(avgLen),
    avgPeriodDuration: Math.round(avgPeriodDur),
    nextPeriodDate: nextPeriodDate.toISOString(),
    daysUntilNextPeriod,
    ovulationDate: ovulationDate.toISOString(),
    fertileWindowStart: fertileWindowStart.toISOString(),
    fertileWindowEnd: fertileWindowEnd.toISOString(),
    phase,
    isIrregular: irregular,
  };
}

/**
 * Get full cycle history (paginated).
 */
async function getHistory(userId, { page = 1, limit = 10 } = {}) {
  const skip = (page - 1) * limit;
  const [cycles, total] = await Promise.all([
    Cycle.find({ user: userId })
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit),
    Cycle.countDocuments({ user: userId }),
  ]);
  return { cycles, total, page, pages: Math.ceil(total / limit) };
}

/**
 * Get all cycle data for a calendar month.
 */
async function getCalendarData(userId, { year, month }) {
  const start = dayjs(`${year}-${String(month).padStart(2, "0")}-01`)
    .startOf("month")
    .toDate();
  const end = dayjs(start).endOf("month").toDate();

  const cycles = await Cycle.find({
    user: userId,
    $or: [
      { startDate: { $lte: end }, endDate: { $gte: start } },
      { startDate: { $gte: start, $lte: end } },
      { startDate: { $lte: end }, endDate: null },
    ],
  }).sort({ startDate: 1 });

  return cycles;
}

export default {
  startPeriod,
  endPeriod,
  logFlow,
  updateCycle,
  deleteCycle,
  getSummary,
  getHistory,
  getCalendarData,
};
