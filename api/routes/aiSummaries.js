// src/routes/aiSummaryRoutes.js
import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getLedgerMonthlySummary } from "../controllers/aiSummary.js";

const router = express.Router();

/**
 * GET /api/ledgers/:ledgerId/summaries/:month
 * 例：/api/ledgers/12/summaries/2025-08
 */
router.get("/:ledgerId/summaries/:month", verifyToken, getLedgerMonthlySummary);

export default router;
