# Feature Reference

A complete list of what's implemented, organized by area. For the "why" behind design and
architecture choices, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Marketing site (public, unauthenticated)

| Page | Highlights |
|---|---|
| Home (`/`) | Hero with a per-word color-on-hover headline and real photography, animated admin-dashboard preview, "Why Nom Cloud" pillar cards, teacher/parent feature previews, an infinite-marquee "Full Platform" capability strip, closing CTA |
| Solutions (`/solutions`) | Tabbed experience for Administrators / Teachers / Parents / Students, each with its own copy and dashboard mockup |
| Features (`/features`) | Full dashboard mockups (Admin/Teacher/Parent) plus a 12-item feature grid |
| Pricing (`/pricing`) | Starter / Growth / Enterprise plans (USD), monthly-vs-annual toggle, a full plan-comparison table, and an 8-question accordion FAQ |
| Security (`/security`) | Names the actual categories of student data processed, four security pillars, an "always / never" data-practices comparison, and a 7-question security FAQ |
| About (`/about`) | Mission, values, company timeline, closing CTA — every section paired with real photography |
| Contact (`/contact`) | Validated contact form with topic selection and a success state |
| Book a Demo (`/book-demo`) | Validated multi-field form with a request summary on submission |
| Login / Signup | Role selection (Admin/Teacher/Parent) on signup, one-click demo account fill on login |
| Privacy / Terms / Cookies | Legal placeholder pages (titles translated; body text is English pending professional legal translation — see [LOCALIZATION.md](./LOCALIZATION.md)) |
| 404 | Custom not-found page |

Site-wide: dark mode, a language switcher (English / Somali / Arabic, with RTL for Arabic) in
the header, footer and dashboard top bar, a cookie-consent banner, per-page SEO metadata
(title/description/canonical/Open Graph/Twitter — `components/layout/SEO.tsx`),
`robots.txt` and `sitemap.xml`, and a payment-methods marquee in the footer using real
Mastercard/PayPal marks plus original wordmark badges for regional mobile-money brands
(EVC Plus, Dahabshiil, WAAFI, eDahab, Premier Bank, Salaam Somali Bank, International Bank of
Somalia).

## Administrator (`/app/admin/*`)

- **Dashboard** — animated live attendance trend, one-click "Add Student / Add Teacher / Make
  an Announcement" actions.
- **Students / Teachers** — full CRUD, class assignment, class-capacity validation (50 students
  per class).
- **Classes** — quick-analysis overview, per-class capacity warnings, read-only timetable
  viewer for any class.
- **Attendance / Grades / Homework / Exams** — full CRUD across all classes.
- **Fees & Payments** — monthly collection analytics (amount collected, outstanding, this
  month's total), a billing-statement view per student, and a reminder broadcast that
  messages every parent with an unpaid balance for a given month/amount.
- **Announcements** — school-wide, per-class, or parents-only, with priority levels.
- **Reports** — attendance, academic, fees, students, teachers and monthly-collection views,
  each exportable as CSV.
- **Academic Years**, **Tutorials** (video placeholders), **Settings** (school profile, logo
  upload, grading scale, branding color, notification and parent-portal toggles).

## Teacher (`/app/teacher/*`)

- **Dashboard** — live attendance trend, weekly homework load, whether a lecture is in
  progress right now; clicking "My Students" lists every assigned student with pending
  homework.
- **My Classes** — a weekly timetable builder (day/period grid) for assigned classes.
- **Attendance / Grades / Homework** — for assigned classes only (role-scoped).
- **Announcements**, **Messages** (direct threads with parents), **Tutorials**.

## Parent (`/app/parent/*`)

- **Dashboard** / **My Children** — child switcher for parents with more than one child.
- **Attendance / Grades / Homework** — read-only, per child.
- **Fees** — per-child balance overview; pay by Card, Mobile Money, Bank Transfer, eDahab or
  EVC Plus (a realistic mock flow — no real money moves), then download a generated PNG
  receipt via the Canvas API as proof of payment.
- **Announcements**, **Notifications**, **Messages** (direct threads with teachers),
  **Tutorials**.

## Cross-cutting

- **Real-time-feeling mock data** — every action (add a student, mark attendance, pay a fee,
  send a message, build a timetable slot) writes through `DataContext` and is immediately
  reflected across roles, because everyone reads from the same in-memory + `localStorage`
  state. A "Reset Demo Data" button in the sidebar restores the original seed data.
- **Multilingual UI** — see [LOCALIZATION.md](./LOCALIZATION.md).
- **School branding** — the Nom Cloud logo is replaced by the school's own uploaded logo and
  name everywhere inside the authenticated app, for all three roles.
