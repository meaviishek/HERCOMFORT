import express from 'express';
import ctrl from './controllers/wellness.controller.js';
import authGuard from '../auth/auth.guard.js';

const router = express.Router();

// All routes require JWT
router.use(authGuard);

// ── Summary ───────────────────────────────────────────────────────────────────
router.get("/summary",  ctrl.getDailySummary);
router.get("/week",     ctrl.getWeeklyOverview);

// ── Mood ──────────────────────────────────────────────────────────────────────
router.post  ("/mood",          ctrl.logMood);
router.get   ("/mood/history",  ctrl.getMoodHistory);

// ── Sleep ─────────────────────────────────────────────────────────────────────
router.post  ("/sleep",           ctrl.logSleep);
router.get   ("/sleep/history",   ctrl.getSleepHistory);
router.get   ("/sleep/insights",  ctrl.getSleepInsights);

// ── Hydration ─────────────────────────────────────────────────────────────────
router.post  ("/hydration",         ctrl.logHydration);
router.post  ("/hydration/add",     ctrl.addHydration);
router.get   ("/hydration/today",   ctrl.getTodayHydration);
router.get   ("/hydration/history", ctrl.getHydrationHistory);

// ── Symptoms ──────────────────────────────────────────────────────────────────
router.post  ("/symptoms",          ctrl.logSymptoms);
router.get   ("/symptoms/history",  ctrl.getSymptomsHistory);
router.get   ("/symptoms/insights", ctrl.getSymptomInsights);

// ── Medications ───────────────────────────────────────────────────────────────
router.get   ("/medications",       ctrl.getMedications);
router.post  ("/medications",       ctrl.addMedication);
router.patch ("/medications/:id",   ctrl.updateMedication);
router.delete("/medications/:id",   ctrl.deleteMedication);

export default router;
