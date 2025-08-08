// detectionController.js (CommonJS)
const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const { RealityDefender } = require("@realitydefender/realitydefender");

const realityDefender = new RealityDefender({
  apiKey: process.env.REALITY_DEFENDER_API_KEY || "",
});

const detectImage = (req, res) => {
  const form = new formidable.IncomingForm({
    uploadDir: path.join(__dirname, "uploads"), // ensure folder exists
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB limit (adjust as needed)
    multiples: false,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(400).json({ error: "Invalid multipart form data" });
    }

    let imageFile = files.image;
    if (Array.isArray(imageFile)) {
      imageFile = imageFile[0];
    }

    if (!imageFile || !imageFile.filepath) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const tmpPath = imageFile.filepath;

    try {
      const rdResponse = await realityDefender.detect({
        filePath: tmpPath,
      });

      // Directly extract status and score from the RD response
      const status = rdResponse?.status || "unknown";
      const score = rdResponse?.score ?? null;
      const requestId =
        rdResponse?.requestId || rdResponse?.id || rdResponse?.jobId || null;

      // Always cleanup temp file
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}

      // Return the simplified response format
      return res.json({
        requestId: requestId,
        status: status,
        score: score,
        models: rdResponse?.models || [], // Include models array if it exists
      });
    } catch (error) {
      console.error(
        "Reality Defender detect failed:",
        error?.response?.data || error,
      );
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}

      return res.status(502).json({
        error: "Upstream detection failed",
        details: error?.message || "Unknown error",
      });
    }
  });
};

module.exports = { detectImage };
