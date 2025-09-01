// src/routes/categoryRoutes.js
import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getMyCategories, addCategory, removeCategory } from "../controllers/category.js";

const router = express.Router();

router.get("/", verifyToken, getMyCategories);
router.post("/", verifyToken, addCategory);
router.delete("/:categoryId", verifyToken, removeCategory);

export default router;
