---
title: "Install the RANKMYSEO plugin for Claude Code"
description: "Add RANKMYSEO MCP and Agent Skills to Claude Code with one marketplace and one install command."
---

The RANKMYSEO plugin bundles RANKMYSEO MCP and all ten SEO Agent Skills into one install. This is the preferred way to set up RANKMYSEO in Claude Code.

## Install

Run these two commands in Claude Code:

```bash
/plugin marketplace add rankmyseo/rankmyseo
/plugin install rankmyseo@rankmyseo
```

If the install summary says `Run /reload-plugins to activate.`, run that command.

Claude Code connects RANKMYSEO MCP at `https://app.rankmyseo.com/mcp` and enables ten skills:

- SEO Project Setup
- SEO Coach
- SEO Audit
- Keyword Research
- Keyword Clustering
- Competitive Landscape
- Competitor Analysis
- Local SEO
- Link Prospecting
- SEO Report

## Finish the login

Claude Code should prompt you to log in to RANKMYSEO right after install. If it doesn't, run `/mcp` and approve the RANKMYSEO connection from there.

## Run a skill

Plugin skills are namespaced by the plugin name:

```
/rankmyseo:seo-project-setup
/rankmyseo:seo-coach
/rankmyseo:seo-audit
/rankmyseo:keyword-research
/rankmyseo:keyword-clustering
/rankmyseo:competitive-landscape
/rankmyseo:competitor-analysis
/rankmyseo:local-seo
/rankmyseo:link-prospecting
```

## Claude Desktop

Claude Desktop doesn't support this plugin format — plugins are a Claude Code feature. For Claude Desktop, [add RANKMYSEO as an MCP connector](/docs/mcp#claude-desktop) instead.

## Update

Run inside Claude Code:

```text
/plugin marketplace update rankmyseo
/plugin update rankmyseo@rankmyseo
/reload-plugins
```

Updates land in the cache immediately, but the running session keeps the old version until you run `/reload-plugins` or restart Claude Code.

For other installation methods, see [Agent setup and skill updates](/docs/agent-setup#update-your-skills).

## Remove

```text
/plugin uninstall rankmyseo@rankmyseo
```

## Troubleshooting

To check what's actually installed, run `/plugin list` rather than bare `/plugin` — `/plugin` alone opens an interactive panel that doesn't show plain text.

If `/reload-plugins` reports `0 skills`, that's normal, not a failure — its summary only counts a plugin's `commands/` directory, not `skills/`. Confirm the skills loaded by running one directly, for example `/rankmyseo:seo-audit`.

If `/plugin uninstall rankmyseo@rankmyseo` reports "not installed in this project," you likely installed to a different scope than the one being checked (User, Project, or Local). Run `/plugin list` to see the actual scope, or sidestep the picker entirely with the shell form: `claude plugin uninstall rankmyseo@rankmyseo --scope user`.

If plugin skills don't appear, clear the plugin cache with `rm -rf ~/.claude/plugins/cache` — this clears every installed plugin's cache, not just RANKMYSEO's, so reinstall anything else you have after — then restart Claude Code and reinstall the plugin.

If the RANKMYSEO connection doesn't show as authenticated, run `/mcp`, select RANKMYSEO, and complete the login.

## Other clients

This plugin is for Claude Code. For Codex CLI, use the [RANKMYSEO plugin for Codex](/docs/codex-plugin) instead. For Cursor, Codex Desktop, Claude Desktop, or an API key setup, see [Set up RANKMYSEO MCP](/docs/mcp) and [Set up RANKMYSEO Agent Skills](/docs/skills/setup).
