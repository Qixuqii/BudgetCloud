// src/controllers/categoryController.js
import {
  listCategoriesByUser,
  createCategory,
  deleteCategoryById,
  updateCategoryName,
} from "../dao/categoryDao.js";

/**
 * GET /api/categories?type=income|expense
 */
export async function getMyCategories(req, res) {
  try {
    const userId = req.user.id;
    const { type } = req.query;
    if (type && !["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }
    const rows = await listCategoriesByUser(userId, type);
    return res.json(rows);
  } catch (e) {
    console.error("getMyCategories error:", e);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
}

/**
 * POST /api/categories
 * body: { name, type }  // type: 'income' | 'expense'
 */
export async function addCategory(req, res) {
  try {
    const userId = req.user.id;
    const { name, type } = req.body || {};
    if (!name?.trim() || !["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "name/type required" });
    }
    const result = await createCategory({
      userId,
      name: name.trim(),
      type,
    });
    if (result.duplicated) {
      return res.status(409).json({ message: "Category already exists" });
    }
    return res.status(201).json(result);
  } catch (e) {
    console.error("addCategory error:", e);
    return res.status(500).json({ message: "Failed to create category" });
  }
}

/**
 * PUT /api/categories/:categoryId
 * body: { name }
 */
export async function updateCategory(req, res) {
  try {
    const userId = req.user.id;
    const categoryId = Number(req.params.categoryId);
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'name required' });
    }
    const result = await updateCategoryName({
      categoryId,
      userId,
      name: name.trim(),
    });
    if (result.duplicated) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    if (!result.updated) {
      return res.status(404).json({ message: 'Category not found' });
    }
    return res.json({ id: categoryId, name: result.name, type: result.type });
  } catch (e) {
    console.error('updateCategory error:', e);
    return res.status(500).json({ message: 'Failed to update category' });
  }
}


/**
 * DELETE /api/categories/:categoryId
 */
export async function removeCategory(req, res) {
  try {
    const userId = req.user.id;
    const categoryId = Number(req.params.categoryId);
    const result = await deleteCategoryById(categoryId, userId);
    if (result.inUse) {
      return res
        .status(409)
        .json({ message: `Category in use by ${result.count} transaction(s)` });
    }
    if (!result.deleted) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.json({ id: categoryId, deleted: true });
  } catch (e) {
    console.error("removeCategory error:", e);
    return res.status(500).json({ message: "Failed to delete category" });
  }
}
