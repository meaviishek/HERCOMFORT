const svc = require("../service/wellness.service");

const ok  = (res, data) => res.json({ success: true, data });
const err = (res, e, status = 500) => res.status(status).json({ success: false, message: e.message || "Server error" });

// ── Mood ──────────────────────────────────────────────────────────────────────
exports.logMood = async (req, res) => {
  try { ok(res, await svc.logMood(req.user._id, req.body)); } catch (e) { err(res, e); }
};
exports.getMoodHistory = async (req, res) => {
  try { ok(res, await svc.getMoodHistory(req.user._id, Number(req.query.days) || 30)); } catch (e) { err(res, e); }
};

// ── Sleep ─────────────────────────────────────────────────────────────────────
exports.logSleep = async (req, res) => {
  try { ok(res, await svc.logSleep(req.user._id, req.body)); } catch (e) { err(res, e); }
};
exports.getSleepHistory = async (req, res) => {
  try { ok(res, await svc.getSleepHistory(req.user._id, Number(req.query.days) || 30)); } catch (e) { err(res, e); }
};
exports.getSleepInsights = async (req, res) => {
  try { ok(res, await svc.getSleepInsights(req.user._id)); } catch (e) { err(res, e); }
};

// ── Hydration ─────────────────────────────────────────────────────────────────
exports.logHydration = async (req, res) => {
  try { ok(res, await svc.logHydration(req.user._id, req.body)); } catch (e) { err(res, e); }
};
exports.addHydration = async (req, res) => {
  try { ok(res, await svc.addHydration(req.user._id, req.body)); } catch (e) { err(res, e); }
};
exports.getTodayHydration = async (req, res) => {
  try { ok(res, await svc.getTodayHydration(req.user._id)); } catch (e) { err(res, e); }
};
exports.getHydrationHistory = async (req, res) => {
  try { ok(res, await svc.getHydrationHistory(req.user._id, Number(req.query.days) || 7)); } catch (e) { err(res, e); }
};

// ── Symptoms ──────────────────────────────────────────────────────────────────
exports.logSymptoms = async (req, res) => {
  try { ok(res, await svc.logSymptoms(req.user._id, req.body)); } catch (e) { err(res, e); }
};
exports.getSymptomsHistory = async (req, res) => {
  try { ok(res, await svc.getSymptomsHistory(req.user._id, Number(req.query.days) || 30)); } catch (e) { err(res, e); }
};
exports.getSymptomInsights = async (req, res) => {
  try { ok(res, await svc.getSymptomInsights(req.user._id)); } catch (e) { err(res, e); }
};

// ── Medications ───────────────────────────────────────────────────────────────
exports.getMedications = async (req, res) => {
  try { ok(res, await svc.getMedications(req.user._id)); } catch (e) { err(res, e); }
};
exports.addMedication = async (req, res) => {
  try { ok(res, await svc.addMedication(req.user._id, req.body)); } catch (e) { err(res, e); }
};
exports.updateMedication = async (req, res) => {
  try { ok(res, await svc.updateMedication(req.user._id, req.params.id, req.body)); } catch (e) { err(res, e); }
};
exports.deleteMedication = async (req, res) => {
  try { ok(res, await svc.deleteMedication(req.user._id, req.params.id)); } catch (e) { err(res, e); }
};

// ── Overview ─────────────────────────────────────────────────────────────────
exports.getDailySummary = async (req, res) => {
  try { ok(res, await svc.getDailySummary(req.user._id, req.query.date)); } catch (e) { err(res, e); }
};
exports.getWeeklyOverview = async (req, res) => {
  try { ok(res, await svc.getWeeklyOverview(req.user._id)); } catch (e) { err(res, e); }
};
