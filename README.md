# Cosmetic Store Management System (CSMS_App)

iPhone-first SaaS for Cambodian cosmetic shops: storefront + admin + barcode inventory + KHQR checkout.

## Stack
- Next.js 16 (App Router, Turbopack)
- React 19.2, TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth, Storage, Realtime) via `@supabase/ssr`
- TanStack Query, Zustand, React Hook Form + Zod
- Framer Motion, lucide-react, sonner
- PWA (manifest + iOS web-app meta)

## Getting started

```bash
cp .env.example .env.local   # fill with your Supabase project credentials
npm run dev
```

Visit `http://localhost:3000` (storefront), `/admin` (dashboard, gated once auth wires up), `/login`.

## Scripts
- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run built app
- `npm run lint` — ESLint flat config
- `npm run typecheck` — `tsc --noEmit`
- `npm run format` — Prettier with Tailwind class sorter

## Project layout

```
src/
  app/
    (shop)/          → public storefront (mobile-first)
    (admin)/admin/   → protected admin dashboard
    (auth)/          → login / register / reset
    api/             → route handlers
  components/
    ui/              → shadcn primitives
    shop/ admin/ inventory/ shared/
  lib/
    supabase/        → browser + server + proxy session clients
    constants.ts utils.ts
  services/          → domain services (server-only)
  hooks/ store/ types/ utils/
  proxy.ts           → Next 16 proxy (replaces middleware) — Supabase session + route gates
database/
  migrations/  policies/   → Phase 2 SQL artifacts
```

## Build phases
This project follows the phase-by-phase plan in `CLAUDE.md`. **Phase 1 (Project Foundation) is complete.** Next: Phase 2 — Database Architecture.

## Notes
- Tailwind v4: theme tokens live in `src/app/globals.css` under `@theme`. No `tailwind.config.js`.
- Next 16 renamed `middleware.ts` → `proxy.ts`. Node-only runtime.
- `cookies()`, `headers()`, `params`, `searchParams` are async in Next 16 — already wired that way in `src/lib/supabase/server.ts`.
- Replace placeholder PNGs in `public/icons/` with real brand artwork before launch.
# Smart_sell
