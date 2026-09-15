// ---------------------------------------------------------------------------
// Avatar colour palette.
//
// Moved verbatim out of the prototype seed file, since removed. This is presentation reference
// data belonging to the design system — not seed data — so it stays in code
// rather than moving to the database later.
// ---------------------------------------------------------------------------

export const AVATAR_COLORS = [
  '#FF5A1F',
  '#0071E3',
  '#34A853',
  '#A855F7',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
  '#6366F1',
]

export function colorFor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}
