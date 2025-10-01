// detectionController.js (CommonJS)
const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const { RealityDefender } = require("@realitydefender/realitydefender");
// const { checkWebsiteExists } = require("../utils/puppeteerService");

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
        error?.response?.data || error
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

const detectUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url is required" });
    }

    const r = await fetch("http://15.207.96.230:8001/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Upstream request failed" });
  }
};

const detectEmail = async (req, res) => {
  try {
    let { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    text = removeDatesTimes(text);

    console.log(text);

    const r = await fetch("https://anutri03-email-spam-api.hf.space/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }), // { "text": "..." }
    });

    const data = await r.json().catch(() => ({}));
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch {
    return res.status(502).json({ error: "Upstream request failed" });
  }
};

module.exports = { detectImage, detectUrl, detectEmail };

// helper functions
function removeDatesTimes(text) {
  const pattern =
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s*\d{4})?(?:\s*,?\s*(?:at\s+)?\d{1,2}:\d{2}(?:\s?[APap][Mm])?)?/g;

  let cleaned = text.replace(pattern, "");

  // remove spaces and commas
  cleaned = cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/^,\s*/, "")
    .trim();

  return cleaned;
}
