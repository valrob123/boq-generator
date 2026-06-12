# BOQ Builder — Desktop Edition

A production-ready **Bill of Quantities** builder for Philippine government
construction work (DPWH / DOH conventions), packaged as a cross-platform
Electron desktop app. Build categorized BOQs, apply markups (contingency,
overhead, profit, escalation, VAT and custom items), and export polished
**Excel** (live formulas across Cover / Summary / Detailed sheets) and **PDF**
documents with an optional branded cover page.

## What's new in this release

A complete **layout and design overhaul** to a professional SaaS app shell:

- **Persistent sidebar navigation rail** — the workflow is organized into clear
  sections (Overview, Project Setup, Categories, Line Items, Costs & Markups,
  Sign-off, Review & Export) instead of slide-in drawers.
- **Dashboard Overview** with live KPI stat cards (items, categories, subtotal,
  markups, VAT, project total) and a cost-summary table.
- **Sticky workspace header** with an editable document name, the auto-generated
  BOQ-number badge, a status pill, and primary actions (New / Open / Save /
  Save as New / Export).
- **Sticky totals bar** that always shows the running figures, on any section.
- **Modal dialogs** for opening saved BOQs and managing company branding.
- **Refined "Indigo & Slate" theme** with light/dark modes and a tuned type
  scale (Plus Jakarta Sans display + Inter body + JetBrains Mono figures).
- The auto-generated **BOQ number drives the document name** automatically
  (override it any time by typing your own).

## Tech stack

- **Node.js LTS**, **React 18** + **Vite 6** (JSX), plain CSS design system
- **Electron 33** desktop runtime + **electron-builder** packaging
- **ExcelJS** (styled, formula-driven workbooks) and **html2pdf.js** (PDF)
- **lucide-react** icons
- State via React Context (`App`, `Theme`, `Settings`, `Notification`);
  persistence in `localStorage` with a small pub/sub store.

## Project structure

```
boq-desktop/
├─ electron/
│  ├─ main.js              # Electron main process (window + lifecycle)
│  └─ preload.js           # context bridge
├─ src/
│  ├─ components/
│  │  ├─ ContentCard.jsx
│  │  ├─ ErrorBoundary.jsx
│  │  └─ layout/
│  │     ├─ Sidebar.jsx        # navigation rail + branding/theme
│  │     ├─ AppHeader.jsx      # sticky header: doc name, badge, actions
│  │     ├─ TotalsBar.jsx      # sticky live totals footer
│  │     ├─ StatCard.jsx       # KPI tile (Overview)
│  │     ├─ OpenDialog.jsx     # open a saved BOQ (modal)
│  │     └─ BrandingDialog.jsx # company logo + name (modal)
│  ├─ context/             # App, Theme, Settings, Notification providers
│  ├─ hooks/useSavedWork.js
│  ├─ pages/BOQ.jsx        # the editor (sectioned workspace + exports)
│  ├─ utils/               # docNumber.js (auto-numbering), storage.js
│  ├─ styles/index.css     # full design system + app-shell layout
│  └─ main.jsx             # providers + mount
├─ index.html
├─ vite.config.js
└─ package.json
```

## Getting started

```bash
# 1. Install dependencies
npm install
# (in constrained/offline environments where the Electron binary can't be
#  fetched on install, use: npm install --ignore-scripts)

# 2. Run in development (Vite dev server + Electron with hot reload)
npm run dev

# 3. Or run the renderer alone in a browser
npm run dev:vite        # http://localhost:5173
```

## Build & package

```bash
npm run build           # production renderer build -> dist/
npm run start           # build then launch Electron against the build

# Installers (output to release/)
npm run dist:win        # Windows NSIS installer
npm run dist:mac        # macOS dmg
npm run dist:linux      # Linux AppImage + deb
```

## Git setup

```bash
git init
git add .
git commit -m "feat: professional app-shell redesign (sidebar nav, dashboard, sticky totals)"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

> `node_modules/`, `dist/`, and `release/` are git-ignored.

## Notes

- All saved work, branding, theme and BOQ counters persist in `localStorage`,
  so documents survive restarts. Use **Save as New** to fork the current BOQ
  under the next number.
- Exports are named after the document/BOQ number for easy filing.

## Optional: Firebase cloud sign-in & BOQ backup

The app is **offline-first**. Firebase is entirely optional — with no `.env`
present, cloud features are hidden and nothing changes. Add Firebase to enable
email/password sign-in and backing up BOQs to the cloud (reachable from any
machine).

### 1. Install (already included)

`firebase` is in `dependencies`, so `npm install` pulls it in. (No extra step.)

### 2. Configure your keys (`.env`)

Copy the template and fill in your Firebase web config
(Firebase console → Project settings → General → Your apps):

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`.env` is git-ignored; `.env.example` is committed. **Rebuild** after editing
(`npm run build` / restart `npm run dev`) — Vite inlines these at build time.

> **These keys are not secret.** Vite bundles `VITE_*` values into the client,
> so anyone with the app can read them — and that's fine: the Firebase web
> config is public by design. Your data is protected by **Authentication +
> Firestore Security Rules**, not by hiding the config.

### 3. Initialize the connection

Already wired in `src/firebase.js` — it initializes **only** when the keys are
present and never crashes the app if they're missing or invalid. It exports
`auth`, `db`, and `isFirebaseConfigured`.

### 4. Turn on Firebase services

In the Firebase console: enable **Authentication → Email/Password**, and create
a **Firestore** database. Then paste these starter security rules so each user
can only read/write their own BOQs:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/boqs/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### Using it

Open **Sign in to sync** in the sidebar footer → create an account or sign in →
**Back up current BOQ**, and load/delete your cloud copies from the same dialog.
Cloud documents are stored at `users/{uid}/boqs/{boqNumber}`.

> **Electron note:** email/password auth works out of the box. OAuth *popup*
> providers (e.g. Google) don't work over the `file://` protocol in a packaged
> Electron app without extra setup, so this build uses email/password.

## Subscriptions & the Pro paywall

The app now has a per-user **subscription layer** on top of authentication:

| Capability | Where |
|---|---|
| Create account / Login / Logout | Login screen + sidebar account |
| **Password reset** | "Forgot password?" on login, and in the account dialog |
| **User profile + subscription status** | Firestore `users/{uid}` (`plan`, `subscriptionStatus`, `email`, `createdAt`) |
| **Pro paywall** | Cloud backup & sync are gated to `plan === 'pro'` |
| **Upgrade flow** | "Upgrade to Pro" → plan comparison + activation |

Free users get the full local tool (build, dashboard, Excel/PDF export). **Pro**
adds cloud backup/sync. The `plan` field on `users/{uid}` is the single source
of truth, read live via a Firestore listener.

### Updated Firestore security rules

Replace your rules with these so each user can read/write **only their own**
profile and BOQs:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      // For testing, allow the owner to write their own profile:
      allow write: if request.auth != null && request.auth.uid == uid;

      match /boqs/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

### Turning Pro on

There are three ways to set a user's `plan` to `"pro"`:

1. **Firebase console** (immediate, no code): Firestore → `users/{uid}` → set
   `plan` = `"pro"`. The app reacts instantly.
2. **Activation code** (desktop license-key style): set
   `VITE_PRO_ACTIVATION_CODE=YOUR-CODE` in `.env`, rebuild, then enter the code
   in the Upgrade dialog.
3. **Developer test buttons**: when running `npm run dev`, the Upgrade dialog
   shows "Set Pro / Set Free" buttons to preview the paywall.

### ⚠️ Making it a *real* paid wall

This build does **not** charge money — that needs a payment provider, which
Firebase Console alone can't do (exactly as your reference noted). To take real
payments you add:

- **Stripe** (Checkout or Payment Links) for the purchase, and
- a **Cloud Function webhook** that listens for Stripe events and writes
  `plan: 'pro'` / `subscriptionStatus` to `users/{uid}` — server-side.

When you do that, **harden the rules** so clients can't grant themselves Pro —
remove the user-writable `plan` and let only the Function (admin) write it, e.g.
disallow client edits to the `plan` field:

```
allow update: if request.auth.uid == uid
  && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['plan','subscriptionStatus']);
```

I can wire the Stripe + Cloud Function side whenever you're ready.
