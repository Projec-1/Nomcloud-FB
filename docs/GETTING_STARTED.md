# Getting Started

## Prerequisites

- Node.js 18+ and npm.

## Install & run

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

## Supabase configuration

The application uses the existing Supabase project. Add the project URL and
publishable key to a local `.env` file at the repository root:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Never commit `.env` or place service-role credentials in frontend code. Restart
Vite after changing environment values. Sign-in uses existing Supabase Auth
accounts and active membership/platform-admin records; this project does not
provide shared demo credentials.

## Other scripts

```bash
npm run build     # type-check + production build (outputs to dist/)
npm run preview   # preview the production build locally
npm run lint       # type-check only, no emit
```

## Where the data lives

Supabase Auth, PostgreSQL, RLS and the existing Edge Functions provide the
backend for supported school workflows. Features without an existing backend
remain explicitly preview-only. Student accounts are not supported by the
current V1 membership schema; students are managed by school staff and linked
to guardian accounts.
