// routes/ledgerRoutes.js
import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { checkLedgerRole } from "../middleware/checkLedgerRole.js";
// 根据你的文件名调整：如果是 ledgerController.js，就改成对应路径
import {
  createLedger,
  listMyLedgers,
  getLedger,
  renameLedger,
  removeLedger,
} from "../controllers/ledger.js";

const router = express.Router();

/**
 * 创建账本（当前登录用户为 owner）
 * POST /api/ledgers
 */
router.post("/", verifyToken, createLedger);

/**
 * 我的账本列表（作为 owner 或成员均可见）
 * GET /api/ledgers
 */
router.get("/", verifyToken, listMyLedgers);

/**
 * 单个账本详情（成员/owner 都可访问）
 * GET /api/ledgers/:ledgerId
 * 如果你的 controller 里读的是 req.params.id，就把 :ledgerId 改成 :id
 */
router.get("/:ledgerId", verifyToken, checkLedgerRole(), getLedger);

/**
 * 修改账本名称（仅 owner）
 * PATCH /api/ledgers/:ledgerId
 */
// Allow owner and editor to rename ledger
router.patch("/:ledgerId", verifyToken, checkLedgerRole(["owner","editor"]), renameLedger);

/**
 * 删除账本（仅 owner）
 * DELETE /api/ledgers/:ledgerId
 */
router.delete("/:ledgerId", verifyToken, checkLedgerRole(["owner"]), removeLedger);

export default router;
