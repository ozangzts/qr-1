# AGENTS.md

For AI agents (Claude Code, etc.) working in this project. Read this first to get
oriented quickly and work with the right assumptions.

## What this is

A small internal tool that records what employees buy at the company canteen
(toast, tea, coffee...) and tracks their debt. Flow:

```
QR code on paper → web form → [pick name] + [pick products/qty] + Save
                                     ↓
                          written as rows into a Google Sheet
                                     ↓
              (optional) weekly "you owe X ₺" email sent automatically
```

Planned to be extended later to other areas (with different product lists).

## Language policy (important)

- **Code, comments, and docs are English.**
- **Turkish is kept only for text people actually read**, specifically:
  - Employee-facing UI strings in `Index.html` (labels, buttons, messages).
  - Error messages thrown by the server that surface on the site (in `saveOrder`).
  - The weekly debt email body/subject (the employee reads it).
  - Sheet tab names, column headers, and the admin "Kurulum" menu (the manager reads them).
- So in `Code.js` the identifiers are English but some string *values* are Turkish by design.

## Tech and key constraints

- **Google Apps Script + Google Sheets.** No separate server, database, or hosting.
- `Code.js` is **server-side Apps Script, not browser JS** (written ES5-style for V8/Rhino).
  The `.js` extension is only for local editor highlighting; its content is pasted into the
  Apps Script editor's `.gs` server file (you paste the code, not the file).
  - No `npm`, `node_modules`, build step, or packages. Do not add dependencies.
  - No DOM; uses GAS services like `SpreadsheetApp`, `HtmlService`, `MailApp`.
- `Index.html` is the client (phone browser). It talks to the server via **`google.script.run`**
  (no `fetch`/REST). All CSS/JS is inline in that one file.
- This repo is the **source copy**. To run, its contents are pasted into the Apps Script
  editor and published as a "Web app" (see `README.md`). There is no deploy-from-repo step.

## File map

| File | Role |
|------|------|
| `Code.js` | Server: `doGet` (serves the form), `getData`, `saveOrder`, `sendDailyReminders`/`sendAllRemindersNow`, admin menu + helpers. |
| `Index.html` | Form UI (name + product selection, live total, save/done screens). |
| `GraphMail.js` | Optional add-on: send the debt email from Outlook/M365 via Microsoft Graph (app-only) instead of Gmail. Reuses `getSheet`/`SHEET_RECORDS`/`formatMoney` from `Code.js`. |
| `README.md` | End-user / setup guide (create Sheet, paste, publish, QR). |
| `MICROSOFT-EMAIL.md` | Setup guide for the Outlook/Graph email add-on (app registration, Script Properties, test). |
| `CLAUDE.md` | Short pointer to this file. |
| `AGENTS.md` | This file. |

## Data model (Google Sheet tabs)

- **Çalışanlar** (employees): `Ad Soyad` | `E-posta`
- **Ürünler** (products): `Ürün` | `Fiyat`  (price in TL, numeric)
- **Kayıtlar** (records): `Zaman` | `Ad Soyad` | `E-posta` | `Ürün` | `Adet` | `Birim Fiyat` | `Tutar` | `Ödendi`
  - Each order is written as **one row per product**.
  - Rows where `Ödendi` (paid) is FALSE count as debt; the weekly email sums only those.

Tab names and headers are defined by the constants at the top of `Code.js`
(`SHEET_*`, `HEADERS_*`). If you change one, update both places.

## Conventions

- Identifiers/functions in English camelCase (`saveOrder`, `getProducts`, `formatMoney`).
- Money is rendered via `formatMoney()` (`"45.00 ₺"`).
- Need a new piece of user data? Prefer a Sheet tab + header constant over hardcoding.
- Employee `<option>` VALUE is the unique **email**, not the name (names can repeat);
  `dataset.name` holds the display name. The email is appended to the label only when a
  name is duplicated. `saveOrder` gets name from `dataset.name`, email from the value.
- `Index.html` remembers the last selected person per device in `localStorage` by email
  (`kantin_last_email`) and pre-selects it on load; demo uses `kantin_demo_last_email`.

## How to test

- No automated tests; setup is manual and tied to a Google account.
- To verify a change: follow `README.md` to paste into a test Sheet, publish, open the
  URL on a phone/browser, create a record, and confirm the row appears in the `Kayıtlar` tab.
- For email changes: run `sendAllRemindersNow` manually from the editor (no need to wait for the
  trigger) and confirm with a test mail to yourself. Gmail has a low daily send limit (~100).

## Common pitfalls

- The HTML file must be named exactly **`Index`** in Apps Script; `doGet` calls
  `createTemplateFromFile('Index')`.
- Redeploy is only needed for **form-facing** changes (`doGet`, `Index.html`, and the
  functions the page calls via `google.script.run`: `getData`, `saveOrder`). Editor/trigger
  functions (setup, the reminder emails) run the latest saved code — **no redeploy** for those.
- The sample employee/product data (`SAMPLE_*`) is placeholder. The real lists are managed
  from the Sheet; re-running setup will not overwrite a tab that already has data.
- `setup()` applies a data-validation rule (unique email) and calls `getUi()` in a try/catch;
  the validation formula uses **`;`** separators because the sheet locale is Turkish.

## Email reminders (important)

- deico uses **Outlook/Microsoft**, but email goes out via **Gmail** (`MailApp`) from a
  company-provided Google account. The Outlook/Graph path (`GraphMail.js`, `MICROSOFT-EMAIL.md`)
  is **parked** — the Entra team wouldn't add the account. See the memory note if reviving it.
- Free Gmail caps at **~100 recipients/day**, and the site has **~200+ employees**. So
  `sendDailyReminders` (the daily-trigger target) mails only the debtors whose email hashes to
  today's weekday bucket (`emailBucket_(email, 5)` → Mon–Fri): each person is reminded once a
  week, no day exceeds the quota. It is **stateless** — a person's day is derived from their
  email, so there's no tracking to corrupt, no double-send; a missed run just waits a week.
- A person is reminded only once their **oldest unpaid item is older than `REMINDER_GRACE_DAYS`**
  (currently 3) — `isDueForReminder_`. Fresh purchases aren't nagged; both senders and
  `logReminderPlan` honor this.
- `sendAllRemindersNow` mails everyone in one run (manual backup; can exceed the 100/day cap).
  `logReminderPlan` logs the per-weekday counts to verify the split. `sendReminder_` wraps each
  send in try/catch so one bad address never aborts the batch. `sendTestReminder` previews the
  mail for `TEST_EMAIL` only, ignoring grace/bucket — safe to run with the real list loaded.
- The daily trigger needs the project **time zone set to Europe/Istanbul** so "morning" and the
  weekday are local. Don't change the bucket count (5) casually — it shifts everyone's day.
