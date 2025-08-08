// detectionRoutes.js
const express = require("express");
const { detectImage } = require("../controllers/detectionController"); // Adjust path as needed

const router = express.Router();

// POST route for image detection
router.post("/image", detectImage);

module.exports = router;
