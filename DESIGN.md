# Nom Cloud interface system

## Direction

**School Register** is a shared visual language for school operations and platform administration. Clear headings, aligned records, concise status labels, and direct actions help staff scan real work without forcing every surface into a table.

The public site uses editorial product storytelling and existing school photography. Authenticated workspaces prioritize daily tasks, readable records, and role-specific navigation.

## Foundations

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | `#f7f8f6` | `#171917` | Page background |
| Surface | `#ffffff` | `#202320` | Main content surfaces and controls |
| Muted surface | `#f0f2ef` | `#292d29` | Secondary grouping |
| Text | `#222321` | `#f3f4f1` | Primary content |
| Muted text | `#555954` | `#b8bcb6` | Supporting content |
| Border | `rgba(34, 35, 33, 0.12)` | `rgba(243, 244, 241, 0.12)` | Subtle separation |
| Accent | `#c9471b` | `#c9471b` | Primary actions and brand emphasis |

The design uses DM Sans for interface copy and Space Grotesk for display headings. The shared radius is 10px. Elevation is communicated with spacing and borders, not drop shadows. Status colors remain semantic and always accompany readable status text.

## Layout and components

- Use existing shared primitives such as `Button`, `Input`, `Select`, `Badge`, `Modal`, `EmptyState`, `ResourceGate`, `PageHeader`, and `StatCard`.
- Prefer intrinsic grid and flex layouts, `min-width: 0`, wrapping labels, and responsive 44px-or-larger controls.
- Use two columns for compact related summaries on narrow screens when that preserves legibility; keep tables horizontally scrollable within their own region.
- Reserve tables for comparable records. Use lists for activity, messages for conversations, and detail views for individual records.
- Use Phosphor icons consistently. Give icon-only buttons an accessible name and state.

## States and interaction

Keep loading, empty, denied, error, success, selected, disabled, and destructive states explicit. Do not use color alone to communicate a state. Preserve existing route behavior, school branding, language selection, Arabic RTL, authentication, and Supabase data flows.

Keep animation limited to essential interaction feedback. Remove decorative movement and blur. Honor `prefers-reduced-motion`; retain visible keyboard focus and usable touch targets.

## Scope and ownership

The system covers public and authentication surfaces, Administrator, Teacher, and Parent workspaces, and the separate platform Operator Center. There is no authenticated Student workspace in the existing route map. Backend behavior, authorization, database access, and routes are not design-system concerns and must remain unchanged.

Update this document when a shared token or component contract changes. Prefer improving the shared primitive over adding one-off page styles.
