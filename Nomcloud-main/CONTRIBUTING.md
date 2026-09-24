# Contributing

This is currently a single-owner private project, but these conventions keep the codebase
consistent as it grows — whether that's future-you, a hired developer, or a small team.

## Before you start

Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) first. In particular, understand that
there is no real backend yet — `DataContext` is the single source of truth for all school
data, and `translations.ts` is the single source of truth for all UI copy. Most features
touch one or both of these files.

## Code style

- TypeScript, `strict: true`. Don't add `any` to work around a type error — fix the type.
- Function components + hooks only; no class components.
- Tailwind utility classes for styling. Avoid inline `style={{}}` unless the value is
  genuinely dynamic (a brand color, a computed width) — static styling belongs in classes.
- Prefer small, focused components in `components/ui/` or `components/dashboard/` over
  duplicating markup across pages.
- Run `npm run lint` (a type-check, no separate linter is configured) before committing —
  it should report zero errors.

## Adding a feature

1. If it needs new data, extend `SchoolSettings`/the relevant type in `src/types/index.ts`
   and `DataContext`'s state, seed data, and CRUD functions — see the `timetables` slice in
   `DataContext.tsx` for a template on doing this without breaking existing users'
   `localStorage` data (always give new fields a safe fallback in `loadState()`).
2. If it adds any UI copy, add English/Somali/Arabic keys to `translations.ts` (see
   [docs/LOCALIZATION.md](./docs/LOCALIZATION.md)) rather than hardcoding strings — the
   convention is namespaced keys like `dash.nav.students` or `pricing.faq.q1`.
3. Update [docs/FEATURES.md](./docs/FEATURES.md) and, if user-facing, the main
   [README](./README.md).
4. Add an entry to [CHANGELOG.md](./CHANGELOG.md) under a new "Unreleased" heading (or the
   current one, if it's still open).

## Commit messages

Short, imperative, and specific: `Add class-capacity validation to Students page`, not
`updates` or `fix stuff`.
