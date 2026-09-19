# RANKMYSEO

> Open source, pay-as-you-go alternative to Semrush and Ahrefs — for you and your AI agent.

RANKMYSEO is an SEO toolkit for _the people_. Keyword research, rank tracking,
competitor insights, backlinks, site audits, and AI visibility — without the
enterprise bloat. Bring your own DataForSEO key, pay only for what you use, and
drive it all from a modern UI or straight from your AI agent via MCP + skills.

- Website: [https://rankmyseo.com](https://rankmyseo.com)
- Support: Configured via `VITE_SUPPORT_EMAIL` (see [Environment variables](#environment-variables))

## Features

- **Keyword research** — seed topics, SERP data, keyword metrics, saved lists
- **Rank tracking** — scheduled rank checks with history and reports
- **Competitor insights** — domain overview, SERP competitors, traffic estimates
- **Backlinks** — overview, profiles, gap analysis
- **Site audits** — crawl, issues, pages, Lighthouse performance
- **AI visibility** — brand lookup, prompt explorer, AI search prompts
- **Ranky** — in-app AI SEO agent (needs an OpenRouter key)
- **MCP server + agent skills** — use your SEO data from Claude Code, Cursor,
  Codex, OpenClaw, or any MCP client (`/mcp`, 50+ tools)

## Prerequisites

- Node.js 20+
- [Corepack](https://nodejs.org/api/corepack.html) (bundled through Node.js 24)
- A [DataForSEO](https://dataforseo.com) account (you pay them
  directly — see [`docs/DATAFORSEO_API_KEY.md`](./docs/DATAFORSEO_API_KEY.md))
- Optional: an [OpenRouter](https://openrouter.ai/settings/keys) key to enable
  Ranky, the in-app AI agent

## Quick start (local, `local_noauth`)

```sh
corepack enable
pnpm install --frozen-lockfile

# Run once per fresh local DB
pnpm run db:migrate:local

cp .env.example .env.local
```

Edit `.env.local`:

```sh
# Base64-encoded `login:password` from DataForSEO
# printf '%s' 'YOUR_LOGIN:YOUR_PASSWORD' | base64
DATAFORSEO_API_KEY=...

# Local mode: no login screen, everything unlocked, no billing
AUTH_MODE=local_noauth

# Optional: enables Ranky (the in-app AI agent)
OPENROUTER_API_KEY=...
```

Then run:

```sh
pnpm run dev
```

Or, with agent-friendly logs via [portless](https://github.com/vercel-labs/portless)
(`http://rankmyseo.localhost:1355` by default):

```sh
pnpm dev:agents
```

Full guide: [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md).

The marketing site (`web/`) and the audit test site (`badseo/`) are separate pnpm
projects — see [Local Development](./docs/LOCAL_DEVELOPMENT.md#website-and-badseo).

## Environment variables

| Variable                                               | Required            | What for                                                          |
| ------------------------------------------------------ | ------------------- | ----------------------------------------------------------------- |
| `DATAFORSEO_API_KEY`                                   | Yes (SEO data)      | Base64 `login:password` for DataForSEO                            |
| `AUTH_MODE`                                            | Yes                 | `local_noauth` (local), `cloudflare_access` (self-host), `hosted` |
| `OPENROUTER_API_KEY`                                   | For Ranky           | AI agent + AI features                                            |
| `OPENROUTER_MODEL`                                     | No                  | Override the default chat model                                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`            | For GSC/GA4         | Search Console + Analytics OAuth                                  |
| `BETTER_AUTH_SECRET` (+ `BETTER_AUTH_URL`)             | Hosted / GSC        | Sessions + OAuth token encryption                                 |
| `TEAM_DOMAIN` / `POLICY_AUD`                           | `cloudflare_access` | Cloudflare Access JWT validation                                  |
| `RANKMYSEO_IMAGE`                                      | Docker              | Image tag override for self-hosting                               |
| `RANKMYSEO_TELEMETRY_DISABLED=1` (or `DO_NOT_TRACK=1`) | No                  | Disable the anonymous self-host heartbeat                         |
| `POSTHOG_PUBLIC_KEY` / `POSTHOG_HOST`                  | Hosted              | Product analytics                                                 |
| `LOOPS_API_KEY` + `LOOPS_TRANSACTIONAL_*`              | Hosted              | Transactional email                                               |

See [`.env.example`](./.env.example), [`.env.selfhost.example`](./.env.selfhost.example),
and [`.env.production.example`](./.env.production.example).

## Scripts

| Command                                           | What it does                                               |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm run dev` / `pnpm dev:agents`                | Local dev server                                           |
| `pnpm run build`                                  | Production build + typecheck                               |
| `pnpm run types:check`                            | `tsc --noEmit`                                             |
| `pnpm run lint` / `pnpm run lint:fix`             | oxlint (type-aware)                                        |
| `pnpm run format:check` / `pnpm run format:write` | prettier                                                   |
| `pnpm test` / `pnpm test:ci`                      | vitest unit tests                                          |
| `pnpm test:e2e`                                   | Playwright e2e (needs `AUTH_MODE=local_noauth`)            |
| `pnpm run db:migrate:local`                       | Apply D1 migrations locally                                |
| `pnpm sync-plugin-skills`                         | Re-sync `plugins/rankmyseo/skills/` from `.agents/skills/` |
| `pnpm ci:check`                                   | format + knip + typecheck + lint + skills sync check       |

## Self-hosting

- **Docker** (simplest, personal use): [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md)
- **Cloudflare** (recommended, multi-device/team): [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md)
- Google Search Console: [`docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md`](./docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md)

DataForSEO stays bring-your-own-key in every mode — RANKMYSEO never resells or
proxies it beyond your own usage.

## MCP & agent skills

- [Set up the RANKMYSEO MCP server](https://rankmyseo.com/docs/mcp)
- [Set up agent skills](https://rankmyseo.com/docs/skills/setup)
- Local MCP check: `.agents/skills/verify-local-mcp/SKILL.md`

## License & Provenance

RANKMYSEO is distributed under the MIT License (see `LICENSE`). Portions of the core search, ranking, and site-audit engine are MIT-licensed open-source software (Copyright (c) 2026 Ben Senescu); the original copyright and license notice are preserved in the `LICENSE` file. All other third-party packages are declared in `package.json` / `pnpm-lock.yaml`.
