# Sending mail from Outlook (Microsoft Graph)

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
   - **Redirect URI:** platform **Web**, value:
     `https://script.google.com/macros/d/{SCRIPT_ID}/usercallback`
     Get `{SCRIPT_ID}` from Apps Script → Project Settings → "Script ID". (You can also add
     this later, after step 3, once you know the ID.)
   - **Register**.
3. Copy the **Application (client) ID**.
4. **Certificates & secrets → New client secret** → copy the secret **Value** (shown once).

### 2. Add the OAuth2 library in Apps Script

Apps Script editor → **Libraries (+) → Add a library** → paste script ID
`1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF` → pick the latest version →
identifier **`OAuth2`** → Add.

### 3. Script Properties

Project Settings (⚙) → Script Properties → add:

| Property | Value |
|----------|-------|
| `MS_MODE` | `delegated` |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | secret Value |
| `MANAGER_EMAIL` | who receives the summary (for the demo, your own address is fine) |

### 4. Add the code and authorize

1. Add a new file (**+ → Script**) named `GraphMail`, paste this repo's `GraphMail.js`, save.
2. Run **`authorizeGraph`**. Open the URL it logs (View → Logs), sign in with your
   outlook.com account, and approve. You should see "Yetkilendirme başarılı."
3. Run **`testGraphMail`** → check the inbox for the test message (sent from your Outlook).
4. Run **`sendManagerDebtSummary`** → confirm the debt table arrives.

---

## Mode B — App-only (production, deico M365)

Use this on the company tenant. `@deico.com.tr` custom-domain Outlook almost certainly means
Microsoft 365 / Exchange Online, so this mode should work there.

### 1. Register an app (in the deico tenant)

1. **entra.microsoft.com → App registrations → New registration** → name it →
   **Single tenant** → no redirect URI → Register.
2. Copy **Application (client) ID** and **Directory (tenant) ID**.

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
