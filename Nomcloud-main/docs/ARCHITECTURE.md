# Architecture

This document describes how Nom Cloud's frontend is put together: the stack, the folder
structure, and the core patterns used throughout the codebase. See also
[FEATURES.md](./FEATURES.md) for what the product does, and [LOCALIZATION.md](./LOCALIZATION.md)
for the translation system specifically.

## Stack

- **React 18** with function components and hooks throughout.
- **TypeScript**, `strict: true`, compiled by Vite/esbuild (no separate Babel step).
- **Vite 5** for dev server and production bundling.
- **Tailwind CSS 3** for styling — no CSS-in-JS, no separate stylesheet files per component.
- **React Router v6** for client-side routing, including protected/role-gated routes.
- **Lucide React** for icons.
- No state-management library (Redux/Zustand/etc.) — global state lives in a small number of
  React Context providers (see below). No animation library — all motion is CSS
  transitions/keyframes or small, dependency-free components.

## High-level structure

```
src/
  components/
    layout/       Public header/footer, dashboard shell (Sidebar, Topbar), auth layout,
                   SEO, cookie consent, language switcher, school brand logo
    ui/            Reusable primitives — Button, Input, Select, Modal, Table cells,
                   Toasts, Switch, Avatar, PageHeader, Tabs
    dashboard/     Shared authenticated-app widgets — AttendanceMarker, GradeBook,
                   HomeworkBoard, MessagesPanel, TimetableGrid, TutorialsPage,
                   NotificationsDropdown, nav configuration
    marketing/     Landing-page building blocks — Reveal (scroll animation), FaqAccordion,
                   HoverText, TiltCard, PaymentLogos, and the dashboard preview mockups
                   used on the marketing site
  context/         AuthContext, ThemeContext, LanguageContext, ToastContext, and the
                   DataContext "mock backend" described below
  data/            Seed mock data (mockData.ts), the translation dictionary
                   (translations.ts), curated image URLs (images.ts)
  hooks/           useInView (for scroll-reveal), useSelectedChild
  pages/
    public/        Marketing site pages (Home, Solutions, Features, Pricing, Security,
                    About, Contact, BookDemo, Login, Signup, legal pages, 404)
    app/admin/     Administrator dashboard pages
    app/teacher/   Teacher dashboard pages
    app/parent/    Parent dashboard pages
  routes/          ProtectedRoute (requires auth), RoleRoute (requires a specific role)
  services/        demoService / contactService — isolated, backend-ready form handlers
  types/           Shared TypeScript interfaces (Role, AuthUser, SchoolSettings,
                    domain entities, TimetableSlot, etc.)
  utils/           Formatting (currency, dates), validators, id generation, cn() class
                    helper, receipt.ts (Canvas-based PNG receipt generator)
```

## The "mock backend": `DataContext`

There is no real backend in this project. `src/context/DataContext.tsx` plays that role: it
holds every piece of school data (students, teachers, classes, attendance, grades, homework,
exams, fees, announcements, messages, timetables, settings) in React state, seeded from
`src/data/mockData.ts`, and persists the whole state tree to `localStorage` on every change.

This is a deliberate design choice, not a shortcut taken carelessly:

- Every CRUD operation (add a student, mark attendance, record a payment, send a message,
  build a timetable slot) is exposed as a function on `DataContextValue` and is fully
  functional — the UI is not decorative.
- `loadState()` merges the persisted blob with `buildInitialState()`'s defaults, so adding a
  new field to the schema (as happened with `timetables` and `SchoolSettings.logoDataUrl`)
  never breaks an existing user's saved session — missing keys are backfilled rather than
  causing a crash.
- Swapping this for a real API later is intended to be a single-file change: replace the
  body of each exported function with a `fetch()` call, and remove the `localStorage`
  read/write in the provider's effects. No consuming component needs to change, because they
  all go through `useData()`.

`AuthContext` is a thin layer on top: it manages its own `localStorage`-backed user list and
session, and calls into `DataContext` when a new teacher/parent signs up (so their record
exists in the same "database").

## Routing & access control

`src/App.tsx` defines the route tree. Public routes render inside `PublicLayout`
(header + footer). Authenticated routes are nested under `ProtectedRoute` (redirects to
`/login` if there's no session) and then `RoleRoute` (redirects away if the logged-in user's
role doesn't match the route), which together enforce that a parent can never load a page
under `/app/admin/*`, etc.

## Theming, language and branding

- `ThemeContext` toggles a `dark` class on `<html>` and persists the choice.
- `LanguageContext` (see [LOCALIZATION.md](./LOCALIZATION.md)) drives `dir="rtl"|"ltr"` and
  every translated string via `useLanguage().t()`.
- Once a user is signed in, `SchoolBrandLogo` (in `components/dashboard/`) reads
  `DataContext`'s `settings.logoDataUrl` / `settings.name` and replaces the Nom Cloud mark in
  the sidebar and top bar — so the authenticated product feels like the school's own system.
  This is configured from Admin → Settings (logo upload stores a base64 data URL directly in
  `SchoolSettings`, no file upload endpoint needed).

## Verification

There is no bundled test suite. Type-checking (`npm run lint` / `tsc -b`) is the primary
safety net, along with manual QA against the demo accounts described in the main
[README](../README.md).
