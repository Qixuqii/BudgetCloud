// src/middlewares/requireAuth.js
module.exports = function requireAuth(req, res, next) {
  // 从 Authorization: Bearer <token> 解析出 user
  // req.user = { id, email, ... }
  // 这里用你现成的实现即可
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
};
