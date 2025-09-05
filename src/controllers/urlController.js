const WebsiteExtractor = require("../utils/url/website-extractor");
const TechnologyStackDetector = require("../utils/url/tech-stack-detector");
const VulnerabilityDetector = require("../utils/url/vulnerability-detector");
const { whoisDomain } = require("whoiser"); // ✅ Add whoiser

/**
 * POST /api/analyze
 * Body: { url: string }
 * Returns: { url, timestamp, technology, vulnerabilities, whois }
 */
async function analyzeWebsite(req, res) {
  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      error: "URL is required",
      data: null,
    });
  }

  const extractor = new WebsiteExtractor();

  try {
    console.log(`🚀 Starting analysis for: ${url}`);

    await extractor.initialize();
    const extracted = await extractor.extractWebsiteData(url);

    // Run detectors
    const techDetector = new TechnologyStackDetector(extracted, {
      silent: true,
    });
    const techReport = techDetector.detectAll();

    const vulnDetector = new VulnerabilityDetector(extracted);
    const vulnReport = vulnDetector.detectAll();

    // ✅ WHOIS/RDAP lookup
    let whoisReport = null;
    try {
      const domain = new URL(url).hostname;
      const rawWhois = await whoisDomain(domain);

      // most WHOIS responses are nested under the registry key (e.g. "whois.nic.io")
      const whoisData = Object.values(rawWhois)[0] || {};

      whoisReport = {
        domainName: whoisData["Domain Name"] || domain,
        registrar: whoisData["Registrar"] || null,
        registrarIanaId: whoisData["Registrar IANA ID"] || null,
        registrarUrl: whoisData["Registrar URL"] || null,
        abuseContact: {
          email: whoisData["Registrar Abuse Contact Email"] || null,
          phone: whoisData["Registrar Abuse Contact Phone"] || null,
        },
        createdDate: whoisData["Created Date"] || null,
        updatedDate: whoisData["Updated Date"] || null,
        expiryDate: whoisData["Expiry Date"] || null,
        status: whoisData["Domain Status"] || [],
        nameServers: whoisData["Name Server"] || [],
        dnssec: whoisData["DNSSEC"] || null,
      };
    } catch (err) {
      console.warn("WHOIS lookup failed:", err.message);
      whoisReport = { error: "WHOIS lookup failed" };
    }

    // Shape response
    const response = formatAnalysisData(
      url,
      techReport,
      vulnReport,
      whoisReport,
    );

    return res.json({
      success: true,
      error: null,
      data: response,
    });
  } catch (err) {
    console.error("❌ Website analysis failed:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message || "Analysis failed",
      data: null,
    });
  } finally {
    try {
      await extractor.close();
    } catch {}
  }
}

function formatAnalysisData(url, tech, vulns, whois) {
  const processItems = (arr) =>
    Array.isArray(arr)
      ? arr.map((x) => ({
          name: x.name || "unknown",
          version: x.version && x.version !== "detected" ? x.version : null,
        }))
      : [];

  const processSecurityHeaders = (secArr) => {
    if (!Array.isArray(secArr))
      return { present: [], missing: [], counts: { present: 0, missing: 0 } };

    const present = secArr.filter((x) => x.version === "present");
    const missing = secArr.filter((x) => x.version === "missing");

    return {
      present: present.map((s) => ({ name: s.name, status: "present" })),
      missing: missing.map((s) => ({ name: s.name, status: "missing" })),
      counts: { present: present.length, missing: missing.length },
    };
  };

  const processPerformance = (perfArr) =>
    Array.isArray(perfArr)
      ? perfArr.map((p) => ({
          name: p.name,
          version: p.version || "detected",
          signals: p.signals || [],
        }))
      : [];

  return {
    url,
    timestamp: new Date().toISOString(),
    technology: {
      frontend: processItems(tech?.frontend),
      css: processItems(tech?.css),
      buildTools: processItems(tech?.buildTools),
      backend: processItems(tech?.backend),
      cms: processItems(tech?.cms),
      cdn: processItems(tech?.cdn),
      infrastructure: processItems(tech?.infrastructure),
      analytics: processItems(tech?.analytics),
      security: processSecurityHeaders(tech?.security),
      performance: processPerformance(tech?.performance),
    },
    vulnerabilities: {
      riskScore: vulns?.riskScore ?? 0,
      riskLevel: vulns?.riskLevel ?? "Low",
      recommendations: vulns?.recommendations || [],
      categories: vulns?.categories || {},
    },
    whois: whois || {},
  };
}

module.exports = { analyzeWebsite };
