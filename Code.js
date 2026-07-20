/**
 * Company canteen / debt tracking - Google Apps Script backend.
 *
 * Sheet tabs (names kept Turkish because the manager reads them):
 *   Çalışanlar : Ad Soyad | E-posta                         (employees)
 *   Ürünler    : Ürün | Fiyat                                (products)
 *   Kayıtlar   : Zaman | Ad Soyad | E-posta | Ürün | Adet | Birim Fiyat | Tutar | Ödendi  (records)
 *
 * First-time setup: run "Kurulum > Sayfaları oluştur ve örnek veri ekle" from the
 * spreadsheet menu (or run setup() once from the editor).
 *
 * Note: only identifiers/comments are English. Strings the employee sees on the site,
 * the debt email, sheet tab/header names and the admin menu are intentionally Turkish.
 */

var SHEET_EMPLOYEES = 'Çalışanlar';
var SHEET_PRODUCTS = 'Ürünler';
var SHEET_RECORDS = 'Kayıtlar';

var HEADERS_EMPLOYEES = ['Ad Soyad', 'E-posta'];
var HEADERS_PRODUCTS = ['Ürün', 'Fiyat'];
var HEADERS_RECORDS = ['Zaman', 'Ad Soyad', 'E-posta', 'Ürün', 'Adet', 'Birim Fiyat', 'Tutar', 'Ödendi'];

/* ----------------------------------------------------------------------------
 * Web app
 * -------------------------------------------------------------------------- */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Kantin Kayıt')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Returns the employee and product lists the form needs, together. */
function getData() {
  return {
    employees: getEmployees(),
    products: getProducts()
  };
}

function getEmployees() {
  var sheet = getSheet(SHEET_EMPLOYEES);
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var name = String(rows[i][0]).trim();
    if (!name) continue;
    list.push({ name: name, email: String(rows[i][1]).trim() });
  }
  list.sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); });
  return list;
}

function getProducts() {
  var sheet = getSheet(SHEET_PRODUCTS);
  var rows = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var name = String(rows[i][0]).trim();
    if (!name) continue;
    list.push({ name: name, price: Number(rows[i][1]) || 0 });
  }
  return list;
}

/**
 * Writes an order submitted from the form into the records sheet.
 * order = { name, email, items: [{ product, quantity }] }
 * One row per product (keeps filtering in the spreadsheet easy).
 * Thrown error messages are Turkish because they surface to the employee on the site.
 */
function saveOrder(order) {
  if (!order || !order.name) {
    throw new Error('Lütfen isminizi seçin.');
  }
  var items = (order.items || []).filter(function (it) {
    return it && it.product && Number(it.quantity) > 0;
  });
  if (items.length === 0) {
    throw new Error('Lütfen en az bir ürün seçin.');
  }

  var prices = {};
  getProducts().forEach(function (p) { prices[p.name] = p.price; });

  var now = new Date();
  var total = 0;
  var rows = items.map(function (it) {
    var quantity = Number(it.quantity);
    var unitPrice = Number(prices[it.product]) || 0;
    var amount = quantity * unitPrice;
    total += amount;
    return [now, order.name, order.email || '', it.product, quantity, unitPrice, amount, false];
  });

  // Serialize the append: two simultaneous submissions could otherwise read the
  // same getLastRow() and write to the same start row, overwriting each other.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Sistem şu an meşgul, lütfen birkaç saniye sonra tekrar deneyin.');
  }
  try {
    var sheet = getSheet(SHEET_RECORDS);
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, HEADERS_RECORDS.length).setValues(rows);
    // Render the "Odendi" (paid) flag as a checkbox on just these new rows, so the
    // column stays tidy (no stray checkboxes/values on empty rows below the data).
    sheet.getRange(startRow, 8, rows.length, 1).insertCheckboxes();
  } finally {
    lock.releaseLock();
  }

  return { ok: true, total: total };
}

/* ----------------------------------------------------------------------------
 * Weekly email (currently OFF - a trigger is added once Workspace is confirmed)
 *
 * To enable:
 *   1) Apps Script > Triggers (clock icon) > Add trigger
 *   2) Function: sendWeeklyEmails, Event source: Time-driven > Week timer
 * Only rows where "Odendi" (paid) is FALSE count as debt.
 * The email body is Turkish on purpose - the employee reads it.
 * -------------------------------------------------------------------------- */

function sendWeeklyEmails() {
  var sheet = getSheet(SHEET_RECORDS);
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return;

  // Group unpaid rows by email.
  var groups = {}; // email -> { name, items: [], total }
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var paid = row[7] === true || String(row[7]).toUpperCase() === 'TRUE';
    if (paid) continue;

    var email = String(row[2]).trim();
    if (!email) continue;

    if (!groups[email]) {
      groups[email] = { name: String(row[1]).trim(), items: [], total: 0 };
    }
    var g = groups[email];
    g.items.push({ product: row[3], quantity: Number(row[4]), amount: Number(row[6]) });
    g.total += Number(row[6]) || 0;
  }

  Object.keys(groups).forEach(function (email) {
    var g = groups[email];
    if (g.total <= 0) return;

    MailApp.sendEmail({
      to: email,
      subject: '🥪 Minik bir kantin hatırlatması 😊',
      htmlBody: debtEmailHtml_(g.name, g.items, g.total)
    });
  });
}

/* ----------------------------------------------------------------------------
 * Setup and helpers
 * -------------------------------------------------------------------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Kurulum')
    .addItem('Sayfaları oluştur ve örnek veri ekle', 'setup')
    .addToUi();
}

/** Creates the sheets (if missing) and seeds sample employee/product data. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var employees = createSheet(SHEET_EMPLOYEES, HEADERS_EMPLOYEES);
  if (employees.getLastRow() < 2) {
    employees.getRange(2, 1, SAMPLE_EMPLOYEES.length, 2).setValues(SAMPLE_EMPLOYEES);
  }

  var products = createSheet(SHEET_PRODUCTS, HEADERS_PRODUCTS);
  if (products.getLastRow() < 2) {
    products.getRange(2, 1, SAMPLE_PRODUCTS.length, 2).setValues(SAMPLE_PRODUCTS);
  }

  createSheet(SHEET_RECORDS, HEADERS_RECORDS);

  // Remove the default empty sheet if present.
  var blank = ss.getSheetByName('Sayfa1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  SpreadsheetApp.getUi().alert('Kurulum tamam. Sayfalar hazır, örnek veriler eklendi.');
}

// Sample (placeholder) employee list - replace via the Çalışanlar sheet once the real list arrives.
var SAMPLE_EMPLOYEES = [
  ['Ayşe Yılmaz', 'ayse.yilmaz@example.com'],
  ['Mehmet Demir', 'mehmet.demir@example.com'],
  ['Elif Kaya', 'elif.kaya@example.com'],
  ['Burak Şahin', 'burak.sahin@example.com'],
  ['Zeynep Çelik', 'zeynep.celik@example.com']
];

// Sample product + price list (TL) - edit via the Ürünler sheet.
var SAMPLE_PRODUCTS = [
  ['Tost', 45],
  ['Sandviç', 40],
  ['Çay', 10],
  ['Kahve', 25],
  ['Su', 10],
  ['Ayran', 15],
  ['Kola', 25]
];

function getSheet(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('"' + name + '" sayfası yok. Önce Kurulum menüsünü çalıştırın.');
  }
  return sheet;
}

function createSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function formatMoney(value) {
  return (Number(value) || 0).toFixed(2) + ' ₺';
}

/** Escapes text before it is placed into HTML (names/products from the sheet). */
function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Builds the HTML body of a debt email, styled to match DEICO's email template
 * (dark-blue header/footer, light-blue info box with an orange accent, table).
 * Email-safe: all styles inline, table-based layout, year rendered server-side.
 * items = [{ product, quantity, amount }], total = number.
 */
function debtEmailHtml_(name, items, total) {
  var year = new Date().getFullYear();

  var cellBase = 'padding:8px 10px;border-bottom:1px solid #e0e0e0;';
  var thBase = 'padding:8px 10px;background-color:#e8f1fb;color:#555;font-weight:bold;' +
    'border-bottom:1px solid #e0e0e0;';

  var itemRows = items.map(function (it) {
    return '<tr>' +
      '<td style="' + cellBase + '">' + escapeHtml_(it.product) + '</td>' +
      '<td align="center" style="' + cellBase + '">' + it.quantity + '</td>' +
      '<td align="right" style="' + cellBase + '">' + formatMoney(it.amount) + '</td>' +
      '</tr>';
  }).join('');

  var totalRow =
    '<tr>' +
    '<td colspan="2" align="right" style="padding:8px 10px;font-weight:bold;' +
    'border-top:2px solid #004c7a;">Genel Toplam</td>' +
    '<td align="right" style="padding:8px 10px;font-weight:bold;color:#d32f2f;' +
    'border-top:2px solid #004c7a;">' + formatMoney(total) + '</td>' +
    '</tr>';

  return '' +
    '<div style="background-color:#f4f4f4;padding:24px 0;margin:0;' +
    'font-family:Calibri,Arial,Helvetica,sans-serif;color:#333333;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background-color:#f4f4f4;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" ' +
    'style="width:600px;max-width:600px;background-color:#ffffff;border-radius:8px;">' +

    // Header
    '<tr><td style="background-color:#004c7a;color:#ffffff;text-align:center;' +
    'padding:20px;font-size:20px;font-weight:bold;border-top-left-radius:8px;' +
    'border-top-right-radius:8px;">Kantin Borç Bildirimi</td></tr>' +

    // Body
    '<tr><td style="padding:20px;">' +
    '<div style="padding:16px 20px;background-color:#e8f1fb;border-left:5px solid #ff6f00;">' +
    'Merhaba <b>' + escapeHtml_(name) + '</b> 🥪<br><br>' +
    'Kantindeki bazı ürünlerimiz afiyetle tüketildi, ücreti ise hâlâ bizi bekliyor 😄. ' +
    'Yoğunluk içinde gözden kaçmış olabileceğini düşünerek küçük bir hatırlatma yapmak istedik. ' +
    'Uygun olduğunuzda aşağıdaki <span style="color:#d32f2f;font-weight:bold;">toplam ' +
    formatMoney(total) + '</span> tutarını ödemenizi rica ederiz 🙏.<br><br>' +
    'Şimdiden teşekkürler, afiyet olsun! 💙' +
    '</div>' +
    '<table width="100%" cellpadding="0" cellspacing="0" ' +
    'style="width:100%;border-collapse:collapse;margin-top:20px;font-size:13px;">' +
    '<tr>' +
    '<th align="left" style="' + thBase + '">Ürün</th>' +
    '<th align="center" style="' + thBase + '">Adet</th>' +
    '<th align="right" style="' + thBase + '">Tutar</th>' +
    '</tr>' + itemRows + totalRow + '</table>' +
    '</td></tr>' +

    // Footer
    '<tr><td style="background-color:#004c7a;color:#ffffff;text-align:center;' +
    'padding:12px;font-size:14px;border-bottom-left-radius:8px;' +
    'border-bottom-right-radius:8px;">© ' + year + ' DEICO Mühendislik</td></tr>' +

    '</table></td></tr></table></div>';
}

/** Available if you want to use <?!= include('...') ?> inside Index.html. */
function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
