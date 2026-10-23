/**
 * cycle.controller.js
 * HTTP handlers for the cycle tracker API.
 */

import CycleService from '../service/cycle.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
const fail = (res, msg, status = 400) =>
  res.status(status).json({ success: false, message: msg });

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/cycle/summary */
async function getSummary(req, res, next) {
  try {
    const data = await CycleService.getSummary(req.user._id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

/** POST /api/cycle/start */
async function startPeriod(req, res, next) {
  try {
    const { startDate, flowLevel, symptoms, notes } = req.body;
    if (!startDate) return fail(res, "startDate is required.");
    const cycle = await CycleService.startPeriod(req.user._id, {
      startDate,
      flowLevel,
      symptoms,
      notes,
    });
    ok(res, cycle, 201);
  } catch (err) {
    next(err);
  }
}

/** POST /api/cycle/end */
async function endPeriod(req, res, next) {
  try {
    const { endDate, cycleId } = req.body;
    if (!endDate) return fail(res, "endDate is required.");
    const cycle = await CycleService.endPeriod(req.user._id, {
      endDate,
      cycleId,
    });
    ok(res, cycle);
  } catch (err) {
    next(err);
  }
}

/** POST /api/cycle/flow */
async function logFlow(req, res, next) {
  try {
    const { date, level, cycleId } = req.body;
    if (!date || !level)
      return fail(res, "date and level are required.");
    const cycle = await CycleService.logFlow(req.user._id, {
      date,
      level,
      cycleId,
    });
    ok(res, cycle);
  } catch (err) {
    next(err);
  }
}

/** GET /api/cycle/history */
async function getHistory(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const data = await CycleService.getHistory(req.user._id, {
      page: Number(page),
      limit: Number(limit),
    });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

/** GET /api/cycle/calendar?year=2024&month=10 */
async function getCalendarData(req, res, next) {
  try {
    const { year, month } = req.query;
    if (!year || !month)
      return fail(res, "year and month query params are required.");
    const data = await CycleService.getCalendarData(req.user._id, {
      year: Number(year),
      month: Number(month),
    });
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/cycle/:id */
async function updateCycle(req, res, next) {
  try {
    const cycle = await CycleService.updateCycle(
      req.user._id,
      req.params.id,
      req.body
    );
    ok(res, cycle);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/cycle/:id */
async function deleteCycle(req, res, next) {
  try {
    await CycleService.deleteCycle(req.user._id, req.params.id);
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export default {
  getSummary,
  startPeriod,
  endPeriod,
  logFlow,
  getHistory,
  getCalendarData,
  updateCycle,
  deleteCycle,
};
