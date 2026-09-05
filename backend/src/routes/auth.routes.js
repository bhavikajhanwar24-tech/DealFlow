const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const {
  validateCustomerRegister,
  validateLogin
} = require("../validators/auth.validator");
const { requireAuth } = require("../middleware/auth.middleware");

// Public endpoints
router.post(
  "/customer/register",
  validateCustomerRegister,
  authController.registerCustomer
);

router.post("/login", validateLogin, authController.login);

// Protected endpoints
router.get("/me", requireAuth, authController.getMe);
router.post("/logout", requireAuth, authController.logout);

module.exports = router;
