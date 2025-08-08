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

    // Formidable can provide a single file or an array depending on the client
    let imageFile = files.image;
    console.log(imageFile);
    if (Array.isArray(imageFile)) {
      imageFile = imageFile[0];
    }

    if (!imageFile || !imageFile.filepath) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const tmpPath = imageFile.filepath;

    try {
      // Reality Defender detect call using the saved temp file
      // Refer to RD docs for optional params like detectors, waitForCompletion, etc.
      const rdResponse = await realityDefender.detect({
        filePath: tmpPath,
        // Optional advanced usage:
        // waitForCompletion: true,
        // detectors: ['image-deepfake', 'image-spoof', 'image-tamper'],
        // metadata: { source: 'api-upload' }
      });

      // Example response shapes vary; try to normalize:
      // Some SDK responses contain fields like:
      // - verdict / category: 'real' | 'fake'
      // - confidence / score: 0..1
      // - results: per-detector outputs
      const category =
        rdResponse?.verdict ||
        rdResponse?.category ||
        rdResponse?.result ||
        rdResponse?.overall?.label ||
        "unknown";

      // Prefer "confidence" then "score" then overall confidence if available
      const confidence =
        rdResponse?.confidence ??
        rdResponse?.score ??
        rdResponse?.overall?.confidence ??
        null;

      // Map to final result: "real" | "fake" | "spoof"
      // If SDK explicitly says fake/real, trust that first; otherwise use heuristic with confidence.
      let finalResult = "real";

      if (typeof category === "string") {
        const normalized = category.toLowerCase();
        if (
          normalized.includes("fake") ||
          normalized.includes("spoof") ||
          normalized.includes("tamper")
        ) {
          // If confidence/score is high, consider it spoof; else fake
          if (typeof confidence === "number" && confidence >= 0.7) {
            finalResult = "spoof";
          } else {
            finalResult = "fake";
          }
        } else if (
          normalized.includes("real") ||
          normalized.includes("authentic")
        ) {
          // Real but very low confidence → treat as spoof/suspicious
          if (typeof confidence === "number" && confidence < 0.5) {
            finalResult = "spoof";
          } else {
            finalResult = "real";
          }
        } else {
          // Unknown verdict; fallback on confidence threshold if present
          if (typeof confidence === "number") {
            if (confidence >= 0.8) {
              finalResult = "real";
            } else if (confidence <= 0.3) {
              finalResult = "fake";
            } else {
              finalResult = "spoof";
            }
          } else {
            // If no confidence exposed, default to spoof (uncertain)
            finalResult = "spoof";
          }
        }
      } else {
        // No category string found; fallback based on confidence (if available)
        if (typeof confidence === "number") {
          if (confidence >= 0.8) {
            finalResult = "real";
          } else if (confidence <= 0.3) {
            finalResult = "fake";
          } else {
            finalResult = "spoof";
          }
        } else {
          finalResult = "spoof";
        }
      }

      // Always cleanup temp file
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}

      // Include raw signals for frontend debugging if desired
      return res.json({
        result: finalResult,
        rd: {
          category,
          confidence,
          id: rdResponse?.id || rdResponse?.jobId || null,
          // You can expose more fields as needed:
          // results: rdResponse?.results,
          // detectors: rdResponse?.detectors
        },
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
