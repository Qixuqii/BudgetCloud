import express from 'express';
import { verifyToken } from "../middleware/verifyToken.js";
import { getLedgerMembers, addLedgerMember, deleteLedgerMember, updateLedgerMemberRole, transferOwnership, leaveLedger } from '../controllers/ledgerMember.js';
import { checkLedgerRole } from '../middleware/checkLedgerRole.js';

const router = express.Router();

router.get('/:ledgerId/members', verifyToken, checkLedgerRole(), getLedgerMembers);
router.post('/:ledgerId/members', verifyToken, checkLedgerRole(['owner']), addLedgerMember);
router.delete('/:ledgerId/members/:memberId', verifyToken, checkLedgerRole(['owner']), deleteLedgerMember);
router.put('/:ledgerId/members/:memberId', verifyToken, checkLedgerRole(['owner']), updateLedgerMemberRole);
router.post('/:ledgerId/transfer-owner', verifyToken, checkLedgerRole(['owner']), transferOwnership);
router.post('/:ledgerId/leave', verifyToken, checkLedgerRole(), leaveLedger);

export default router;

