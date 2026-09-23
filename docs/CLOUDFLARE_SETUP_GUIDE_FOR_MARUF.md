# Complete Guide: Setting Up RANKMYSEO on Cloudflare

**Prepared for:** Maruf  
**Product:** RANKMYSEO  
**Deployment Target:** Cloudflare (Workers, D1, R2, KV, Access, Workflows)  
**Cost Model:** Free Tier / Pay-as-you-go (No expensive monthly SaaS fees)

---

## Table of Contents
1. [Overview & Core Use Cases](#1-overview--core-use-cases)
2. [Complete Features Breakdown](#2-complete-features-breakdown)
3. [Required APIs & External Services](#3-required-apis--external-services)
4. [Google Analytics 4 & Google Search Console Setup](#4-google-analytics-4--google-search-console-setup)
5. [Step-by-Step Cloudflare Deployment Guide](#5-step-by-step-cloudflare-deployment-guide)
6. [Security, Maintenance & Troubleshooting](#6-security-maintenance--troubleshooting)

---

## 1. Overview & Core Use Cases

### What is RANKMYSEO?
RANKMYSEO is a modern, open-source, pay-as-you-go alternative to enterprise SEO platforms like **Ahrefs** and **Semrush**. Instead of paying $120–$500 every single month regardless of usage, you bring your own raw API keys (DataForSEO, Google, OpenRouter) and pay only pennies for the exact queries, rank checks, and audits you execute.

### Core Use Cases
* **Agencies & Freelancers:** Track keyword rankings, monitor competitors, and run in-depth client technical audits across multiple websites without paying per-client subscription fees.
* **In-House SEO & Marketers:** Real-time keyword research, search volume metrics, CPC analysis, SERP feature discovery, and backlink auditing.
* **AI Developers & Power Users:** Integrates with AI assistants (Claude Code, Cursor, OpenClaw, Codex) via a built-in **MCP (Model Context Protocol)** server containing 50+ SEO tools.
* **Autonomous In-App AI SEO Agent ("Ranky"):** An AI agent built into the dashboard that can answer questions, analyze keyword gaps, and write SEO recommendations directly from your live data.

---

## 2. Complete Features Breakdown

| Feature Module | What It Does | Underlying Engine |
| :--- | :--- | :--- |
| **Keyword Research** | Discover seed keywords, monthly search volume, keyword difficulty, CPC, competition level, and related queries. Save keywords into organized project lists. | DataForSEO API + D1 Database |
| **Automated Rank Tracking** | Track desktop and mobile rankings in any country/city. Automatic 24/7 background checks run every 5 minutes to detect rank changes and trends. | Cloudflare Workflows + Cron Triggers |
| **Competitor Insights** | Analyze any competitor domain: estimated organic traffic, top ranking keywords, traffic distribution, and shared SERP competitors. | DataForSEO Labs API |
| **Backlink Analysis** | Deep-dive backlink profiles: total backlinks, referring domains, anchor text distribution, dofollow/nofollow ratio, and competitor backlink gap comparison. | DataForSEO Backlinks API |
| **Site Audits & Technical SEO** | Multi-page crawl engine that checks broken links, redirect chains, missing meta tags, canonical issues, duplicate content, and Google Lighthouse Core Web Vitals. | Auxiliary Worker (`rankmyseo-audit`) |
| **AI Visibility & Brand Explorer** | Search prompt explorer: analyze how brands appear across AI search engines and LLM answers. | DataForSEO + OpenRouter |
| **Ranky (In-App AI Agent)** | Interactive chat assistant on the dashboard that knows your project's rankings, audits, and competitors to suggest strategy. | Cloudflare Durable Objects (`RankyChatAgent`) |
| **MCP Server (50+ Tools)** | Connect your AI coding editor (Claude, Cursor, etc.) directly to your SEO data via the `/mcp` endpoint. | Better Auth / Cloudflare Access |

---

## 3. Required APIs & External Services

To run the application, you connect raw API services directly:

### 1. DataForSEO API (Mandatory for SEO Data)
* **What it does:** Powers all keyword metrics, SERP results, competitor traffic, backlinks, and website crawls.
* **Cost:** Pay-as-you-go (usually $0.0005 to $0.02 per request). A $10–$20 deposit lasts months for normal use.
* **How to get it:**
  1. Create an account at [dataforseo.com](https://dataforseo.com).
  2. In your dashboard, locate your **Login** (email) and **Password** (API key).
  3. Base64-encode the string `login:password`.  
     *On Mac/Linux/Git Bash:* `printf '%s' 'YOUR_LOGIN:YOUR_PASSWORD' | base64`  
     *On Windows PowerShell:* `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("YOUR_LOGIN:YOUR_PASSWORD"))`
  4. Save this base64 string for the `DATAFORSEO_API_KEY` environment variable.

### 2. OpenRouter API (Optional — for "Ranky" AI Agent)
* **What it does:** Powers the in-app AI conversational agent ("Ranky") and AI visibility prompts.
* **How to get it:**
  1. Sign up at [openrouter.ai](https://openrouter.ai).
  2. Generate an API Key under **Account Settings → Keys**.
  3. Add credits ($5 is plenty).

### 3. Google Cloud Project (Optional — for Search Console & GA4)
* **What it does:** Pulls real click, impression, and visitor analytics straight from Google for your verified websites.
* **Cost:** 100% Free.

---

## 4. Google Analytics 4 & Google Search Console Setup

Connecting Google Search Console (GSC) and Google Analytics 4 (GA4) gives you real organic performance data without burning third-party credits.

### Step 1: Create a Google Cloud Project & Enable APIs
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `rankmyseo-integration`).
3. Enable the following three APIs:
   * [Google Search Console API](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com)
   * [Google Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com)
   * [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)

### Step 2: Configure OAuth Consent Screen
1. Go to **APIs & Services → OAuth consent screen**.
2. Select User Type: **External** (or Internal if using Google Workspace).
3. Fill in:
   * **App Name:** `RANKMYSEO`
   * **User Support Email:** Your email
   * **Developer Contact Email:** Your email
4. Click **Save and Continue**.
5. Under **Test Users**, add every Google email account that owns the Search Console / GA4 properties. *(Crucial: While in testing mode, Google blocks accounts not listed under Test Users).*

### Step 3: Create OAuth Client Credentials
1. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
2. Application type: **Web application**.
3. Name: `RANKMYSEO Client`.
4. Under **Authorized redirect URIs**, add both:
   * `https://<YOUR_RANKMYSEO_DOMAIN>/api/gsc/oauth/callback`
   * `https://<YOUR_RANKMYSEO_DOMAIN>/api/ga4/oauth/callback`
   *(Replace `<YOUR_RANKMYSEO_DOMAIN>` with your Cloudflare workers.dev URL or custom domain).*
5. Click **Create** and copy your **Client ID** and **Client Secret**.

### Step 4: Generate Better Auth Encryption Secret
The app encrypts stored Google refresh tokens at rest. Generate a random 32+ character string using terminal:
```bash
openssl rand -base64 32
```
Save this as `BETTER_AUTH_SECRET`.

---

## 5. Step-by-Step Cloudflare Deployment Guide

RANKMYSEO deploys to Cloudflare using **Alchemy**, an infrastructure-as-code deployment engine built into the repository. It automatically creates your D1 database, KV namespaces, R2 storage bucket, Cloudflare Workers, and Zero Trust security application in one pass.

### Prerequisites
1. **Node.js 22.6+** installed.
2. **pnpm** installed (`corepack enable` in terminal).
3. **Cloudflare Account:**
   * **Important Note:** Activating **Cloudflare R2** requires a debit/credit card or virtual card on file for a $0 authorization check (to verify identity and prevent bot abuse). It will **not** charge you if you remain within the generous free tier.
   * Open the Cloudflare Dashboard, navigate to **R2**, and click **Enable / Get Started** once.

---

### Step 1: Clone the Codebase & Install Dependencies
Open your terminal in the project directory:
```bash
# Enable corepack for pnpm
corepack enable

# Install exact locked dependencies
pnpm install --frozen-lockfile
```

---

### Step 2: Authenticate Alchemy with Cloudflare (One-Time)
Run the Alchemy login wizard:
```bash
pnpm alchemy login
```
* **IMPORTANT:** The CLI will ask: `"Customize OAuth scopes?"` — choose **Yes**.
* Ensure the **`access:write`** scope is enabled/checked (this allows Alchemy to automatically set up the Cloudflare Access login screen for you).

Next, bootstrap Alchemy's state storage worker to your Cloudflare account:
```bash
pnpm alchemy cloudflare bootstrap
```

---

### Step 3: Configure `.env.selfhost`
Copy the template file:
```bash
cp .env.selfhost.example .env.selfhost
```

Open `.env.selfhost` and configure:
```env
# 1. MANDATORY: Your base64 DataForSEO API key
DATAFORSEO_API_KEY=your_base64_encoded_key_here

# 2. MANDATORY: Who is allowed to log in (comma-separated emails)
# Cloudflare Access will email a 6-digit PIN code to these addresses:
ACCESS_ALLOWED_EMAILS=maruf@yourcompany.com,team@yourcompany.com

# 3. OPTIONAL: Google Search Console & Google Analytics 4
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
BETTER_AUTH_SECRET=your-32-char-random-openssl-secret

# 4. OPTIONAL: Ranky AI SEO Agent
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key

# 5. Disable anonymous telemetry heartbeat (optional)
RANKMYSEO_TELEMETRY_DISABLED=1
```

---

### Step 4: Deploy Everything in One Command
Run:
```bash
pnpm deploy:selfhost --yes
```

**What happens automatically behind the scenes:**
1. Validates all environment variables and secrets.
2. Builds the frontend and backend server bundle.
3. Provisions a dedicated **Cloudflare D1 SQLite database** and executes all SQL migrations.
4. Provisions **Cloudflare KV namespaces** and the **Cloudflare R2 storage bucket**.
5. Deploys the main worker and the `rankmyseo-audit` auxiliary worker.
6. Sets up **Cloudflare Access (Zero Trust)** so your app is immediately protected by email PIN authentication.
7. Prints your live deployment URL (e.g., `https://rankmyseo-selfhost.<your-subdomain>.workers.dev`).

---

## 6. Security, Maintenance & Troubleshooting

### Security & User Access
* **Zero Trust Email Login:** Every time an authorized user visits the site, Cloudflare Access asks for their email and sends a temporary 6-digit login PIN.
* **Adding More Users:** To allow someone new to access the app, add their email to `ACCESS_ALLOWED_EMAILS` in `.env.selfhost` and re-run `pnpm deploy:selfhost --yes`.

### How to Update to Newer Code
Whenever you pull code updates or make changes:
```bash
git pull
pnpm install
pnpm deploy:selfhost --yes
```
Alchemy will detect the diff, apply any new database migrations to D1 automatically, and update the workers with zero downtime.

### Common Troubleshooting

| Issue / Error | Cause | Fix |
| :--- | :--- | :--- |
| **`redirect_uri_mismatch` (Google)** | The callback URL in Google Cloud doesn't match your live URL. | Ensure the Google Cloud Console Authorized Redirect URI has your exact live domain: `https://<your-subdomain>.workers.dev/api/gsc/oauth/callback` (no trailing slash). |
| **`access_denied` (Google)** | The account connecting Google Search Console is not authorized. | In Google Cloud Console, add the email under **OAuth consent screen → Test users**. |
| **R2 / Storage Error during deploy** | Cloudflare account doesn't have R2 activated. | Log into the Cloudflare dashboard, click on **R2** in the sidebar, and complete the activation step. |
| **Alchemy scope missing** | Alchemy login was run without `access:write`. | Run `pnpm alchemy login --configure` and enable `access:write`. |
| **DataForSEO Invalid Auth** | Key is not base64 encoded properly. | Verify the encoding: `login:password` converted to base64 with no extra spaces or newlines. |

---

### Document Summary for Maruf
* **Deployment is fully automated:** Run `pnpm alchemy login` followed by `pnpm deploy:selfhost --yes`.
* **Everything stays within free limits:** Cloudflare Workers, D1 database, and KV stay free; DataForSEO and OpenRouter only charge pennies for the queries you run.
* **Zero Trust Protection:** Only emails listed in `ACCESS_ALLOWED_EMAILS` can open the dashboard.
