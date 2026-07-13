/**
 * Company canteen / debt tracking - Google Apps Script backend.
 *
 * Sheet tabs (names kept Turkish because the manager reads them):
 *   Calisanlar : Ad Soyad | Eposta                         (employees)
 *   Urunler    : Urun | Fiyat                               (products)
 *   Kayitlar   : Zaman | Ad Soyad | Eposta | Urun | Adet | Birim Fiyat | Tutar | Odendi  (records)
 *
 * First-time setup: run "Kurulum > Sayfaları oluştur ve örnek veri ekle" from the
 * spreadsheet menu (or run setup() once from the editor).
 *
 * Note: only identifiers/comments are English. Strings the employee sees on the site,
 * the debt email, sheet tab/header names and the admin menu are intentionally Turkish.
 */

var SHEET_EMPLOYEES = 'Calisanlar';
var SHEET_PRODUCTS = 'Urunler';
var SHEET_RECORDS = 'Kayitlar';

var HEADERS_EMPLOYEES = ['Ad Soyad', 'Eposta'];
var HEADERS_PRODUCTS = ['Urun', 'Fiyat'];
var HEADERS_RECORDS = ['Zaman', 'Ad Soyad', 'Eposta', 'Urun', 'Adet', 'Birim Fiyat', 'Tutar', 'Odendi'];

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

  var sheet = getSheet(SHEET_RECORDS);
  var now = new Date();
  var total = 0;
  var rows = items.map(function (it) {
    var quantity = Number(it.quantity);
    var unitPrice = Number(prices[it.product]) || 0;
    var amount = quantity * unitPrice;
    total += amount;
    return [now, order.name, order.email || '', it.product, quantity, unitPrice, amount, false];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS_RECORDS.length)
    .setValues(rows);

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

    var itemRows = g.items.map(function (it) {
      return '<tr><td>' + it.product + '</td><td align="center">' + it.quantity +
        '</td><td align="right">' + formatMoney(it.amount) + '</td></tr>';
    }).join('');

    var html =
      '<p>Merhaba ' + g.name + ',</p>' +
      '<p>Aşağıdaki ürünler için toplam borcunuz: <b>' + formatMoney(g.total) + '</b></p>' +
      '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
      '<tr><th>Ürün</th><th>Adet</th><th>Tutar</th></tr>' + itemRows + '</table>' +
      '<p>İyi çalışmalar.</p>';

    MailApp.sendEmail({
      to: email,
      subject: 'Kantin borcunuz: ' + formatMoney(g.total),
      htmlBody: html
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

// Sample (placeholder) employee list - replace via the Calisanlar sheet once the real list arrives.
var SAMPLE_EMPLOYEES = [
  ['Ayşe Yılmaz', 'ayse.yilmaz@example.com'],
  ['Mehmet Demir', 'mehmet.demir@example.com'],
  ['Elif Kaya', 'elif.kaya@example.com'],
  ['Burak Şahin', 'burak.sahin@example.com'],
  ['Zeynep Çelik', 'zeynep.celik@example.com']
];

// Sample product + price list (TL) - edit via the Urunler sheet.
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

/** Available if you want to use <?!= include('...') ?> inside Index.html. */
function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
