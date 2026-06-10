# slowdown

A free app on FreeAppStore.

- Subdomain: `slowdown.freeappstore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `git push origin main` (auto-deploys via Cloudflare Pages)

Free, MIT-licensed, no tracking. For platform conventions, read
https://raw.githubusercontent.com/freeappstore-online/freeappstore/main/SKILLS.md
before writing or changing anything.

---

## Architecture
This is a CONNECTED app — the free and pro versions share the same Firebase backend.
- Free version: limited features (browse, basic interactions)
- Pro version: full features (create, collaborate, AI, cloud sync)
- Feature gating: Firestore security rules enforce access based on user plan (free/pro)
- Firebase config: set via VITE_FIREBASE_* env vars (or .env.production file)