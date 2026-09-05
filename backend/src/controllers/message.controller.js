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
      const data = await messageService.getMessagesByQuotationId(quotationId, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { quotationId } = req.params;
      const { message } = req.body;
      const data = await messageService.sendMessage({
        quotationId,
        senderId: req.user.id,
        senderRole: req.user.role,
        senderName: req.user.full_name || req.user.email,
        message,
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

  async generateAutoReply(req, res, next) {
    try {
      const { quotationId } = req.params;
      const data = await messageService.generateAIAutoReply(quotationId, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MessageController();
