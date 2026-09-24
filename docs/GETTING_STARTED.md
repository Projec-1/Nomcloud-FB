# Getting Started

## Prerequisites

- Node.js 18+ and npm.

## Install & run

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

## Other scripts

```bash
npm run build     # type-check + production build (outputs to dist/)
npm run preview   # preview the production build locally
npm run lint       # type-check only, no emit
```

## Demo accounts

| Role          | Email                                                                | Password   |
|---------------|-----------------------------------------------------------------------|------------|
| Administrator | `admin@nomcloud.academy`                                              | `demo1234` |
| Teacher       | shown on the login page                                                | `demo1234` |
| Parent        | shown on the login page (this account has 2 children — try the switcher) | `demo1234` |

The login page has one-click buttons that fill these in for you. You can also sign up as a
brand-new Administrator, Teacher or Parent — new teachers/parents start with no
classes/children linked until an administrator assigns them (a real empty state), which you
can do yourself from Admin → Teachers/Students in the same browser session.

## Where the data lives

There's no backend — see [ARCHITECTURE.md](./ARCHITECTURE.md#the-mock-backend-datacontext).
Everything is held in memory and persisted to your browser's `localStorage`. Use the
**Reset Demo Data** button in the sidebar at any time to restore the original seed data.

## Connecting a real backend later

See the "Connecting real services" section of the main [README](../README.md) — the short
version is that `DataContext`, `demoService.ts` and `contactService.ts` are the three files
designed to be swapped for real API calls, and nothing else needs to change.
