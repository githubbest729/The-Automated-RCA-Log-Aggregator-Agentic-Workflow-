# 1. Initialization & GitHub Commands

Run these in order from the parent directory where you want the project to live.

```bash
# --- Create the Next.js app with Bun ---
bun create next-app rca-log-aggregator --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
cd rca-log-aggregator

# --- Install project-specific dependencies ---
bun add jszip @anthropic-ai/sdk date-fns date-fns-tz lucide-react clsx
bun add -d @types/node

# --- Initialize git ---
git init
git branch -M main

# --- Create the GitHub repo (requires GitHub CLI: https://cli.github.com) ---
gh auth login   # skip if already authenticated
gh repo create rca-log-aggregator --private --source=. --remote=origin

# --- Stage, commit, push ---
git add .
git commit -m "chore: initial scaffold for Automated RCA Log Aggregator"
git push -u origin main
```

## Render deployment secret

In your GitHub repo settings → Secrets and variables → Actions, add:

- `RENDER_DEPLOY_HOOK` — the deploy hook URL from your Render service (Settings → Deploy Hook).
- `ANTHROPIC_API_KEY` — set this directly in Render's environment variables (not GitHub), since it's only needed at runtime, not build time.

## Local development

```bash
cp .env.example .env.local     # then fill in ANTHROPIC_API_KEY
bun run dev
```
