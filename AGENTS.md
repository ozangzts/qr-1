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
- So in `Code.gs` the identifiers are English but some string *values* are Turkish by design.

## Tech and key constraints

- **Google Apps Script + Google Sheets.** No separate server, database, or hosting.
- `Code.gs` is **server-side Apps Script, not browser JS** (written ES5-style for V8/Rhino).
  - No `npm`, `node_modules`, build step, or packages. Do not add dependencies.
  - No DOM; uses GAS services like `SpreadsheetApp`, `HtmlService`, `MailApp`.
- `Index.html` is the client (phone browser). It talks to the server via **`google.script.run`**
  (no `fetch`/REST). All CSS/JS is inline in that one file.
- This repo is the **source copy**. To run, its contents are pasted into the Apps Script
  editor and published as a "Web app" (see `README.md`). There is no deploy-from-repo step.

## File map

| File | Role |
|------|------|
| `Code.gs` | Server: `doGet` (serves the form), `getData`, `saveOrder`, `sendWeeklyEmails`, admin menu + helpers. |
| `Index.html` | Form UI (name + product selection, live total, save/done screens). |
| `README.md` | End-user / setup guide (create Sheet, paste, publish, QR). |
| `CLAUDE.md` | Short pointer to this file. |
| `AGENTS.md` | This file. |

## Data model (Google Sheet tabs)

- **Calisanlar** (employees): `Ad Soyad` | `Eposta`
- **Urunler** (products): `Urun` | `Fiyat`  (price in TL, numeric)
- **Kayitlar** (records): `Zaman` | `Ad Soyad` | `Eposta` | `Urun` | `Adet` | `Birim Fiyat` | `Tutar` | `Odendi`
  - Each order is written as **one row per product**.
  - Rows where `Odendi` (paid) is FALSE count as debt; the weekly email sums only those.

Tab names and headers are defined by the constants at the top of `Code.gs`
(`SHEET_*`, `HEADERS_*`). If you change one, update both places.

## Conventions

- Identifiers/functions in English camelCase (`saveOrder`, `getProducts`, `formatMoney`).
- Money is rendered via `formatMoney()` (`"45.00 ₺"`).
- Need a new piece of user data? Prefer a Sheet tab + header constant over hardcoding.

## How to test

- No automated tests; setup is manual and tied to a Google account.
- To verify a change: follow `README.md` to paste into a test Sheet, publish, open the
  URL on a phone/browser, create a record, and confirm the row appears in the `Kayitlar` tab.
- For email changes: run `sendWeeklyEmails` manually from the editor (no need to wait for the
  trigger) and confirm with a test mail to yourself. Gmail has a low daily send limit (~100).

## Common pitfalls

- The HTML file must be named exactly **`Index`** in Apps Script; `doGet` calls
  `createTemplateFromFile('Index')`.
- After editing code you must publish a **new deployment** (or update the existing one);
  saving alone does not update the live URL.
- The sample employee/product data (`SAMPLE_*`) is placeholder. The real lists are managed
  from the Sheet; re-running setup will not overwrite a tab that already has data.
- Whether deico.com.tr is on Google Workspace is not yet confirmed, so the weekly-email
  **trigger is not set up** (the function is ready but off).
