# CareerLens — AI Resume Job Matching (Frontend)

CareerLens is a premium, frontend-only AI career-tech product. It tells you **how well** you match a
job, **why** you match, **what** you are missing, and **what to do next** — powered by mock data,
React state, and `localStorage`. No backend.

This repository contains the **premium landing page** plus the app foundation: design system,
theme, app shell, mock-data layer, and placeholder routes for every future feature page.

## Tech stack

- [React 19](https://react.dev) + [Vite 8](https://vite.dev) + TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com) (CSS-first configuration, class-based dark mode)
- [React Router v7](https://reactrouter.com)
- [Lucide React](https://lucide.dev) — icons
- [Framer Motion](https://www.framer.com/motion/) — micro-interactions
- [Recharts](https://recharts.org) — charts (installed for upcoming feature milestones)

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run lint       # oxlint
npm run preview    # serve the production build
```

Open the printed dev URL and try:

- `/` — premium marketing landing page
- `/login`, `/signup` — auth shells (placeholders)
- `/dashboard` — app shell with sidebar, header, and theme toggle
- `/jobs` → `/jobs/job-001`, `/match` → `/match/job-001` — routes wired to the mock-data layer
- Every other route renders an intentional "coming soon" workspace

## Project structure

```
src/
  assets/          # static assets
  components/
    ui/            # design-system primitives (Button, Card, Badge, Input, …)
    layout/        # AppLayout, AppSidebar, AppHeader, MobileNav, AuthLayout
  data/            # mock-data layer (candidate, resume, jobs, matches, gaps, history, …)
  hooks/           # useTheme, useLocalStorage, useClickOutside
  lib/             # cn(), theme provider, mock-store facade
  pages/           # route components (placeholders for future milestones)
  routes/          # route table
  types/           # domain types
  utils/           # (reserved) shared helpers
```

## Mock-data conventions

- All domain data lives in `src/data/*` and is typed in `src/types`.
- Feature code reads data exclusively through `src/lib/mock-store.ts` — a facade that will later
  resolve to real API calls without touching components.

## Design system

- Deep navy foundation (`navy-*`), electric violet-blue accent (`brand-*`), neutral surfaces.
- Semantic tokens (`background`, `card`, `border`, `primary`, …) that flip in `.dark` mode.
- Light / dark / system theming with `localStorage` persistence and no-flash startup script.
- Fonts: Plus Jakarta Sans (display) + Inter (body) via Google Fonts with graceful fallbacks.