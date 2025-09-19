// src/routes/categoryRoutes.js
import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getMyCategories, addCategory, updateCategory, removeCategory } from "../controllers/category.js";

const router = express.Router();

router.get("/", verifyToken, getMyCategories);
router.post("/", verifyToken, addCategory);
router.put("/:categoryId", verifyToken, updateCategory);
router.delete("/:categoryId", verifyToken, removeCategory);

export default router;
