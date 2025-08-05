import express from 'express';
import { addTransaction, deleteTransaction, getTransactions, getTransaction,updateTransaction } from '../controllers/transaction.js';
import { verifyToken } from "../middleware/verifyToken.js";
import { checkLedgerRole } from '../middleware/CheckLedgerRole.js';

const router = express.Router();

router.get('/', verifyToken, getTransactions);
router.get('/:id', verifyToken, getTransaction);
router.post('/', verifyToken, addTransaction);
router.delete('/:id', verifyToken, deleteTransaction);
router.put('/:id', verifyToken, updateTransaction);

export default router;