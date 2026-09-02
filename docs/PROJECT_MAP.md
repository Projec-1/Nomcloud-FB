# Project Map

A plain-English guide to what lives where in this project. If you are opening this
folder for the first time, start here.

## Which folder is the real project?

**`D:\01_PROJECTS\NOM-CLOUD`** — this one. It is the only folder that counts.

It is the real, git-tracked project connected to GitHub
(`github.com/Projec-1/Nomcloud`). Everything you change should be changed here.

> **History note:** there used to be a second folder, `D:\01_PROJECTS\NomCloud`, which
> was the git repository before this one. Its work is fully merged into this folder and
> it has been removed. If you ever see a folder with a similar name again, check which
> one has a `.git` folder inside — only the real project has one.

## Top-level folders and files

| Folder / file | What it is for |
|---|---|
| `src/` | All the app's own code. This is where nearly all work happens. |
| `public/` | Images, logos and files served exactly as-is (photos, payment logos, icons). |
| `docs/` | Written documentation about the project, including this file. |
| `dist/` | The built, ready-to-publish version of the site. Created automatically — never edit. |
| `node_modules/` | Third-party code the project depends on. Installed automatically — never edit. |
| `index.html` | The single page the whole app loads into. |
| `package.json` | Lists the project's dependencies and the commands you can run. |
| `package-lock.json` | Records the exact version of every dependency. Managed automatically. |
| `tsconfig*.json` | Settings for TypeScript (the language the app is written in). |
| `vite.config.ts` | Settings for Vite (the tool that builds and runs the app). |
| `tailwind.config.js` | Settings for Tailwind CSS (how the app is styled). |
| `postcss.config.js` | A styling helper Tailwind needs. Rarely touched. |
| `README.md` | The project overview and how to get started. |
| `CHANGELOG.md` | A running history of what has changed, newest first. |
| `CONTRIBUTING.md` | The rules for making changes to this project. |
| `.gitignore` | Tells git which files to keep out of GitHub (including `.env`). |
| `.git/` | Git's own storage — the full project history. Never edit by hand. |
| `.agent.md` | Notes for the AI assistant about design work. Not part of the app. |

## Inside `src/`

| Folder | What it holds |
|---|---|
| `components/` | Reusable pieces of interface — buttons, inputs, the sidebar, dashboard widgets, marketing sections. Built once, used on many pages. |
| `pages/` | The actual screens people visit. Split into `public/` (the marketing site and login) and `app/` (the Admin, Teacher and Parent dashboards). |
| `context/` | Shared information the whole app can read, such as who is logged in, the chosen language, and the school's data. |
| `data/` | Stand-in sample data and the translation dictionary for English, Somali and Arabic. |
| `services/` | Small go-betweens for sending things out, such as the contact and demo-request forms. |
| `routes/` | The rules for who can open which page — for example, keeping parents out of admin screens. |
| `types/` | Definitions of the shapes of things (a Student, a Teacher, a Grade) so mistakes get caught early. |
| `utils/` | Small helpers used all over — formatting dates and money, validating input, generating receipts. |
| `hooks/` | Small reusable bits of behaviour shared between screens. |
| `lib/` | Connections to outside services. Currently holds only the Supabase setup. |
| `App.tsx` | Lists every page and its web address. |
| `main.tsx` | The very first file that runs when the app starts. |
| `index.css` | The base styles for the whole app. |

## Environment and configuration files

These two files sit at the top level and look almost the same, but they do very
different jobs. Getting them mixed up is the single most common way secrets leak.

### `.env.example` — the blank form (safe, saved to GitHub)

Lists **which** settings the project needs, with the values left empty. Its whole job is
to tell a new person "you will need to supply these two things." It contains no real
values, so it is safe to share and it **is** saved to GitHub.

### `.env` — the real values (secret, never saved to GitHub)

Holds the **actual** connection details for the Supabase database. This file is listed
in `.gitignore`, so git deliberately ignores it: it never gets saved to GitHub, never
appears in a commit, and is never shared. It exists only on this computer.

Think of it this way: `.env.example` is a blank form showing which boxes need filling
in; `.env` is your filled-in copy with the private details. You hand out the blank form,
never the filled-in one.

**Never put real values into `.env.example`.** Because that file is saved to GitHub,
anything written in it becomes public to everyone with access to the repository.

Both files declare the same two settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

> `.env` currently exists but is **empty** — the two values still need filling in by
> hand. Nothing will connect to Supabase until that is done.

## The Supabase connection

**Location:** `src/lib/supabase.ts`

This is the piece of code that will eventually connect the app to its real database.

**Current status: it exists, but nothing uses it yet.** No screen, form or dashboard
calls it, and the connection has not been successfully tested. Until that happens, the
app still runs entirely on sample data stored in the browser — nothing is saved to a
real database, and data does not travel between devices.

## Hosting

The site is hosted on Vercel and deploys from GitHub. The local link between this folder
and the Vercel project (`.vercel`) is **not currently present** — if you need to deploy
from your own machine rather than through GitHub, run `vercel link` once to recreate it.

## Do not touch

These are maintained automatically. Editing them by hand causes confusing breakage that
is hard to trace.

| File / folder | Why |
|---|---|
| `package-lock.json` | Written by npm. Hand-edits cause mismatched dependencies. |
| `node_modules/` | Installed by npm. Delete and reinstall rather than editing. |
| `dist/` | Regenerated on every build. Any manual change is wiped out. |
| `tsconfig.tsbuildinfo`, `tsconfig.node.tsbuildinfo` | Build caches. Safe to delete, pointless to edit. |
| `vite.config.js`, `vite.config.d.ts` | Auto-generated from `vite.config.ts`. Edit the `.ts` file instead. |
| `.git/` | Git's internal storage. Use git commands, never edit directly. |

## Related documents

- [README.md](../README.md) — project overview and setup
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the code is put together, in technical detail
- [FEATURES.md](./FEATURES.md) — what the product does
- [GETTING_STARTED.md](./GETTING_STARTED.md) — how to run it locally
- [LOCALIZATION.md](./LOCALIZATION.md) — how the three languages work
