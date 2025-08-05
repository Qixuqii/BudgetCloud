import express from 'express';
import { verifyToken } from "../middleware/verifyToken.js";
import { getLedgerMembers, addLedgerMember, deleteLedgerMember } from '../controllers/ledgerMember.js';

const router = express.Router();

router.get('/', verifyToken, getLedgerMembers);
router.post('/', verifyToken, addLedgerMember);
router.delete('/:id', verifyToken, deleteLedgerMember);
router.put('/:id', verifyToken, updateLedgerMemberRole);

export default router;