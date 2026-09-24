// Which school a public page is being opened for, before anyone signs in.
//
// A school's address is `{shortcode}.class.so` (shown read-only in Admin →
// Settings). On that host the shortcode is the first label. Everywhere else —
// localhost, preview deployments, the bare marketing domain — a `?school=`
// query parameter carries it, so a school's login link works before its
// subdomain is wired up.
//
// The value is only ever used to ask school_login_branding for one school's
// public branding. It grants nothing; an unknown shortcode shows the default
// Nom Cloud login page.

const SCHOOL_DOMAIN = 'class.so'
const SHORTCODE_PATTERN = /^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$/
const NON_SCHOOL_LABELS = new Set(['www', 'app', 'api'])

export function resolveSchoolShortcode(hostname: string, search: string): string | null {
  const host = hostname.toLowerCase()
  if (host.endsWith(`.${SCHOOL_DOMAIN}`)) {
    const label = host.slice(0, -(SCHOOL_DOMAIN.length + 1))
    if (!label.includes('.') && !NON_SCHOOL_LABELS.has(label) && SHORTCODE_PATTERN.test(label)) return label
  }

  const fromQuery = new URLSearchParams(search).get('school')?.trim().toLowerCase() ?? ''
  return SHORTCODE_PATTERN.test(fromQuery) ? fromQuery : null
}
