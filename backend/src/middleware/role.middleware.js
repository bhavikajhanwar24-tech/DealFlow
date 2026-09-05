function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of roles: ${allowedRoles.join(", ")}`,
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};
