// website-extractor.js
const puppeteer = require("puppeteer");

class WebsiteExtractor {
  constructor(options = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      ...options,
    };
    this.browser = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  async extractWebsiteData(url) {
    if (!this.browser)
      throw new Error("Browser not initialized. Call initialize() first.");

    const page = await this.browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: this.options.timeout,
    });

    // Extract HTML and metadata
    const html = await page.content();
    const title = await page.title();

    // JS files
    const jsFiles = await page.$$eval("script", (scripts) =>
      scripts.map((s) => ({
        src: s.src || null,
        content: s.src ? null : s.innerHTML,
      })),
    );

    // CSS files
    const cssFiles = {
      external: await page.$$eval('link[rel="stylesheet"]', (links) =>
        links.map((l) => ({ href: l.href || null })),
      ),
      inline: await page.$$eval("style", (styles) =>
        styles.map((s) => ({ content: s.innerHTML })),
      ),
    };

    // Cookies
    const cookies = await page.cookies();

    // Network responses (headers only)
    const responses = [];
    page.on("response", async (resp) => {
      try {
        const req = resp.request();
        responses.push({
          url: resp.url(),
          status: resp.status(),
          headers: resp.headers(),
          method: req.method(),
        });
      } catch (err) {
        // ignore malformed responses
      }
    });

    // Collect network requests
    const requests = [];
    page.on("request", (req) => {
      requests.push({
        url: req.url(),
        method: req.method(),
        type: req.resourceType(),
      });
    });

    // Wait briefly to capture late requests
    // await page.waitForTimeout(2000);
    // await new Promise((r) => setTimeout(r, 2000));

    return {
      url,
      html,
      title,
      jsFiles,
      cssFiles,
      responses,
      networkRequests: requests,
      cookies,
      links: await page.$$eval("a", (as) => as.map((a) => a.href)),
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = WebsiteExtractor;
