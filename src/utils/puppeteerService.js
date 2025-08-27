// check-domain.js
const puppeteer = require("puppeteer");

/**
 * Checks if a domain or URL exists by trying both https and http protocols if not specified.
 * @param {string} domainOrUrl The domain (e.g., "dhaal.io") or full URL (e.g., "https://dhaal.io") to check.
 * @returns {Promise<{
 *   exists: boolean,
 *   finalUrl: string|null,
 *   status: number|null,
 *   message: string
 * }>}
 */
async function checkWebsiteExists(domainOrUrl) {
  let urlsToTest = [];

  // 1. Determine which URLs to test based on the input
  if (domainOrUrl.startsWith("http://") || domainOrUrl.startsWith("https://")) {
    urlsToTest.push(domainOrUrl);
  } else {
    // If no protocol, prioritize https, then fall back to http
    urlsToTest.push(`https://${domainOrUrl}`);
    urlsToTest.push(`http://${domainOrUrl}`);
    console.log(
      `\n--- Input "${domainOrUrl}" has no protocol. Testing [https, http] ---`,
    );
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(20000); // 20-second timeout

    // 2. Loop through the potential URLs and stop on the first success
    for (const url of urlsToTest) {
      console.log(`Attempting to connect to: ${url}`);
      try {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
        });

        const result = {
          exists: true,
          finalUrl: response.url(), // This shows the URL after any redirects
          status: response.status(),
          message: `Success! Responded from ${url} with status ${response.status()}. Final URL: ${response.url()}`,
        };

        console.log(result.message);
        return result; // Found a working version, exit successfully
      } catch (error) {
        // This catch block handles an error for a SINGLE attempt (e.g., https failed)
        // We only log it and let the loop continue to the next URL (e.g., http)
        console.warn(`Could not connect to ${url}. Error: ${error.name}.`);
      }
    }

    // 3. If the loop completes without returning, no URL worked
    const failureResult = {
      exists: false,
      finalUrl: null,
      status: null,
      message: `Failed to connect to "${domainOrUrl}" on any known protocol. The domain may not exist or is offline.`,
    };
    console.error(failureResult.message);
    return failureResult;
  } catch (outerError) {
    // This outer catch handles unexpected errors with Puppeteer itself
    const fatalErrorResult = {
      exists: false,
      finalUrl: null,
      status: null,
      message: `A fatal error occurred: ${outerError.message}`,
    };
    console.error(fatalErrorResult.message);
    return fatalErrorResult;
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed.");
    }
  }
}

module.exports = {
  checkWebsiteExists,
};
