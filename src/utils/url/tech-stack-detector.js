// tech-stack-detector.js
// Detector that infers the tech stack from extracted data (no security checks).

class TechnologyStackDetector {
  constructor(extractedData, options = {}) {
    this.data = extractedData || {};
    this.html = this.data.html || "";
    this.title = this.data.title || "";
    this.jsFiles = this.data.jsFiles || [];
    this.cssFiles = this.data.cssFiles || { external: [], inline: [] };
    this.responses = this.data.responses || [];
    this.requests = this.data.networkRequests || [];
    this.options = { silent: false, ...options };
  }

  detectAll() {
    const result = {
      url: this.data.url || null,
      frontend: this.detectFrontendFrameworks(),
      css: this.detectCSSFrameworks(),
      buildTools: this.detectBuildTools(),
      backend: this.detectBackendAndServer(),
      cms: this.detectCMS(),
      cdn: this.detectCDN(),
      infrastructure: this.detectInfrastructure(),
      analytics: this.detectAnalytics(),
      misc: this.detectMisc(),
    };

    if (!this.options.silent) this._printUsedTechnologies(result);
    return result;
  }

  _printUsedTechnologies(result) {
    const categories = [
      "frontend",
      "css",
      "buildTools",
      "backend",
      "cms",
      "cdn",
      "infrastructure",
      "analytics",
      "misc",
    ];

    const header = (txt) => console.log(`\n${txt}\n${"=".repeat(txt.length)}`);
    header(`Tech used for ${result.url || "page"}`);

    for (const cat of categories) {
      const items = Array.isArray(result[cat]) ? result[cat] : [];
      if (items.length === 0) continue;

      console.log(`\n${cat.toUpperCase()}:`);
      for (const item of items) {
        const version =
          item.version && item.version !== "detected" ? ` ${item.version}` : "";
        console.log(`  • ${item.name}${version}`);
      }
    }
    console.log("");
  }

  // ---------- Frontend frameworks ----------
  detectFrontendFrameworks() {
    const hits = [];
    if (this.html.includes("data-reactroot"))
      hits.push(
        this._item("React", this._versionFromJS(/react[-.](\d+\.\d+\.\d+)/i)),
      );
    if (/\bdata-v-[a-f0-9]{5,}\b/i.test(this.html))
      hits.push(
        this._item("Vue.js", this._versionFromJS(/vue[-.](\d+\.\d+\.\d+)/i)),
      );
    if (/\bng-version="([\d.]+)"/i.test(this.html))
      hits.push(
        this._item("Angular", this.html.match(/\bng-version="([\d.]+)"/i)?.[1]),
      );
    if (/\bdata-svelte-h\b/.test(this.html)) hits.push(this._item("Svelte"));
    if (/\bjQuery\b|\$\(/.test(this.html))
      hits.push(
        this._item("jQuery", this._versionFromJS(/jquery[-.](\d+\.\d+\.\d+)/i)),
      );
    if (/next\/static|__NEXT_DATA__/i.test(this.html))
      hits.push(this._item("Next.js"));
    if (/nuxt\.config|__NUXT__/i.test(this.html))
      hits.push(this._item("Nuxt.js"));
    return hits;
  }

  // ---------- CSS frameworks ----------
  detectCSSFrameworks() {
    const hits = [];
    if (/\bcontainer\b/.test(this.html) && /\brow\b/.test(this.html))
      hits.push(
        this._item(
          "Bootstrap",
          this._versionFromCSS(/bootstrap[/.-]v?(\d+\.\d+\.\d+)/i) ||
            this._bootstrapMajorHint(),
        ),
      );
    if (/\b(bg-|text-|p-|m-|w-|h-|flex|grid)/.test(this.html))
      hits.push(this._item("Tailwind CSS"));
    return hits;
  }

  // ---------- Build tools ----------
  detectBuildTools() {
    const hits = [];
    if (this.findInJS(/__webpack_require__|webpackJsonp|webpackChunk/).length)
      hits.push(this._item("Webpack"));
    if (this.findInJS(/__vite_|import\.meta\.env/).length)
      hits.push(this._item("Vite"));
    if (this.findInJS(/parcelRequire|parcelHotUpdate/).length)
      hits.push(this._item("Parcel"));
    if (this.findInJS(/createCommonjsModule|_commonjsHelpers/).length)
      hits.push(this._item("Rollup"));
    return hits;
  }

  // ---------- Backend & server ----------
  detectBackendAndServer() {
    const hits = [];
    const headers = this._mainHeadersLower();
    const server = headers["server"] || "";
    if (/apache/i.test(server)) hits.push(this._item("Apache"));
    if (/nginx/i.test(server)) hits.push(this._item("Nginx"));
    if (/microsoft-iis/i.test(server)) hits.push(this._item("IIS"));
    if (/cloudflare/i.test(server)) hits.push(this._item("Cloudflare (edge)"));

    const powered = headers["x-powered-by"] || "";
    if (/php/i.test(powered)) hits.push(this._item("PHP"));
    if (/express/i.test(powered)) hits.push(this._item("Node.js (Express)"));
    if (headers["x-django-version"]) hits.push(this._item("Python (Django)"));
    if (headers["x-rails"]) hits.push(this._item("Ruby on Rails"));
    if (/laravel/i.test(powered)) hits.push(this._item("Laravel"));
    return hits;
  }

  // ---------- CMS / E-commerce ----------
  detectCMS() {
    const hits = [];
    if (/\/wp-content\/|\/wp-includes\/|\/wp-json\//i.test(this.html))
      hits.push(this._item("WordPress"));
    if (/Drupal\.settings/i.test(this.html)) hits.push(this._item("Drupal"));
    if (/\/components\/|\/modules\/|\/templates\/|joomla/i.test(this.html))
      hits.push(this._item("Joomla"));
    if (/\/js\/mage\/|Mage\.Cookies/i.test(this.html))
      hits.push(this._item("Magento"));
    if (/cdn\.shopify\.com/i.test(this.html)) hits.push(this._item("Shopify"));
    return hits;
  }

  // ---------- CDN ----------
  detectCDN() {
    const hits = [];
    const hstr = this._headersString();
    if (/cloudflare/i.test(hstr)) hits.push(this._item("Cloudflare"));
    if (/cloudfront/i.test(hstr)) hits.push(this._item("AWS CloudFront"));
    if (/fastly/i.test(hstr)) hits.push(this._item("Fastly"));
    if (/akamai/i.test(hstr)) hits.push(this._item("Akamai"));
    return hits;
  }

  // ---------- Cloud/infra ----------
  detectInfrastructure() {
    const hits = [];
    const urls =
      (this.requests || []).map((r) => r.url).join(" ") + " " + this.html;
    if (/amazonaws\.com|cloudfront\.net/i.test(urls))
      hits.push(this._item("AWS"));
    if (/googleapis\.com|gstatic\.com/i.test(urls))
      hits.push(this._item("Google Cloud"));
    if (/azureedge\.net|windows\.net/i.test(urls))
      hits.push(this._item("Azure"));
    if (/digitaloceanspaces\.com/i.test(urls))
      hits.push(this._item("DigitalOcean"));
    if (/\.netlify\.app/i.test(urls)) hits.push(this._item("Netlify"));
    if (/\.vercel\.app/i.test(urls)) hits.push(this._item("Vercel"));
    return hits;
  }

  // ---------- Analytics ----------
  detectAnalytics() {
    const hits = [];
    if (/google-analytics\.com|googletagmanager\.com/i.test(this.html))
      hits.push(this._item("Google Analytics"));
    if (/facebook\.net\/en_US\/fbevents\.js/i.test(this.html))
      hits.push(this._item("Facebook Pixel"));
    if (/hotjar\.com/i.test(this.html)) hits.push(this._item("Hotjar"));
    if (/mixpanel\.com/i.test(this.html)) hits.push(this._item("Mixpanel"));
    if (/amplitude\.com/i.test(this.html)) hits.push(this._item("Amplitude"));
    if (/cdn\.segment\.com/i.test(this.html)) hits.push(this._item("Segment"));
    return hits;
  }

  // ---------- Misc ----------
  detectMisc() {
    const hits = [];
    if (/stripe\.com/i.test(this.html)) hits.push(this._item("Stripe"));
    if (/paypal\.com/i.test(this.html)) hits.push(this._item("PayPal"));
    if (/intercom\.io/i.test(this.html)) hits.push(this._item("Intercom"));
    return hits;
  }

  // ---------- Helpers ----------
  _item(name, version = "detected") {
    return { name, version };
  }
  _mainHeadersLower() {
    if (!Array.isArray(this.responses)) return {};
    const main =
      this.responses.find((r) => r.url === this.data.url) || this.responses;
    const out = {};
    if (main && main.headers) {
      for (const [k, v] of Object.entries(main.headers))
        out[k.toLowerCase()] = v;
    }
    return out;
  }
  _headersString() {
    return Object.entries(this._mainHeadersLower())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  }
  findInJS(regex) {
    return this.jsFiles.filter((f) =>
      regex.test(f.content || f.inline || f.src || ""),
    );
  }
  _versionFromJS(regex) {
    for (const f of this.jsFiles) {
      const m = (f.content || f.inline || f.src || "").match(regex);
      if (m) return m[1];
    }
    return null;
  }
  _versionFromCSS(regex) {
    for (const f of [
      ...(this.cssFiles.external || []),
      ...(this.cssFiles.inline || []),
    ]) {
      const m = (f.content || f.href || "").match(regex);
      if (m) return m[1];
    }
    return null;
  }
  _bootstrapMajorHint() {
    if (/\boffcanvas\b/.test(this.html)) return "5.x";
    if (/\bcard\b|\bbadge\b/.test(this.html)) return "4.x";
    return "detected";
  }
}

module.exports = TechnologyStackDetector;
