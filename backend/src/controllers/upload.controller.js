const uploadService = require("../services/upload.service");

async function getTemplate(req, res) {
  try {
    const { entity } = req.params;
    const format = (req.query.format || "csv").toLowerCase();
    const templateData = uploadService.getTemplateData(entity);

    if (format === "json") {
      return res.json({
        success: true,
        entity,
        headers: templateData.headers,
        sample: templateData.sample
      });
    }

    // Format as CSV
    const headers = templateData.headers;
    const csvRows = [headers.join(",")];
    for (const item of templateData.sample) {
      const row = headers.map((h) => {
        let val = item[h] !== undefined ? String(item[h]) : "";
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${entity}_template.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to retrieve template."
    });
  }
}

async function bulkUpload(req, res) {
  try {
    const { entity } = req.params;
    const adminUserId = req.user.id;
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    let rows = [];

    // Support both JSON array in body and raw CSV string in body.csv or raw text
    if (Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else if (typeof req.body.csv === "string") {
      rows = uploadService.parseCSV(req.body.csv);
    } else if (typeof req.body === "string") {
      rows = uploadService.parseCSV(req.body);
    } else if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      // If client sent an array inside body directly
      if (Array.isArray(req.body.data)) {
        rows = req.body.data;
      }
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data rows provided. Please provide a non-empty CSV or rows array."
      });
    }

    let result;
    switch (entity.toLowerCase()) {
      case "products":
        result = await uploadService.bulkUploadProducts(rows, adminUserId, ip);
        break;
      case "customers":
        result = await uploadService.bulkUploadCustomers(rows, adminUserId, ip);
        break;
      case "staff":
        result = await uploadService.bulkUploadStaff(rows, adminUserId, ip);
        break;
      case "warehouses":
        result = await uploadService.bulkUploadWarehouses(rows, adminUserId, ip);
        break;
      case "quotations":
        result = await uploadService.bulkUploadQuotations(rows, adminUserId, ip);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported entity '${entity}'. Supported: products, customers, staff, warehouses, quotations.`
        });
    }

    return res.status(200).json({
      success: true,
      message: `Bulk import completed for ${entity}: ${result.success} succeeded, ${result.failed} failed.`,
      data: result
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to process bulk upload."
    });
  }
}

module.exports = {
  getTemplate,
  bulkUpload
};
