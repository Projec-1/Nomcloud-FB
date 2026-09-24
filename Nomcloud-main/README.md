# Nom Cloud — Frontend

**Nom Cloud** is a private, multilingual school-management platform: a premium marketing site
plus a fully interactive product prototype covering an Administrator dashboard, a Teacher
dashboard, and a Parent app, all connecting school administration, teachers, parents and
students in one system. The interface works in English, Somali and Arabic (with right-to-left
layout for Arabic), and every role's dashboard is branded with the school's own logo and name
rather than Nom Cloud's.

Built with **React + TypeScript + Vite + Tailwind CSS + React Router + Lucide React**. There is
no backend — school data is realistic mock data held in a React context and persisted to the
browser's `localStorage`, structured so it's straightforward to swap in a real API later (see
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)). All currency in the app is displayed in **USD**.

This repository is **private**. It contains a product prototype, not yet a production system —
see the caveats called out throughout this README and the `docs/` folder before treating any
part of it (payments, legal pages, analytics) as ready to go live.

## Documentation

| Doc | Covers |
|---|---|
| [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) | Install, run, demo accounts, resetting data |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack, folder structure, the mock-backend pattern, routing/access control |
| [docs/FEATURES.md](./docs/FEATURES.md) | Full feature list by page and by role |
| [docs/LOCALIZATION.md](./docs/LOCALIZATION.md) | How the English/Somali/Arabic translation system works and how to extend it |
| [CHANGELOG.md](./CHANGELOG.md) | Notable changes, most recent first |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Conventions to follow when changing this codebase |

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`). Full details, demo
account credentials, and other scripts are in
[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md).

## What's inside

### Marketing site (public)
`/`, `/solutions`, `/features`, `/pricing`, `/security`, `/about`, `/contact`, `/book-demo`, `/login`, `/signup`,
`/privacy`, `/terms`, `/cookies` — a full multi-page marketing experience with premium UI mockups of the Admin
Dashboard, Teacher Dashboard and Parent App, scroll-reveal animations, a continuously scrolling payment-method
marquee in the footer (real Mastercard/PayPal marks plus original wordmark badges for regional mobile-money brands —
see `src/components/marketing/PaymentLogos.tsx`), real photography throughout (hero, "Why Nom Cloud", teacher/parent
previews, About, Security — see `src/data/images.ts`), a per-word color-on-hover hero headline
(`src/components/marketing/HoverText.tsx`), subtle 3D tilt-on-hover cards (`src/components/marketing/TiltCard.tsx`),
dark mode, a cookie-consent banner, and functional forms (Contact, Book a Demo) with validation and confirmation
states. "Book a Demo" as a call-to-action button appears only on the homepage and the About page, by design — the
rest of the site keeps its own contextual calls to action (View Pricing, See All Features, etc.).

### Language switcher (real, not decorative)
A language switcher (English / Somali / Arabic, with automatic RTL layout for Arabic) sits in the header, the
footer, and the dashboard top bar. Switching language actually re-renders the interface: the entire public site,
every auth screen (Login/Signup), the legal pages, the Security FAQ, the Pricing FAQ and comparison table, and the
full dashboard shell — sidebar navigation, page section labels, buttons — for all three roles (Admin/Teacher/Parent)
are wired through `useLanguage().t()` against a 409-key dictionary in `src/data/translations.ts`, verified to have
identical key coverage across all three languages. What intentionally stays in English: mock/demo data a user types
in (student names, messages, generated reports) and the full legal body text of Privacy/Terms/Cookies (only their
titles are translated — professional legal translation is a separate, specialized step we didn't want to fake).

### Authenticated product prototype
After signing up or logging in (see demo accounts below), you land in a role-specific dashboard:

- **Administrator** (`/app/admin/*`) — students, teachers, classes (50-student cap per class, with a quick-analysis
  overview), attendance, grades, homework, exams, fees & payments (monthly collection analytics, a payment-reminder
  broadcast to every unpaid parent, and a per-student billing statement), announcements, reports (attendance,
  academic, fees, students, teachers and monthly-collection views, each exportable as CSV), academic years,
  tutorials, settings. The dashboard itself has an animated live attendance trend and one-click "Add Student / Add
  Teacher / Make an Announcement" actions, and can view every class's weekly timetable. Settings now includes a
  school logo upload — once set, it (and the school's name) replaces the Nom Cloud logo everywhere inside the
  dashboard (sidebar + top bar, all three roles), so the product feels like the school's own private system.
- **Teacher** (`/app/teacher/*`) — assigned classes (with a weekly timetable builder), attendance, grades, homework,
  announcements, parent messaging, tutorials. The dashboard shows a live attendance trend, weekly homework load, and
  whether a lecture is in progress right now; clicking "My Students" lists every student with their pending homework.
- **Parent** (`/app/parent/*`) — children (with a child switcher), attendance, grades, homework, fees (pay by card,
  mobile money, bank transfer, eDahab or EVC Plus, then download a generated PNG receipt as proof of payment),
  announcements, notifications, messaging, tutorials.

All data is realistic mock data (see `src/data/mockData.ts`) held in React context (`src/context/DataContext.tsx`)
and persisted to `localStorage`, so every action — adding a student, marking attendance, recording a grade, posting
an announcement, paying a fee, sending a message, building a timetable — actually updates the shared "database" and
is reflected immediately across roles. Use the **Reset Demo Data** button in the sidebar to restore the original seed
data at any time.

### Demo accounts

| Role          | Email                                  | Password   |
|---------------|-----------------------------------------|------------|
| Administrator | `admin@nomcloud.academy`               | `demo1234` |
| Teacher       | (shown on the login page)               | `demo1234` |
| Parent        | (shown on the login page — has 2 children, try the child switcher) | `demo1234` |

The login page includes one-click buttons to fill these in. You can also sign up as a brand new Administrator,
Teacher or Parent — new teachers/parents start with no classes/children linked (a real empty state) until an
administrator assigns them, which you can do yourself from the Admin → Teachers/Students screens in the same
browser session.

## Connecting real services

A few things are intentionally isolated so they're trivial to wire up to a real backend later:

- `src/services/demoService.ts` — handles "Book a Demo" submissions.
- `src/services/contactService.ts` — handles the Contact form.
- `src/utils/receipt.ts` — generates the parent-fees payment receipt as a PNG via the Canvas API. The payment flow
  itself is a realistic mock (no money actually moves) — wire `ParentFees.tsx`'s `handlePay` to a real payment
  gateway (Stripe, a mobile-money API, etc.) when you're ready to accept real transactions.
- `src/data/translations.ts` — the English/Somali/Arabic dictionary behind the language switcher. It currently
  covers navigation, footer and the homepage hero; add more keys here and reference them via `useLanguage().t()` to
  extend coverage to the rest of the site.
- `index.html` has a commented-out Google Analytics snippet — add your real GA4 measurement ID to enable it. Search
  Console can be verified the same way, or by dropping a `google<code>.html` file into `public/`.

Both `demoService`/`contactService` currently simulate a network call and persist to `localStorage`. Replace the body
of each exported function with a `fetch()` call to your endpoint — no changes are needed anywhere else in the app.

`src/context/DataContext.tsx` similarly centralizes all school data reads/writes behind one context, so swapping the
`localStorage`-backed state for real API calls later only touches this one file.

## SEO & compliance

- `public/robots.txt` and `public/sitemap.xml` are included — update the sitemap as you add real content pages.
- `src/components/layout/SEO.tsx` is a tiny dependency-free component that sets the page title, meta description,
  canonical URL, and Open Graph / Twitter tags per page (used across the marketing site).
- `/privacy`, `/terms` and `/cookies` are placeholder legal pages — have them reviewed by counsel before going live.
- A cookie-consent banner (`src/components/layout/CookieConsent.tsx`) appears on first visit and remembers the
  visitor's choice in `localStorage`.

## Project structure

```
src/
  components/
    layout/       Public header/footer, dashboard shell, auth layout, SEO, cookie consent, language switcher
    ui/            Reusable primitives (Button, Input, Modal, Table cells, Toasts, ...)
    dashboard/     Shared dashboard widgets (AttendanceMarker, GradeBook, HomeworkBoard, MessagesPanel, TimetableGrid, TutorialsPage, ...)
    marketing/     Landing page mockups, FAQ accordion and scroll-reveal helpers
  context/         Auth, Theme, Language, Toast and Data (mock backend) providers
  data/            Seed mock data, translations
  hooks/           useInView, useSelectedChild
  pages/
    public/        Marketing site pages
    app/admin/     Administrator dashboard pages
    app/teacher/   Teacher dashboard pages
    app/parent/    Parent dashboard pages
  routes/          ProtectedRoute, RoleRoute
  services/        Demo request / contact form submission (backend-ready)
  types/           Shared TypeScript types
  utils/           Formatting, validation, receipt generation, small helpers
```

## Design direction & imagery

The marketing site follows one explicit brief: Apple-level typographic simplicity and whitespace, Stripe-style clear
product communication, Linear-grade interface polish, and subtle cinematic motion — not a literal clone of any one
site, and deliberately not a "crazy 3D" experience. In practice that means: real photography (via Unsplash's CDN —
free to use, no attribution required, see `src/data/images.ts`) instead of empty gradient placeholders, scroll-reveal
and infinite-marquee motion that was already in place, a per-word color-cycling hover effect on the hero headline,
and a lightweight CSS-only 3D tilt-on-hover applied to feature/value cards (`TiltCard.tsx` — no animation library
needed, so it stays install-free).

The Unsplash photos are hotlinked to `images.unsplash.com`; if you'd rather self-host them, download each once and
point `src/data/images.ts` at a local `/public/images/...` path instead — nothing else needs to change.

## Notes

- Dark mode is available site-wide (toggle in the header/topbar) and persists per browser.
- The logo in `public/logo-512.png` / `favicon.png` / `apple-touch-icon.png` is the Nom Cloud mark, shown on the
  public marketing site and auth screens. Once logged in, every role sees the school's own branding instead (see
  "Language switcher" and the Administrator section above for the logo upload).
- All prices, fees and financial figures throughout the app are denominated in USD.
