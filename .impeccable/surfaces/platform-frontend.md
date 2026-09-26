# Scope and mode

Redesign the existing Nom Cloud public website, authentication screens, Administrator, Teacher, Parent, and Operator Center. Public routes persuade; signed-in workspaces support daily school and platform operations.

# Audience and job

School administrators are the primary audience and need to run day-to-day school operations. Teachers manage classroom records, parents follow their children's school activity, and Nom Cloud operators manage platform-level school accounts and requests.

# Content and proof

Use current route content, connected school records, existing product behaviors, real Nom Cloud and school-brand assets, and existing product screenshots/previews where they accurately represent the interface. Do not invent a Student workspace, claims, users, or metrics.

# Constraints

Preserve every existing route and feature behavior. Do not change Supabase, authorization, data services, or backend logic. Preserve school branding, language selection, and Arabic RTL. Follow the user's visual constraints recorded in PRODUCT.md.

# Direction contract

## World

School Register: the familiar structure of school records becomes the shared interface grammar. Clear labels, aligned values, direct status and action controls, and useful detail views connect lists, reports, communications, and decisions without turning every screen into a table.

## First viewport

The Administrator dashboard opens on a concise welcome and today's school status. Today's attendance and actionable follow-ups take priority, followed by class and school records. Actions are visible near the information they affect. Public pages use real school photography and clear product-specific content, not a fabricated interface illustration.

## Visitor path

Visitors can understand the product and find its existing public actions. Signed-in users recognize their role, find current work, open full records, act, and return without losing their place.

## Signature interaction

Selecting a school record or operational item exposes its full context and a clear next action. Selected, pending, completed, unavailable, and error states remain legible without relying on color alone.

## Cross-surface reach

Use one semantic token and component system across marketing, authentication, all current school roles, and platform operations. Adapt the record grammar to the task: rosters and reports use aligned data; messages use conversation structure; public pages use editorial product storytelling.

## Honest risk

The register metaphor can become dense or old-fashioned if repeated literally. Use it for information hierarchy and state clarity, not paper textures, decorative rules, or table layouts where they do not help the task.

# Unresolved decisions

The authenticated Student workspace does not exist in the route map and is out of scope. Product and API behavior remain unchanged.
