const { Groq } = require("groq-sdk");

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in backend .env");
  }
  return new Groq({ apiKey });
};

// Helper to make AI API calls with JSON output
const generateJsonResponse = async (prompt) => {
  const groq = getGroqClient();
  
  try {
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { 
          role: "system", 
          content: "You are an enterprise AI engine for DealFlow360. Always return valid JSON only. Do NOT wrap in markdown ticks unless necessary. Respond only with raw JSON." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });

    let content = response.choices[0]?.message?.content || "";
    
    // Extract JSON block using regex if there's conversational text or code blocks
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      content = jsonMatch[0];
    } else {
      content = content.trim();
      if (content.startsWith("```json")) {
        content = content.replace(/^```json/, "");
        content = content.replace(/```$/, "");
      } else if (content.startsWith("```")) {
        content = content.replace(/^```/, "");
        content = content.replace(/```$/, "");
      }
    }
    
    content = content.trim();
    return JSON.parse(content);
  } catch (error) {
    // Log full error for server-side debugging
    const errMsg = error?.error?.message || error?.message || String(error);
    const errStatus = error?.status || error?.statusCode || 500;
    console.error("GROQ API ERROR:", errMsg, "| Status:", errStatus, "| Full:", JSON.stringify(error?.error || error));
    throw new Error(`AI Engine Error (${errStatus}): ${errMsg}`);
  }
};

// 1. Negotiation Copilot
exports.analyzeNegotiation = async (req, res) => {
  try {
    const { currentDiscount = 0, allowedDiscount = 15, currentMargin = 20, messages = [] } = req.body;
    
    const msgList = Array.isArray(messages) ? messages : [];
    const chatHistoryText = msgList.length > 0
      ? msgList.map(m => `${m.sender_role || 'User'} (${m.sender_name || 'Participant'}): ${m.message || ''}`).join("\n")
      : "No direct chat messages yet. The client is reviewing the initial quotation.";

    const prompt = `
      You are an expert sales negotiation copilot assisting a sales representative.
      Analyze the quotation context and conversation history to recommend the next best action.
      
      Deal Financial Context:
      - Current Discount applied: ${currentDiscount}%
      - Allowed Maximum Discount Policy: ${allowedDiscount}%
      - Current Profit Margin: ${currentMargin}%

      Chat History:
      ${chatHistoryText}

      Determine:
      1. Has the customer requested a discount, term modification, or concession? What is it? (If no chat, state initial review status).
      2. What is the risk level (Low, Medium, High) based on margin protection and discount boundaries?
      3. What is the estimated resulting margin if customer terms are accepted?
      4. Suggest a tactical action (e.g., "Hold price and bundle warranty", "Offer 5% with faster sign-off", "Escalate to manager").
      5. Draft a high-conversion, professional reply for the sales rep to send.

      Output JSON ONLY in this format:
      {
        "detectedRequest": "string",
        "requestedValue": "string",
        "riskLevel": "Low | Medium | High",
        "estimatedMargin": "string",
        "suggestedAction": "string",
        "suggestedReply": "string"
      }
    `;

    const aiResult = await generateJsonResponse(prompt);
    res.json({ success: true, data: aiResult });
  } catch (error) {
    console.error("Error in Negotiation Copilot:", error);
    res.status(500).json({ success: false, message: "Error analyzing negotiation", error: error.message });
  }
};

// 2. Deal Health Explanation
exports.explainDealHealth = async (req, res) => {
  try {
    const { healthScore = 50, status = "REVIEW", reasons = [], dealDetails = {} } = req.body;
    const reasonList = Array.isArray(reasons) ? reasons : [];

    const prompt = `
      You are an expert Sales Operations Analyst AI. 
      A quotation has been scored by our deal risk engine with a Health Score of ${healthScore}/100 and a status of ${status}.
      
      Risk Factors flagged:
      ${reasonList.length > 0 ? reasonList.map(r => "- " + r).join("\n") : "- Standard margin and discount review"}
      
      Deal Details:
      - Discount: ${dealDetails.discountPercent || dealDetails.discount_amount || '0%'}
      - Margin: ${dealDetails.margin_percentage || 'N/A'}%
      - Current Deal Status: ${dealDetails.status || 'DRAFT'}
      
      Explain why this deal is healthy or at risk in 2 concise bullet points. 
      Then provide 2-3 high-impact recommended actions to optimize profitability or accelerate approval.
      
      Return a JSON object in this format:
      {
        "explanation": ["string", "string"],
        "recommendations": ["string", "string"]
      }
    `;

    const aiResult = await generateJsonResponse(prompt);
    res.json({ success: true, data: aiResult });
  } catch (error) {
    console.error("Error in Deal Health Explanation:", error);
    res.status(500).json({ success: false, message: "Error explaining deal health", error: error.message });
  }
};

// 3. Pricing Recommendation
exports.recommendPricing = async (req, res) => {
  try {
    const { productCosts = [], currentMargin = 20, tierMaxDiscount = 15 } = req.body;

    const prompt = `
      You are an expert pricing intelligence AI for B2B enterprise sales.
      The sales representative wants an optimal discount and pricing recommendation for a quotation.
      
      Context:
      - Current Margin: ${currentMargin}%
      - Customer Tier Max Allowed Discount Policy: ${tierMaxDiscount}%
      - Product Cost Mix: ${JSON.stringify(productCosts)}
      
      Suggest an optimal discount percentage that preserves a healthy gross margin (target ≥18%), respects the tier maximum discount, and maximizes win probability.
      Provide concise business rationale.

      Return a JSON object in this format:
      {
        "recommendedDiscount": number,
        "reasoning": "string"
      }
    `;

    const aiResult = await generateJsonResponse(prompt);
    res.json({ success: true, data: aiResult });
  } catch (error) {
    const detail = error?.message || String(error);
    console.error("Error in Pricing Recommendation:", detail);
    res.status(500).json({ success: false, message: "Error recommending pricing", error: detail });
  }
};

// 4. Sales Insights Summary
exports.getSalesInsights = async (req, res) => {
  try {
    const { kpis = {}, salesRepPerformance = [], topProducts = [], approvals = {} } = req.body;

    const prompt = `
      You are a Chief Revenue Officer AI.
      Analyze the following sales dashboard metrics for leadership:
      
      KPIs: ${JSON.stringify(kpis)}
      Sales Rep Performance: ${JSON.stringify(salesRepPerformance)}
      Top Products: ${JSON.stringify(topProducts)}
      Approvals Status: ${JSON.stringify(approvals)}
      
      Identify 3 key strategic insights or margin risks across revenue, discounting, and rep conversion.
      Then provide 2 actionable recommendations for the executive team.
      
      Return a JSON object:
      {
        "insights": ["string", "string", "string"],
        "recommendations": ["string", "string"]
      }
    `;

    const aiResult = await generateJsonResponse(prompt);
    res.json({ success: true, data: aiResult });
  } catch (error) {
    console.error("Error in Sales Insights:", error);
    res.status(500).json({ success: false, message: "Error generating sales insights", error: error.message });
  }
};

// 5. Smart Alerts
exports.getSmartAlerts = async (req, res) => {
  try {
    const prompt = `
      You are an intelligent deal monitoring AI for DealFlow360 enterprise sales.
      Generate 3 highly realistic, actionable smart alerts for the executive dashboard:
      - Stalled high-value deal or delayed customer response
      - Anomalous high discount exceeding floor margin
      - Urgent quote requiring governance approval
      
      Return a JSON object in this format:
      {
        "alerts": [
          {
            "id": "alert-1",
            "type": "WARNING | INFO | CRITICAL",
            "message": "Concise alert message with quotation context",
            "actionRequired": "Concrete step required"
          }
        ]
      }
    `;

    const aiResult = await generateJsonResponse(prompt);
    const alerts = Array.isArray(aiResult) ? aiResult : (aiResult.alerts || []);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error("Error in Smart Alerts:", error);
    res.status(500).json({ success: false, message: "Error generating smart alerts", error: error.message });
  }
};

// 6. Connection Test (diagnostics)
exports.testConnection = async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: "GROQ_API_KEY is not set in .env" });
  }
  try {
    const { Groq } = require("groq-sdk");
    const groq = new Groq({ apiKey });
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: 'Return JSON only: {"status":"ok"}' }],
      response_format: { type: "json_object" },
      max_tokens: 64,
      temperature: 0,
    });
    const content = response.choices[0]?.message?.content || "";
    res.json({ success: true, message: "Groq LLM connected", response: JSON.parse(content), keyPrefix: apiKey.slice(0, 8) + "..." });
  } catch (error) {
    const errMsg = error?.error?.message || error?.message || String(error);
    const errStatus = error?.status || 500;
    res.status(500).json({ success: false, message: "Groq connection failed", error: errMsg, httpStatus: errStatus });
  }
};
