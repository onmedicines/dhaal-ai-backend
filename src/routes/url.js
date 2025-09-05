const { analyzeWebsite } = require("../controllers/urlController");
const e = require("express");
const authMiddleware = require("../middlewares/auth.js");

const router = e.Router();
router.use(authMiddleware);

router.post("/generate-report", analyzeWebsite);

module.exports = router;
