const express = require("express");
const router = express.Router();

const controller = require("../controllers/customerQuotation.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

router.use(requireAuth, requireActiveUser, requireRole("CUSTOMER"));
router.get("/", controller.list);
router.post("/requests", controller.createRequest);
router.get("/requests", controller.listRequests);
router.get("/products", controller.products);
router.get("/:id", controller.detail);
router.post("/:id/negotiate", controller.negotiate);
router.post("/:id/confirm", controller.confirm);
router.post("/:id/reject", controller.reject);

module.exports = router;
