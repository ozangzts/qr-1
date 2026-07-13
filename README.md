# Canteen Records & Debt Tracking (QR + Google Sheets)

Employees scan the QR code on paper → the web page opens → they pick their **name** and
the **products** they took, then press **Save** → the record lands in a Google Sheet.
Later, a weekly "you owe X ₺" email can be sent automatically.

No hosting, free. Everything runs on Google Sheets + Apps Script.

> Language note: the app's screen text and the debt email are Turkish (that's what people
> read); the code and these docs are English.

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
   - Delete the contents of the default `Code.js` and paste this repo's **`Code.js`**.
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

## Extending later

The same structure can be copied for other areas: changing the `Ürünler` tab is enough for
most scenarios. If a different flow is needed, make small additions to the form and `Code.js`.
