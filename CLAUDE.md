# slowdown

A simple emotional reset app that recommends one short practice from a mood, energy, mental speed, and tension check-in.

- Subdomain: `slowdown.freeappstore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `git push origin main` (auto-deploys via Cloudflare Pages)

Free, MIT-licensed, no tracking. For platform conventions, read
https://raw.githubusercontent.com/freeappstore-online/freeappstore/main/SKILLS.md
before writing or changing anything.

---

## Architecture

This is a connected local-first app. It works without backend configuration using browser storage, and can sync saved resets through Firebase when `VITE_FIREBASE_*` values are configured.

## Product notes

- Local-first mood check-ins with optional Firebase sync when auth is configured.
- Browser-side background agents score safety, recent patterns, and the best short practice.
- This is a wellbeing tool only; avoid diagnostic, treatment, or crisis-service claims.
