const messageService = require("../services/message.service");

class MessageController {
  async getQuotations(req, res, next) {
    try {
      const data = await messageService.getQuotationsForUser(req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getMessages(req, res, next) {
    try {
      const { quotationId } = req.params;
      const data = await messageService.getMessagesByQuotationId(
        quotationId,
        req.user,
        req.query.recipientRole,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { quotationId } = req.params;
      const { message, recipientRole } = req.body;
      const data = await messageService.sendMessage({
        quotationId,
        senderId: req.user.id,
        senderRole: req.user.role,
        senderName: req.user.full_name || req.user.email,
        message,
        recipientRole,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getAiAnalysis(req, res, next) {
    try {
      const { quotationId } = req.params;
      const data = await messageService.analyzeQuotationDeal(quotationId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async consultAi(req, res, next) {
    try {
      const { quotationId } = req.params;
      const { prompt, recipientRole } = req.body;
      const aiService = require("../services/ai.service");
      const data = await aiService.consultNegotiator(
        quotationId,
        prompt || "Analyze this quotation negotiation and suggest a response.",
        req.user,
        recipientRole || "CUSTOMER"
      );
      res.json({ success: true, data });
    } catch (err) {
      console.error("[MessageController.consultAi] Error:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Failed to consult AI negotiator",
      });
    }
  }

  async sendAiOnBehalf(req, res, next) {
    try {
      const { quotationId } = req.params;
      const { message, recipientRole } = req.body;
      const data = await messageService.sendMessage({
        quotationId,
        senderId: req.user.id,
        senderRole: req.user.role,
        senderName: `${req.user.full_name || req.user.email} (via AI Assistant)`,
        message,
        recipientRole
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async markRead(req, res, next) {
    try {
      const { quotationId } = req.params;
      await messageService.markAsRead(quotationId, req.user.id);
      res.json({ success: true, message: "Marked as read" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MessageController();
