// middleware/auth.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      error: "Token manquant. Veuillez vous connecter.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.artisan = decoded; // { id, email, company }
    next();
  } catch (err) {
    return res.status(403).json({
      error: "Token invalide ou expiré.",
    });
  }
}

module.exports = { requireAuth };
