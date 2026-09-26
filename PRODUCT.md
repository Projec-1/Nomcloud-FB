# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

School administrators are the primary users and manage day-to-day school operations. Teachers use role-scoped classroom tools. Parents follow their children's school activity and communicate with staff. Nom Cloud operators manage the platform and its school accounts. Students are represented in school records and student-facing product information, but there is no authenticated Student workspace in the current route map.

## Product Purpose

Nom Cloud connects school administration, teachers, parents, and student records in one school-branded management system. Success means each role can complete its existing school tasks in a clear, reliable workspace.

## Positioning

One school-branded system connects administrators, teachers, parents, and students through shared school operations and information.

## Operating Context

The product is a responsive web application used across public marketing pages, role-based school workspaces, and a platform operator center. School activity includes student and staff records, classes, attendance, grades, homework, exams, fees, announcements, reports, and communication. Users may work in English, Somali, or Arabic; Arabic uses right-to-left layout.

## Capabilities and Constraints

- Preserve existing public, authentication, Administrator, Teacher, Parent, and Operator routes and their current functionality.
- The current authenticated school-workspace roles are Administrator, Teacher, and Parent. Do not invent or add a Student workspace as part of this redesign.
- Keep Supabase authentication, database access, authorization, and other backend behavior unchanged. This task is limited to frontend presentation and interaction polish.
- Preserve existing language selection and right-to-left behavior for Arabic.
- The Operator Center is a platform-level workspace distinct from school workspaces.

## Brand Commitments

- Preserve the Nom Cloud name and existing brand assets.
- Authenticated school workspaces use the school's own name and uploaded logo where the current app supports them.
- The redesign's visual constraints are: no gradients, one primary accent, no emoji or decorative AI-style illustrations, one consistent corner radius, no drop shadows, subtle borders, restrained motion, Phosphor icons, responsive reflow, and a calm, minimal interface.

## Evidence on Hand

- Existing React, TypeScript, Vite, Tailwind CSS, and React Router application.
- Existing route map and page implementations under `src/pages/` and `src/App.tsx`.
- Existing Nom Cloud and school-branding assets under `public/`.
- Product capabilities documented in `docs/FEATURES.md`; route and code remain authoritative when documentation differs.
- No confirmed customer testimonials or external performance claims are required for the redesign. Do not invent them.

## Product Principles

- Prioritize school administrators' daily operations while keeping teacher and parent tasks direct and role-appropriate.
- Keep information and actions scoped to the user's role and school.
- Preserve product truth and existing backend behavior when improving the interface.
- Make the same product usable across English, Somali, Arabic, and narrow mobile screens.
