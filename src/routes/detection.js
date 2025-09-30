// detectionRoutes.js
const express = require("express");
const {
  detectImage,
  detectUrl,
  detectEmail,
} = require("../controllers/detectionController"); // Adjust path as needed

const router = express.Router();

// POST route for image detection
router.post("/image", detectImage);
router.post("/url", detectUrl);
router.post("/email", detectEmail);

module.exports = router;
