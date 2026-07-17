# Firebase Setup

Manual steps to provision the Firebase project this app depends on. These all
require you to be logged into the Firebase console / CLI interactively, so
they're not something I can run for you — work through them once, in order.

Reference: [ARCHITECTURE.md](ARCHITECTURE.md) §2, §9. Files in this repo that
these steps configure: [firebase.json](firebase.json), [.firebaserc](.firebaserc),
[firestore.rules](firestore.rules), [storage.rules](storage.rules),
[.env.example](.env.example).

## 0. Prerequisites

- A Google account you're happy to use as the app's single owner account.
- Node.js installed (already true — you're running the scaffold).
- The Firebase CLI: `npm install -g firebase-tools` (or run it via `npx
  firebase-tools` each time, if you'd rather not install globally).

## 1. Create the Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and
   click **Add project**.
2. Name it (e.g. `photo-frame`). Note the generated **project ID** — it's
   usually the name with a random suffix (e.g. `photo-frame-a1b2c`) — you'll
   need it below. Google Analytics is not needed for this app; you can
   disable it.
3. Wait for project creation to finish.

## 2. Upgrade to the Blaze (pay-as-you-go) plan

Cloud Storage requires Blaze; Firestore/Auth/Hosting work on the free Spark
plan but Storage will not activate without Blaze.

1. In the console, click the gear icon → **Usage and billing** → **Details &
   settings** → **Modify plan**.
2. Select **Blaze**, attach a billing account (a card is required even though
   usage will be small).
3. **Recommended:** set a budget alert (same screen, or Google Cloud Console →
   Billing → Budgets & alerts) at, say, $5/month — at single-user scale
   (<10k photos) ARCHITECTURE.md §2 estimates a few dollars/month, so an alert
   catches any misconfiguration early rather than after the fact.

## 3. Register a Web App and get your config

1. Console → Project overview → click the **`</>`** (web) icon to add a web
   app.
2. Nickname it (e.g. `photo-frame-web`). Do **not** check "Also set up
   Firebase Hosting" here — Hosting is configured via the CLI in step 8.
3. You'll be shown a `firebaseConfig` object. Copy `apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.
4. In the repo, copy the env template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   Paste the six values into `.env.local` (each `VITE_FIREBASE_*` key maps
   directly to the matching field in `firebaseConfig`). `.env.local` is
   gitignored — never commit it.

## 4. Enable Authentication

ARCHITECTURE.md specifies a single allowed account with no multi-user
sharing. Google Sign-In is the simplest way to get that with no password to
manage:

1. Console → **Build → Authentication → Get started**.
2. **Sign-in method** tab → enable **Google**. Set the support email to your
   own.
3. Leave all other providers disabled — fewer enabled providers means less
   attack surface, and this app only ever expects one identity.

(If you'd rather use Email/Password instead of Google, enable that provider
here instead — nothing else in this doc changes except the sign-in UI you'll
build in F1.)

## 5. Enable Cloud Firestore

1. Console → **Build → Firestore Database → Create database**.
2. **Start in production mode** (not test mode — test mode allows open
   read/write for 30 days, which you don't want even temporarily for photo
   metadata).
3. Pick a **region** close to you. **Write this region down** — Storage (next
   step) must use the same region to avoid cross-region latency and egress
   costs.

## 6. Enable Cloud Storage

1. Console → **Build → Storage → Get started**.
2. **Start in production mode**.
3. Choose the **same region** you picked for Firestore in step 5.

## 7. Link the Firebase CLI to this project

From the repo root:

```bash
firebase login
firebase use --add
```

`firebase use --add` will list your Firebase projects — pick the one you just
created, and give it the alias `default`. This updates
[.firebaserc](.firebaserc), which currently has a placeholder:

```json
{ "projects": { "default": "REPLACE_WITH_YOUR_PROJECT_ID" } }
```

Confirm it now shows your real project ID.

## 8. Restrict access to your account (important — do this before deploying rules)

[firestore.rules](firestore.rules) and [storage.rules](storage.rules) in this
repo implement ARCHITECTURE.md §9's rule shape, but hardened: they check
**both** that the request path matches the authenticated UID **and** that the
UID equals a hardcoded constant. This matters because Firebase Auth, by
default, accepts sign-in from *any* Google account — without the hardcoded
check, anyone could sign in with their own Google account and read/write
their own `users/{theirUid}/…` tree, which technically satisfies "the path
matches the caller's UID" while violating "single owner account" (F1).

To fill in that constant:

1. Temporarily deploy permissive-enough rules to let you sign in once, or
   simply run the app locally (`npm run dev`) once F1's sign-in screen is
   wired up, sign in with your Google account, and open the browser
   devtools console — `auth.currentUser.uid` after sign-in gives you the UID.
   (Simplest alternative: Console → Authentication → Users tab, after your
   first sign-in attempt — the UID is listed there even if the sign-in was
   rejected by rules.)
2. In both [firestore.rules](firestore.rules) and [storage.rules](storage.rules),
   replace `REPLACE_WITH_OWNER_UID` with that UID.
3. Deploy the rules:

   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

Until you complete this step, the rules deny all access (the trailing
catch-all `allow read, write: if false` in both files), which is the correct
fail-closed default — better to be locked out than to accidentally ship an
open rule set.

## 9. Deploy Hosting

Once you have something worth deploying:

```bash
npm run build
firebase deploy --only hosting
```

[firebase.json](firebase.json) is already configured to serve `dist/` with a
single-page-app rewrite (`**` → `/index.html`), which `react-router-dom`'s
`createBrowserRouter` needs for client-side routes to survive a page refresh.

## 10. Recommended hardening (can be done later, not blocking)

These aren't required to get the walking skeleton running, but line up with
ARCHITECTURE.md §7 and §9:

- **App Check**: Console → Build → App Check → register your web app with
  reCAPTCHA v3 (or Enterprise). This rejects traffic that isn't coming from
  your actual app (scripts, curl, bots) before it even reaches your rules.
  Once you have a site key, wire it up in `src/services/firebase.ts` via
  `initializeAppCheck()` — there's a comment marking where.
- **OAuth consent screen**: Google Cloud Console → APIs & Services → OAuth
  consent screen → set **User type: Internal** if your Google account is on a
  Google Workspace domain, or add yourself as the only entry under **Test
  users** if it's a personal `@gmail.com` account and the app stays in
  "Testing" publishing status. Either way, this stops the sign-in screen from
  being usable by arbitrary Google accounts even before your rules reject
  them.
- **Budget alert** — see step 2 if you skipped it.

## 11. Local development workflow

- `.env.local` holds your real Firebase config (gitignored). `npm run dev`
  reads it automatically via Vite.
- The app talks to your **live** Firestore/Storage/Auth by default — there
  are no emulators wired up yet. If you want offline/cheap iteration later,
  `firebase init emulators` adds that on top of this same project; not needed
  for the walking skeleton.

## Troubleshooting

- **"Missing required environment variable" thrown from `src/services/firebase.ts`**:
  you haven't created `.env.local`, or a key is misspelled — recheck against
  `.env.example`.
- **Firestore/Storage requests fail with `PERMISSION_DENIED`**: expected until
  step 8 is complete (rules are fail-closed), or your hardcoded UID doesn't
  match the signed-in account.
- **Storage bucket / Firestore region mismatch warning**: you picked
  different regions in steps 5 and 6. You cannot change a bucket's or
  database's region after creation — delete and recreate the mismatched one
  before you've stored any data.
