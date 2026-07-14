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

## Weekly email (currently off)

It gets turned on once the email account is settled. The function (`sendWeeklyEmails`) is
ready. To enable it:

1. Apps Script editor → left menu **Triggers** (⏰ clock icon) → **Add trigger**.
2. Function: **`sendWeeklyEmails`**, event source: **Time-driven** →
   **Week timer** → pick day/time → Save.

> Note: the email is sent from the Google account that runs the script. If the company email
> is on Google Workspace, no extra setup is needed. If not, a separate solution (SMTP, etc.)
> is required. Free Gmail has a low daily send limit (~100); Workspace is higher.

## Handover (moving to the company account)

The Sheet and its bound script travel together. Data (all records) is preserved; only the
web app **URL changes, so the QR must be reprinted**. Steps:

1. **Get the Sheet onto the company account.** Either transfer ownership (Share → make the
   company account owner) or, if that's blocked (common between a personal Gmail and a
   Workspace account), have the company account do **File → Make a copy** — the bound script
   is copied too.
2. **Re-authorize.** On the company account, open the Sheet → Apps Script → pick **`getData`**
   from the function dropdown → click **Run** once → approve the permission prompt. The point
   is only to trigger Google's consent screen (it lists every scope the whole project needs, so
   one run authorizes all of them); `getData` just reads the lists and changes nothing. Do
   **not** run `sendWeeklyEmails` for this — it actually sends the debt emails. Afterwards the
   script runs *as* the company account (records and emails use that identity).
3. **Deploy fresh.** Company account: **Deploy → New deployment → Web app**, *Execute as*
   **Me**, *Who has access* as needed → copy the new URL.
4. **Regenerate the QR** from the new URL and reprint it.
5. **Recreate the weekly-email trigger** on the company account if it's enabled (triggers are
   per-user and do not transfer — see above).
6. **Remove the old deployment** on the personal account so nothing keeps running under it.

> Note: the "last selected person" memory lives in each phone's browser (`localStorage`), so
> it may reset once the URL changes — harmless, everyone just picks their name once more.

## Extending later

The same structure can be copied for other areas: changing the `Ürünler` tab is enough for
most scenarios. If a different flow is needed, make small additions to the form and `Code.js`.
