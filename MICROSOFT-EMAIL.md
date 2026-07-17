# Sending mail from Outlook (Microsoft Graph)

> **Status: parked (not in use).** The company's Entra team would not add our account, so this
> Graph path is on hold. Email currently goes through Gmail via `sendWeeklyEmails` in `Code.js`
> (sent from a company-provided Gmail). These notes are kept for if the Entra situation changes
> later — the delegated flow was verified working on a personal outlook.com before parking.

An optional add-on that sends the canteen debt email from an **Outlook / Microsoft**
mailbox instead of Gmail. The rest of the app is unchanged — same QR form, same Google
Sheet, same `saveOrder`. Only the *sending* step is added, via `GraphMail.js`.

Why: the company (deico.com.tr) uses Outlook, not Google. Graph is Microsoft's API for
sending mail programmatically, and it is free.

## Two modes

| | **Delegated** (free demo) | **App-only** (production) |
|---|---|---|
| Account | a personal `outlook.com` | a Microsoft 365 tenant (e.g. deico) |
| Sends as | you (the signed-in user) | a chosen mailbox (`MS_SENDER`) |
| Consent | you click "allow" once | an admin grants `Mail.Send` once |
| Set-and-forget | mostly (token may need re-auth) | yes |
| Needs OAuth2 library | yes | no |
| Cost | free, no card, no tenant | free (uses the existing M365) |

Pick the mode with the `MS_MODE` Script Property. Start with **delegated** to prove it
works on your own account; switch to **app-only** for the deico rollout.

## How it works

```
Google Apps Script (unchanged canteen app)
        │  reads unpaid debt from the Kayıtlar sheet
        ▼
sendManagerDebtSummary()  ──►  Microsoft Graph  ──►  email from Outlook to the manager
```

Secrets live in Script Properties, never in code.

---

## Mode A — Delegated (free demo, personal outlook.com)

### 1. Get a directory, then register an app

Microsoft has **deprecated app registration for a bare personal account** — you now need an
Entra *directory*. The free way: sign up for a **free Azure account** (azure.microsoft.com/free)
with your personal Microsoft account. A credit card is required **for identity verification
only**; app registration and Graph mail are free — nothing here provisions a paid resource.
Signing up creates a default directory.

Then:

1. Sign into **entra.microsoft.com** (or portal.azure.com).
2. **Applications → App registrations → New registration**.
   - Name: e.g. `Kantin Mail`.
   - Supported account types: **Accounts in any organizational directory and personal
     Microsoft accounts** — so you can sign in with your `outlook.com` at consent time.
   - **Redirect URI:** leave it empty for now — you will add the exact value in step 4 (it
     depends on the Script ID, and it must match *character for character*).
   - **Register**.
3. On the app's **Overview** page, copy the **Application (client) ID** (always visible here,
   not a one-time value).
4. **Certificates & secrets → New client secret** → copy the secret **Value** immediately
   (shown only once; if you lose it, just make a new one and delete the old).

### 2. Add the OAuth2 library in Apps Script

Apps Script editor → **Libraries (+) → Add a library** → paste this script ID exactly →
pick the latest version → identifier **`OAuth2`** → Add:

```
1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
```

> ⚠️ This is the public apps-script-oauth2 library ID (starts with `1B7F`). It is **not** your
> own project's Script ID — don't paste your project ID here, or `OAuth2.createService` will be
> "not a function". After adding, the Libraries list should show identifier **OAuth2** owned by
> Google Workspace.

### 3. Script Properties

Project Settings (⚙) → **Script Properties**. They start **empty** — click **Add script
property** and add each row manually, then **Save script properties**:

| Property | Value |
|----------|-------|
| `MS_MODE` | `delegated` |
| `MS_CLIENT_ID` | Application (client) ID (from the Overview page) |
| `MS_CLIENT_SECRET` | secret Value |
| `MANAGER_EMAIL` | who receives the summary (for the demo, your own address is fine) |

### 4. Add the code, register the redirect URI, authorize

1. Add a new file (**+ → Script**) named `GraphMail`, paste this repo's `GraphMail.js`, save.
2. **Get the exact redirect URI:** run **`showRedirectUri`**, and copy the URL it prints in the
   log (View → Logs). It looks like
   `https://script.google.com/macros/d/<SCRIPT_ID>/usercallback` — it must **end with
   `/usercallback`** and have nothing after it.
3. In Entra → your app → **Authentication → Add a platform → Web** → paste that URL **verbatim**
   → Save. (If a wrong one is there, delete it and add the correct one.)
4. Run **`authorizeGraph`**. Open the URL it logs, sign in with your outlook.com account, and
   approve. You should see "Yetkilendirme başarılı."
5. Run **`testGraphMail`** → check the inbox for the test message (sent from your Outlook).
6. Run **`sendWeeklyEmailsGraph`** (per-employee) or **`sendManagerDebtSummary`** (one summary)
   → confirm the mail arrives. (While data is placeholder, first set the fake rows' `E-posta`
   to your own address — see the caution below.)

### Troubleshooting (Mode A)

- **`invalid_request ... redirect_uri ... not valid`** — the URI registered in Entra does not
  exactly match what the script sends. Re-run `showRedirectUri`, and register that string
  verbatim under Authentication. A common slip is accidentally appending the Script ID *after*
  `/usercallback`.
- **`OAuth2.createService is not a function`** — the OAuth2 library is missing or you added the
  wrong Script ID (your project's instead of `1B7F...`). Remove it and re-add with the ID above.
- **`Missing Script Property ...`** — that property isn't set; add it under Script Properties.

---

## Mode B — App-only (production, deico M365)

Use this on the company tenant. `@deico.com.tr` custom-domain Outlook almost certainly means
Microsoft 365 / Exchange Online, so this mode should work there.

**No credit card here.** The card was only needed in the personal demo to create a new Azure
directory from scratch. The deico tenant already exists, so app registration in it is free and
card-free — you just need app-registration rights and an admin to grant consent (step 2). The
Apps Script that runs this code should be owned by the dedicated canteen Gmail, not a personal
account — see the two-account handover in `README.md`.

### 1. Register an app (in the deico tenant)

1. **entra.microsoft.com → App registrations → New registration** → name it →
   **Single tenant** → no redirect URI → Register.
2. On the app's **Overview** page, copy **Application (client) ID** and **Directory (tenant)
   ID** (both always visible there).

### 2. Grant Mail.Send (the one admin step)

**API permissions → Add → Microsoft Graph → Application permissions → `Mail.Send`** → add →
**Grant admin consent**. (An admin does this once.)

> To limit sending to just `MS_SENDER`, an admin can apply an application access policy
> (`New-ApplicationAccessPolicy`) in Exchange Online. Optional, recommended for production.

### 3. Client secret

**Certificates & secrets → New client secret** → copy the Value.

### 4. Script Properties

| Property | Value |
|----------|-------|
| `MS_MODE` | `appOnly` |
| `MS_TENANT_ID` | Directory (tenant) ID |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | secret Value |
| `MS_SENDER` | mailbox to send from (e.g. the deico address) |
| `MANAGER_EMAIL` | the manager's address |

### 5. Test

Add `GraphMail.js`, run **`testGraphMail`** (approve the `UrlFetchApp` scope), then
**`sendManagerDebtSummary`**. No OAuth2 library or interactive consent is needed in this mode.

---

## Which send function to use

- **`sendWeeklyEmailsGraph`** — the main one: emails **each employee** who has unpaid debt
  their own itemized bill (recipient = each row's `E-posta`). Outlook counterpart of
  `sendWeeklyEmails` in `Code.js`.
- **`sendManagerDebtSummary`** — optional: one email to `MANAGER_EMAIL` summarizing everyone's
  unpaid total.
- **`testGraphMail`** — smoke test only (fixed message to `MANAGER_EMAIL`).

> ⚠️ **Testing the per-employee send:** `sendWeeklyEmailsGraph` sends to the addresses in the
> sheet. While the data is placeholder, temporarily set the fake rows' `E-posta` to **your own
> address** so the test mails come to you instead of bouncing off made-up addresses.

## Automate

Apps Script editor → **Triggers (⏰) → Add trigger** → function **`sendWeeklyEmailsGraph`**
(or `sendManagerDebtSummary`), event **Time-driven → Week timer** → pick a day/time → Save.

## Notes & gotchas

- **Secret expiry:** the client secret expires (6–24 months). When it lapses, mail stops —
  set a calendar reminder to create a new secret and update `MS_CLIENT_SECRET`.
- **Delegated re-auth:** if the delegated token is revoked (password change, long inactivity),
  re-run `authorizeGraph`. `resetGraphAuth` clears the stored authorization.
- `GraphMail.js` reuses `getSheet`, `SHEET_RECORDS`, and `formatMoney` from `Code.js`, so both
  files must live in the same Apps Script project.
- This does not replace `sendWeeklyEmails` (the Gmail, per-employee version); it is a separate
  manager-summary path. Keep or delete the Gmail one as needed.
