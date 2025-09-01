// src/routes/userRoutes.js
import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getMe } from "../controllers/user.js";

const router = express.Router();

// GET /api/users/me
router.get("/me", verifyToken, getMe);

export default router;
