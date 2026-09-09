const express = require("express");
const cycleController = require("./controllers/cycle.controller");
const authGuard = require("../auth/auth.guard");

const router = express.Router();

// All cycle routes require authentication
router.use(authGuard);

/** GET /api/cycle/summary */
router.get("/summary", cycleController.getSummary);

/** GET /api/cycle/history?page=1&limit=10 */
router.get("/history", cycleController.getHistory);

/** GET /api/cycle/calendar?year=2024&month=10 */
router.get("/calendar", cycleController.getCalendarData);

/** POST /api/cycle/start — log period start */
router.post("/start", cycleController.startPeriod);

/** POST /api/cycle/end — log period end */
router.post("/end", cycleController.endPeriod);

/** POST /api/cycle/flow — log flow for a day */
router.post("/flow", cycleController.logFlow);

/** PATCH /api/cycle/:id — edit a cycle */
router.patch("/:id", cycleController.updateCycle);

/** DELETE /api/cycle/:id — delete a cycle */
router.delete("/:id", cycleController.deleteCycle);

module.exports = router;
