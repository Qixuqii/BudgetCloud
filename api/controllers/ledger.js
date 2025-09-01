// src/controllers/ledgerController.js
import {
  createLedgerWithOwner,
  listLedgersByUser,
  getLedgerById,
  updateLedgerName,
  deleteLedger,
} from "../dao/ledgerDao.js";

export async function createLedger(req, res) {
  try {
    const ownerId = req.user.id;
    const { name } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ message: "Ledger name is required" });
    }
    const created = await createLedgerWithOwner({ name: name.trim(), ownerId });
    return res.status(201).json(created);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to create ledger" });
  }
}

export async function listMyLedgers(req, res) {
  try {
    const rows = await listLedgersByUser(req.user.id);
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to fetch ledgers" });
  }
}

export async function getLedger(req, res) {
  try {
    const ledgerId = Number(req.params.ledgerId);   // ✅ 修复
    const detail = await getLedgerById(ledgerId, req.user.id);
    if (!detail) return res.status(404).json({ message: "Ledger not found" });
    if (!detail.accessible) return res.status(403).json({ message: "Forbidden" });
    return res.json(detail);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to fetch ledger" });
  }
}

export async function renameLedger(req, res) {
  try {
    const { name } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ message: "Ledger name is required" });
    }
    const ledgerId = Number(req.params.ledgerId);   // ✅ 修复
    const ok = await updateLedgerName(ledgerId, req.user.id, name.trim());
    if (!ok) return res.status(403).json({ message: "Only owner can rename" });
    return res.json({ id: ledgerId, name: name.trim() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to rename ledger" });
  }
}

export async function removeLedger(req, res) {
  try {
    const ledgerId = Number(req.params.ledgerId);   // ✅ 修复
    const ok = await deleteLedger(ledgerId, req.user.id);
    if (!ok) return res.status(403).json({ message: "Only owner can delete" });
    return res.json({ id: ledgerId, deleted: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to delete ledger" });
  }
}
