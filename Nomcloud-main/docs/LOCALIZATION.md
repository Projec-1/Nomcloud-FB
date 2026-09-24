# Localization (i18n)

Nom Cloud ships with a small, dependency-free translation system — no `react-i18next`,
`formatjs`, or similar library. It's implemented in three files:

- `src/data/translations.ts` — a flat `{ [key: string]: string }` dictionary per language
  (`en`, `so`, `ar`), 409 keys each, kept in sync (there is no key present in one language and
  missing in another).
- `src/context/LanguageContext.tsx` — `LanguageProvider` / `useLanguage()`. Persists the
  chosen language to `localStorage`, and sets `document.documentElement.lang` and `dir`
  (`rtl` for Arabic, `ltr` otherwise) so the whole page mirrors correctly.
- `src/components/layout/LanguageSwitcher.tsx` — the dropdown UI, used in the public header,
  public footer, and the authenticated dashboard's top bar.

## Using it in a component

```tsx
import { useLanguage } from '@/context/LanguageContext'

function Example() {
  const { t } = useLanguage()
  return <h1>{t('home.title')}</h1>
}
```

`t(key)` looks up `key` in the current language, falls back to English if missing, and falls
back to the raw key string as a last resort — so a missing translation never crashes the app,
it just visibly shows the key (a useful signal during development).

For content that's a numbered/lettered list (FAQ entries, hero bullet points, timeline items),
the convention is a numeric suffix so the JSX can build the key at render time:

```tsx
const faqs = ['1', '2', '3'].map((n) => ({ q: t(`security.faq.q${n}`), a: t(`security.faq.a${n}`) }))
```

## What is — and isn't — translated

Translated: the entire public marketing site, every auth screen (Login/Signup), the legal
pages' titles, the Security and Pricing FAQs, and the full authenticated dashboard shell
(sidebar navigation labels, role labels, top-bar strings) for all three roles.

Deliberately left in English:

- **Mock/demo data** a user types in or that ships as seed data — student names, messages,
  generated reports. Translating live user content isn't a real localization feature; it
  would just be mangling data.
- **The body text of Privacy/Terms/Cookies.** Only their titles are translated. Legal text
  needs a professional, certified translation pass — auto-translating compliance language and
  presenting it as-is would be worse than leaving it in one language with a clear note.

## Adding a new language

1. Add the language to `LANGUAGES` in `translations.ts` (code, label, native label, `dir`).
2. Add a full key set for it to the `translations` object — every key that exists in `en`
   should exist for the new language too (nothing enforces this at compile time; the
   dictionaries were verified to match key-for-key by a one-off script during development —
   consider re-running an equivalent check after large additions).
3. That's it — `LanguageSwitcher` reads from `LANGUAGES` automatically.

## Adding a new translated string

1. Add the English value to the `en` block in `translations.ts`, under a namespaced key that
   matches its page (`home.*`, `security.*`, `dash.nav.*`, etc.).
2. Add the same key to `so` and `ar` with translated values.
3. Replace the hardcoded JSX string with `{t('your.new.key')}`.
