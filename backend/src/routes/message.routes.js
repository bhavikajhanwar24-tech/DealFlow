const express = require("express");
const router = express.Router();
const messageController = require("../controllers/message.controller");
const { requireAuth, requireActiveUser } = require("../middleware/auth.middleware");

router.use(requireAuth, requireActiveUser);

router.get("/quotations", messageController.getQuotations);
router.get("/quotations/:quotationId/ai-analysis", messageController.getAiAnalysis);
router.post("/quotations/:quotationId/ai-consult", messageController.consultAi);
router.post("/quotations/:quotationId/ai-send", messageController.sendAiOnBehalf);
router.get("/quotations/:quotationId", messageController.getMessages);
router.post("/quotations/:quotationId", messageController.sendMessage);

module.exports = router;
