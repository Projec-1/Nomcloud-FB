# Changelog

All notable changes to this project are recorded here, most recent first. This project does
not yet follow strict semantic versioning (it's a pre-release prototype); entries are grouped
by the round of work that produced them.

## Unreleased — Real localization, imagery, and brand polish

- Made the language switcher fully functional: expanded `translations.ts` to 409 keys per
  language and wired every public page, every auth screen, the legal page titles, the
  Security/Pricing FAQs, and the full dashboard shell (all three roles) through
  `useLanguage().t()`. Verified English/Somali/Arabic have identical key coverage.
- Replaced the flat hero hover-color effect with a per-word color-cycling `HoverText`
  component, and added real photography (via Unsplash) to the hero, "Why Nom Cloud" pillars,
  teacher/parent previews, the closing CTA, About, and Security.
- Replaced text-only payment badges with real Mastercard/PayPal marks (via Simple Icons) and
  original wordmark badges for regional mobile-money brands (EVC Plus, Dahabshiil, WAAFI,
  eDahab, Premier Bank, Salaam Somali Bank, International Bank of Somalia).
- Rewrote the Security page with concrete data-handling practices (what's collected, how
  access is scoped, encryption, audit logging) instead of generic copy.
- Introduced a lightweight, dependency-free 3D tilt-on-hover interaction (`TiltCard`) applied
  to feature/value cards across the marketing site, in line with an Apple/Stripe/Linear-
  inspired design direction (deliberately not a heavy 3D/WebGL experience).
- Added school branding: admins can upload a logo in Settings, which — together with the
  school's name — replaces the Nom Cloud mark in the sidebar and top bar for all roles once
  signed in.

## Earlier — Full platform build-out

- Converted all currency displays from KES to realistic USD figures across pricing, fees, and
  reports.
- Redesigned the homepage, footer, pricing "compare plans" section, and About page with
  premium, imagery-led layouts.
- Added a Security page, a Tutorials section for all three roles, a timetable builder
  (teacher-authored, admin- and teacher-viewable), and legal pages (Privacy/Terms/Cookies)
  plus a cookie-consent banner.
- Built out Admin Fees & Payments analytics (monthly collection, outstanding balances, a
  parent reminder broadcast) and a matching Parent Fees payment flow (Card, Mobile Money,
  Bank Transfer, eDahab, EVC Plus) with a Canvas-generated PNG receipt.
- Added full SEO scaffolding: per-page metadata, `robots.txt`, `sitemap.xml`, a custom 404
  page.
- Initial build: marketing site, Admin/Teacher/Parent dashboards, and the `DataContext`
  mock-backend covering students, teachers, classes, attendance, grades, homework, exams,
  fees, announcements, and messaging.
