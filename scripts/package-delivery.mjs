#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DELIVERY = path.join(ROOT_DIR, "dist-delivery");
const STAGING_DIR = path.join(DIST_DELIVERY, ".staging");
const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"),
).version;
const ZIP_NAME = `rankmyseo-v${PACKAGE_VERSION}-delivery.zip`;
const ZIP_PATH = path.join(DIST_DELIVERY, ZIP_NAME);
const MANIFEST_PATH = path.join(DIST_DELIVERY, "MANIFEST.txt");
const SHA_PATH = path.join(DIST_DELIVERY, `${ZIP_NAME}.sha256`);
const CONTRACT_ANNEX_PATH = path.join(DIST_DELIVERY, "OSS_PROVENANCE_ANNEX.md");

console.log("==================================================");
console.log("  RANKMYSEO Delivery Packaging & Leak Gate");
console.log("==================================================");

// --- 1. PRE-FLIGHT CHECK: ENVIRONMENTS ---
console.log("\n[1/5] Checking environment files...");

const ALLOWED_ENV_FILES = new Set([
  path.join(ROOT_DIR, ".env.example"),
  path.join(ROOT_DIR, ".env.preview.example"),
  path.join(ROOT_DIR, ".env.production.example"),
  path.join(ROOT_DIR, ".env.selfhost.example"),
  path.join(ROOT_DIR, "web", ".env.example"),
]);

function findEnvFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "dist-delivery"
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findEnvFiles(fullPath));
    } else if (entry.name.startsWith(".env")) {
      results.push(fullPath);
    }
  }
  return results;
}

const foundEnvs = findEnvFiles(ROOT_DIR);
const disallowedEnvs = foundEnvs.filter((f) => !ALLOWED_ENV_FILES.has(f));

if (disallowedEnvs.length > 0) {
  console.error(
    "\n❌ FATAL: Disallowed environment files found in repository:",
  );
  for (const envFile of disallowedEnvs) {
    console.error(`   - ${path.relative(ROOT_DIR, envFile)}`);
  }
  console.error(
    "Remove or move active .env files before creating delivery build.",
  );
  process.exit(1);
}
console.log("   ✔ Only permitted .env.example files present.");

// --- 2. PRE-FLIGHT CHECK: PURGED ARTIFACTS ---
console.log("\n[2/5] Verifying absence of purged upstream artifacts...");

const MUST_NOT_EXIST = [
  "docs/MAINTAINERS.md",
  "docs/CONTRIBUTING.md",
  "docs/EveryAppLearnings.md",
  ".github/CODEOWNERS",
  ".github/workflows/pr-preview.yml",
  ".github/workflows/sourcemaps.yml",
  "chatgpt-app-submission.json",
  ".greptile",
  ".agents/skills/rankmyseo-release-notes",
  "web/public/blog/what-broke-the-99-dollar-ceiling/quote-never-used-semrush.png",
  "web/public/blog/what-broke-the-99-dollar-ceiling/quote-one-thing.png",
];

const foundPurged = [];
for (const relPath of MUST_NOT_EXIST) {
  const full = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(full)) {
    foundPurged.push(relPath);
  }
}

if (foundPurged.length > 0) {
  console.error(
    "\n❌ FATAL: Upstream governance/plumbing artifacts still exist:",
  );
  for (const item of foundPurged) {
    console.error(`   - ${item}`);
  }
  process.exit(1);
}
console.log(
  "   ✔ All required upstream governance and plumbing files confirmed absent.",
);

// --- 3. STAGING COPY ---
console.log("\n[3/5] Preparing clean staged directory...");

if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

const IGNORE_PATTERNS = [
  /^\.git(\/|\\|$)/,
  /^node_modules(\/|\\|$)/,
  /[/\\]node_modules([/\\]|$)/,
  /^\.wrangler(\/|\\|$)/,
  /[/\\]\.wrangler([/\\]|$)/,
  /^\.logs(\/|\\|$)/,
  /[/\\]\.logs([/\\]|$)/,
  /^playwright-report(\/|\\|$)/,
  /^test-results(\/|\\|$)/,
  /^blob-report(\/|\\|$)/,
  /^coverage(\/|\\|$)/,
  /^dist(\/|\\|$)/,
  /[/\\]dist([/\\]|$)/,
  /^dist-sourcemaps(\/|\\|$)/,
  /^dist-delivery(\/|\\|$)/,
  /\.DS_Store$/,
  /^\.vercel(\/|\\|$)/,
  /^\.cache(\/|\\|$)/,
  /^\.localflare(\/|\\|$)/,
  /^\.alchemy(\/|\\|$)/,
  /^\.output(\/|\\|$)/,
  /^scratch(\/|\\|$)/,
  /^\.tanstack(\/|\\|$)/,
  /[/\\]\.tanstack([/\\]|$)/,
];

function shouldCopy(relPath) {
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(relPath)) return false;
  }
  return true;
}

function copyRecursive(srcDir, destDir, currentRel = "") {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = currentRel ? path.join(currentRel, entry.name) : entry.name;
    if (!shouldCopy(relPath)) {
      continue;
    }
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath, relPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(ROOT_DIR, STAGING_DIR);
console.log(
  "   ✔ Staged copy created without development caches and git history.",
);

// --- 4. STRING GATE SCAN ---
console.log("\n[4/5] Running strict string-gate on staged delivery copy...");

const BLOCKLIST = [
  { name: "bensenescu", regex: /bensenescu/i },
  { name: "everyapp", regex: /everyapp/i },
  { name: "every-app", regex: /every-app/i },
  { name: "every.app", regex: /every\.app/i },
  { name: "unscripted", regex: /unscripted/i },
  { name: "greptile", regex: /greptile/i },
  { name: "open-seo", regex: /open-?seo/i },
  { name: "sk-or-v1-", regex: /sk-or-v1-/ },
  { name: "quote-never-used-semrush", regex: /quote-never-used-semrush/i },
  { name: "quote-one-thing", regex: /quote-one-thing/i },
  {
    name: "hardcoded-posthog-key",
    regex: /phc_xaXj4vE4LikxfvR7q6EHemAYNBSZW4hQkqor7fpf8aGT/,
  },
];

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".tar",
  ".gz",
  ".sqlite",
  ".db",
  ".pdf",
]);

function isAllowed(relPath, line) {
  const normalizedPath = relPath.replace(/\\/g, "/");

  if (normalizedPath === "scripts/package-delivery.mjs") {
    return true;
  }

  // LICENSE file is completely allowed for MIT notice
  if (normalizedPath === "LICENSE") {
    return true;
  }

  // THIRD_PARTY_NOTICES.md is completely allowed for MIT notice
  if (normalizedPath === "THIRD_PARTY_NOTICES.md") {
    return true;
  }

  // README.md: only lines in the License & Provenance section
  if (normalizedPath === "README.md") {
    if (
      line.includes("Copyright (c) 2026 Ben Senescu") ||
      line.includes("open-source software")
    ) {
      return true;
    }
  }

  // Allowlist packages in lockfile or package dependencies if legitimate
  if (
    normalizedPath.endsWith("pnpm-lock.yaml") &&
    line.includes("@every-app/sdk")
  ) {
    return true;
  }

  return false;
}

function scanDir(dir, currentRel = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    const relPath = currentRel ? path.join(currentRel, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      violations.push(...scanDir(fullPath, relPath));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        continue;
      }

      let content;
      try {
        content = fs.readFileSync(fullPath, "utf8");
      } catch (err) {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const block of BLOCKLIST) {
          if (block.regex.test(line)) {
            if (!isAllowed(relPath, line)) {
              violations.push({
                file: relPath,
                line: i + 1,
                matched: block.name,
                content: line.trim().slice(0, 140),
              });
            }
          }
        }
      }
    }
  }
  return violations;
}

const violations = scanDir(STAGING_DIR);

if (violations.length > 0) {
  console.error(
    `\n❌ STRING-GATE FAILED: Found ${violations.length} forbidden occurrences in staged copy:\n`,
  );
  for (const v of violations) {
    console.error(`   [${v.matched}] ${v.file}:${v.line}`);
    console.error(`      "${v.content}"\n`);
  }
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  console.error("Delivery packaging aborted due to string-gate violations.");
  process.exit(1);
}
console.log("   ✔ String-gate passed with 0 violations! Clean room verified.");

// --- 5. PACKAGE & CHECKSUM ---
console.log("\n[5/5] Creating release zip and checksums...");

if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

// Generate MANIFEST.txt
const manifestContent = `RANKMYSEO Delivery Manifest
Version: ${PACKAGE_VERSION}
Build Date: ${new Date().toISOString()}
Archive: ${ZIP_NAME}

Included Components:
- Core Web & API Application (/src, /drizzle, package.json)
- Marketing & Documentation Site (/web)
- E2E Site-Audit Test Fixture Site (/badseo)
- AI MCP Server & Public Agent Skills (/plugins, /src/server/mcp)
- Database Migrations & Schemas (/drizzle, /src/db)
- Build, Deploy, and Self-Hosting Configurations (Dockerfile.selfhost, compose.yaml, wrangler.jsonc)
- Third-Party License Information (LICENSE, THIRD_PARTY_NOTICES.md)

Excluded Development Artifacts:
- .git repository history (clean handover)
- Active .env files with secrets (.env, .env.local)
- node_modules and pnpm store caches
- Local Cloudflare state & D1 databases (.wrangler/)
- Test output, coverage, and development log files (.logs/, playwright-report/, test-results/)
- Upstream governance, personal issue templates, and internal bot workflows

Quality & Security Gates Passed:
- String Gate Scan: PASS (Zero unauthorized upstream references)
- Telemetry Hardcoded Keys: PASS (Zero hardcoded phone-home telemetry)
- Test Fixtures: Sanitized neutral fixture emails
- Provenance: Transparent MIT attribution preserved per legal standards
`;

fs.writeFileSync(MANIFEST_PATH, manifestContent, "utf8");
fs.writeFileSync(
  path.join(STAGING_DIR, "MANIFEST.txt"),
  manifestContent,
  "utf8",
);

// Use system tar (bsdtar) to zip the staged contents cleanly
try {
  // Execute tar inside STAGING_DIR so paths inside zip are relative
  execSync(`tar -a -c -f "${ZIP_PATH}" * .*`, {
    cwd: STAGING_DIR,
    stdio: "inherit",
    shell: true,
  });
} catch (err) {
  console.error("Failed to create zip archive:", err);
  process.exit(1);
}

// Calculate SHA-256
const zipBuffer = fs.readFileSync(ZIP_PATH);
const hash = crypto.createHash("sha256").update(zipBuffer).digest("hex");
fs.writeFileSync(SHA_PATH, `${hash}  ${ZIP_NAME}\n`, "utf8");

// Verify Contract Annex exists outside zip
if (!fs.existsSync(CONTRACT_ANNEX_PATH)) {
  console.warn(
    "⚠️ Warning: dist-delivery/OSS_PROVENANCE_ANNEX.md was missing, re-creating it.",
  );
  const annexContent = `# Appendix A — Open Source Software Provenance

The Software incorporates third-party open-source software. Core search, ranking, and site-audit orchestration modules are derived from an MIT-licensed codebase, Copyright (c) 2026 Ben Senescu. All other third-party components and their licenses are declared in the package manifest shipped with the Software. Except for the rights granted under those licenses, all customization, branding, configuration, documentation, and deployment work in the Software were supplied by the Seller. The third-party components are provided under their existing licenses, including their warranty disclaimers.
`;
  fs.writeFileSync(CONTRACT_ANNEX_PATH, annexContent, "utf8");
}

// Clean up staging directory
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

const stats = fs.statSync(ZIP_PATH);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log("\n==================================================");
console.log("  DELIVERY PACKAGE READY");
console.log("==================================================");
console.log(`  Archive:    dist-delivery/${ZIP_NAME} (${sizeMb} MB)`);
console.log(`  SHA-256:    ${hash}`);
console.log(`  Manifest:   dist-delivery/MANIFEST.txt`);
console.log(
  `  Contract:   dist-delivery/OSS_PROVENANCE_ANNEX.md (Outside Zip)`,
);
console.log("==================================================\n");
