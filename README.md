# Canteen Records & Debt Tracking (QR + Google Sheets)

Employees scan the QR code on paper → the web page opens → they pick their **name** and
the **products** they took, then press **Save** → the record lands in a Google Sheet.
Later, a weekly "you owe X ₺" email can be sent automatically.

No hosting, free. Everything runs on Google Sheets + Apps Script.

## Files

| File | Purpose |
|------|---------|
| `Code.js` | Server side: serves the form, writes records to the Sheet, and (optionally) sends the weekly email. |
| `Index.html` | The form UI that opens on the phone (name + product selection). |

## Setup (one-time, ~10 min)

1. **Create a Google Sheet**: go to [sheets.new](https://sheets.new) → give it a name
   (e.g. "Kantin Kayıt").
2. Open **Extensions → Apps Script**.
3. In the editor:
   - Apps Script opens with a default server file named **`Code.gs`**. Delete its contents
     and paste this repo's **`Code.js`** into it. (This repo uses the `.js` extension only for
     local syntax highlighting; in Apps Script the server file is a `.gs` file — you copy the
     code, not the file.)
   - Add a new file with **+** → type **HTML** → name it exactly **`Index`** (the `.html`
     is added automatically). Paste this repo's **`Index.html`** into it.
   - Save (💾).
4. **Close the editor, go back to the Sheet**, and reload the page. A new **"Kurulum"** menu
   appears at the top → **"Sayfaları oluştur ve örnek veri ekle"**. (The first time, Google
   asks for authorization → approve it.)
   - The `Çalışanlar`, `Ürünler`, `Kayıtlar` tabs are created and filled with sample data.
5. **Publish**: in the Apps Script editor, top-right **Deploy → New deployment** →
   type **Web app** →
   - *Execute as*: **Me (your account)**
   - *Who has access*: **Anyone** (if it's on the internal network, "Anyone within your org" also works)
   - **Deploy** → copy the given **URL**. The form is now live at that address.

## Generating the QR code

Feed the published URL into any QR generator (e.g. search "qr code generator"), and print
the resulting image onto paper/a label. Anyone who scans it opens the form.

> If the URL is long, shorten it (e.g. with bit.ly) and generate the QR from the short link.

## Editing the lists

- **Employees**: `Çalışanlar` tab → `Ad Soyad` | `E-posta`. Add/remove rows, that's it.
- **Products & prices**: `Ürünler` tab → `Ürün` | `Fiyat`. Change a price and the form updates automatically.

The sample data is placeholder; replace it from these tabs once the real list arrives.

## How records are stored

Each record lands in the `Kayıtlar` tab as **one row per product**:

`Zaman | Ad Soyad | E-posta | Ürün | Adet | Birim Fiyat | Tutar | Ödendi`

When a debt is settled, set the **`Ödendi`** cell of the relevant rows to `TRUE` (checked);
the weekly email counts only rows where `Ödendi = FALSE` as debt.

## Debt reminder emails (currently off)

Reminders are sent from the Google account that runs the script (Gmail). With ~200+ people,
free Gmail's ~100-recipient/day limit means everyone can't be emailed at once, so
**`sendDailyReminders`** spreads debtors across the five weekdays by a hash of their email:
each person gets one reminder on their weekday morning, and no single day exceeds the limit.
It is **stateless** (a person's day comes from their email), so no one is ever double-reminded;
a missed run just waits for next week — it never over-sends.

To enable:

1. Apps Script editor → left menu **Triggers** (⏰) → **Add trigger**.
2. Function: **`sendDailyReminders`**, event source: **Time-driven → Day timer → 8am–9am**.
3. Set **Project Settings → Time zone → Europe/Istanbul** so "morning" and the weekday are
   evaluated in local time.

Helpers: **`logReminderPlan`** logs how many debtors fall on each weekday (run it to confirm
the split is balanced and under the limit). **`sendAllRemindersNow`** mails every unpaid
person in one run — a manual backup; mind the ~100/day limit. Only rows where `Ödendi` is
FALSE count as debt.

> Note: for a much higher send limit you'd need Google Workspace (~1,500/day) or the parked
> Outlook/Graph path (`MICROSOFT-EMAIL.md`). The weekday split keeps free Gmail workable up to
> roughly 450 people.

## Handover (getting it off personal accounts)

Right now everything sits on **personal accounts** and needs to move to accounts the company
controls. There are **two independent halves, on two different providers** — plan for both:

| Half | Runs on | Who should own it |
|------|---------|-------------------|
| The app (QR form, Sheet, records) | **Google** Apps Script | a dedicated **company Gmail** |
| Sending mail from Outlook (optional) | **Microsoft** Graph | the **deico Microsoft 365** tenant |

Why a Google account at all, when the company is on Microsoft? Because the app itself runs on
Google Apps Script. The company has no Google Workspace, so the cleanest owner is a **dedicated
free Gmail** created just for this (e.g. `kantin.deico@gmail.com`) — a "service account" not
tied to any one person, whose password IT keeps. If the intern leaves, the system stays.

Data (all records) is preserved throughout. The web app **URL changes, so the QR must be
reprinted.**

### Part A — Google side (the app)

1. **Create a dedicated Gmail** for the canteen (the future owner of everything Google).
2. **Move the Sheet to it.** Transfer ownership (Share → make the Gmail the owner) or, if
   that's blocked, have the Gmail do **File → Make a copy**. The bound script files
   (`Code.js` **and** `GraphMail.js`) and library references travel with it. **But Script
   Properties and triggers do NOT copy** — with "Make a copy" you re-enter the `MS_*`
   properties (you do this anyway in Part B) and recreate any trigger (step 9). With an
   ownership transfer, the same project moves, so properties and triggers stay.
3. **Re-authorize.** On the Gmail, open the Sheet → Apps Script → pick **`getData`** from the
   function dropdown → **Run** once → approve the consent screen. This only triggers Google's
   permission prompt (one run authorizes every scope the project needs); `getData` just reads
   and changes nothing. Do **not** run the reminder senders (`sendDailyReminders`,
   `sendAllRemindersNow`) for this — they actually send mail.
4. **Deploy fresh.** **Deploy → New deployment → Web app**, *Execute as* **Me**, *Who has
   access* as needed → copy the new URL.
5. **Regenerate the QR** from the new URL and reprint it.
6. **Remove the old deployment** on the personal account so nothing keeps running under it.

### Part B — Microsoft side (Outlook email, if used)

The email add-on (`GraphMail.js`) currently runs in **delegated** mode against a personal
`outlook.com`. For production, switch it to **app-only** against the deico tenant. See
`MICROSOFT-EMAIL.md` → "Mode B" for the exact steps. In short:

7. In the **deico M365 tenant**, register an app and have an admin grant **`Mail.Send`** once
   (this is the only step that needs IT/the manager). No credit card — the deico tenant already
   exists, so unlike the personal setup, no Azure sign-up is involved.
8. In the Apps Script project (now owned by the dedicated Gmail), set the Script Properties to
   `MS_MODE=appOnly` with the deico tenant/client/secret, `MS_SENDER` = the deico mailbox to
   send from, and the real recipient addresses. The demo-only pieces (the OAuth2 library, the
   Entra redirect URI, and `authorizeGraph`) are **not used** in app-only mode — you can leave
   or remove them.
9. Test `sendWeeklyEmailsGraph`, then add the weekly time-driven trigger (triggers are
   per-user and do not transfer — recreate it on the Gmail).

> How the two halves connect: the Apps Script on the **Gmail** runs the code; its Script
> Properties point at the **deico** Microsoft app, so mail is sent from the deico mailbox. Your
> personal Google and Microsoft accounts drop out of the picture entirely.

> Note: the "last selected person" memory lives in each phone's browser (`localStorage`), so it
> may reset once the URL changes — harmless, everyone just picks their name once more.

## Extending later

The same structure can be copied for other areas: changing the `Ürünler` tab is enough for
most scenarios. If a different flow is needed, make small additions to the form and `Code.js`.
