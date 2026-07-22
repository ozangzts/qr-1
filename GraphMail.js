/* ============================================================================
 * ⚠️ KULLANILMIYOR / NOT IN USE — parked.
 * Aktif sistem e-postaları GMAIL üzerinden (Code.js) gönderir. Bu dosyadaki
 * Outlook/Microsoft Graph fonksiyonları şu an KULLANILMIYOR (Entra erişimi
 * verilmediği için beklemede). Silinmedi; ileride Outlook yoluna geçilmek
 * istenirse diye duruyor. Buradaki fonksiyonları normal işleyişte ÇALIŞTIRMAYIN.
 * ============================================================================ */

/**
 * GraphMail.js — sends the canteen debt email from an Outlook / Microsoft account
 * via the Microsoft Graph API, instead of Gmail (MailApp).
 *
 * This is an ADD-ON to the existing canteen app. It does not touch the QR form,
 * the Sheet, or saveOrder. It reuses getSheet(), SHEET_RECORDS and formatMoney()
 * from Code.js (same Apps Script project — paste this as a second .gs file).
 *
 * Two auth modes, selected by the MS_MODE Script Property:
 *
 *   'delegated' (free demo, personal outlook.com) — the script sends AS you, the
 *       signed-in user (/me/sendMail). One interactive consent, then a refresh
 *       token keeps it going. Needs the OAuth2 Apps Script library (see setup).
 *
 *   'appOnly' (production, a Microsoft 365 tenant, e.g. deico) — an Entra app
 *       registration granted application permission Mail.Send (admin consent once)
 *       sends unattended as MS_SENDER (/users/{sender}/sendMail). No library.
 *
 * Config lives in Script Properties (Project Settings > Script Properties). See
 * MICROSOFT-EMAIL.md for the full setup of each mode.
 *
 * Shared:    MS_MODE ('delegated' | 'appOnly'), MANAGER_EMAIL, MS_CLIENT_ID, MS_CLIENT_SECRET
 * appOnly +: MS_TENANT_ID, MS_SENDER
 */

// OAuth2 Apps Script library (delegated mode only). Add via
// Libraries > Add > script ID below > identifier "OAuth2".
// 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF

/* ----------------------------------------------------------------------------
 * Config
 * -------------------------------------------------------------------------- */

function graphProps_() {
  return PropertiesService.getScriptProperties();
}

function graphMode_() {
  return graphProps_().getProperty('MS_MODE') || 'delegated';
}

/** Reads and validates the properties needed for the active mode. */
function graphConfig_() {
  var p = graphProps_();
  var mode = graphMode_();
  var required = ['MANAGER_EMAIL', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'];
  if (mode === 'appOnly') required = required.concat(['MS_TENANT_ID', 'MS_SENDER']);

  var cfg = { mode: mode };
  required.forEach(function (key) {
    var val = p.getProperty(key);
    if (!val) {
      throw new Error('Missing Script Property "' + key + '" for MS_MODE=' + mode +
        '. Set it under Project Settings > Script Properties (see MICROSOFT-EMAIL.md).');
    }
    cfg[key] = val;
  });
  return cfg;
}

/* ----------------------------------------------------------------------------
 * Sending — dispatches to the active mode
 * -------------------------------------------------------------------------- */

function sendMail_(to, subject, htmlBody) {
  if (graphMode_() === 'appOnly') {
    sendMailAppOnly_(to, subject, htmlBody);
  } else {
    sendMailDelegated_(to, subject, htmlBody);
  }
}

function graphMessagePayload_(to, subject, htmlBody) {
  return {
    message: {
      subject: subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }]
    },
    saveToSentItems: true
  };
}

/* ------- appOnly (client credentials) ------- */

function getGraphTokenAppOnly_() {
  var c = graphConfig_();
  var url = 'https://login.microsoftonline.com/' + encodeURIComponent(c.MS_TENANT_ID) +
    '/oauth2/v2.0/token';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: {
      client_id: c.MS_CLIENT_ID,
      client_secret: c.MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    },
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200 || !body.access_token) {
    throw new Error('Could not get Graph token (' + res.getResponseCode() + '): ' +
      res.getContentText());
  }
  return body.access_token;
}

function sendMailAppOnly_(to, subject, htmlBody) {
  var c = graphConfig_();
  var token = getGraphTokenAppOnly_();
  var url = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(c.MS_SENDER) +
    '/sendMail';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(graphMessagePayload_(to, subject, htmlBody)),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Graph sendMail failed (' + res.getResponseCode() + '): ' +
      res.getContentText());
  }
}

/* ------- delegated (OAuth2 library, sends as /me) ------- */

function getGraphService_() {
  var c = graphConfig_();
  return OAuth2.createService('graphDelegated')
    .setAuthorizationBaseUrl('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    .setTokenUrl('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    .setClientId(c.MS_CLIENT_ID)
    .setClientSecret(c.MS_CLIENT_SECRET)
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('offline_access Mail.Send User.Read');
}

/**
 * Logs the exact redirect URI this project sends to Microsoft. Register this
 * value verbatim under the app's Authentication > Web redirect URIs.
 */
function showRedirectUri() {
  Logger.log(getGraphService_().getRedirectUri());
}

/** Run once from the editor, then open the logged URL to grant consent. */
function authorizeGraph() {
  var service = getGraphService_();
  if (service.hasAccess()) {
    Logger.log('Already authorized. Nothing to do.');
  } else {
    Logger.log('Open this URL in a browser to authorize, then re-run your test:\n\n' +
      service.getAuthorizationUrl());
  }
}

/** OAuth2 redirect handler — do not call directly. */
function authCallback(request) {
  var ok = getGraphService_().handleCallback(request);
  return HtmlService.createHtmlOutput(ok
    ? 'Yetkilendirme başarılı. Bu sekmeyi kapatabilirsiniz.'
    : 'Yetkilendirme başarısız oldu.');
}

/** Clears the stored delegated authorization (to re-consent or switch account). */
function resetGraphAuth() {
  getGraphService_().reset();
}

function sendMailDelegated_(to, subject, htmlBody) {
  var service = getGraphService_();
  if (!service.hasAccess()) {
    throw new Error('Not authorized yet. Run authorizeGraph() and open the logged URL first.');
  }
  var res = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + service.getAccessToken() },
    payload: JSON.stringify(graphMessagePayload_(to, subject, htmlBody)),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Graph sendMail failed (' + res.getResponseCode() + '): ' +
      res.getContentText());
  }
}

/* ----------------------------------------------------------------------------
 * Public entry points
 * -------------------------------------------------------------------------- */

/**
 * Smoke test: sends a fixed message to MANAGER_EMAIL so you can confirm auth and
 * config are wired. Run once from the editor after setup.
 */
function testGraphMail() {
  var c = graphConfig_();
  sendMail_(
    c.MANAGER_EMAIL,
    'Kantin sistemi - deneme (Outlook/Graph)',
    '<p>Merhaba,</p>' +
    '<p>Bu, Microsoft Graph üzerinden Outlook hesabından gönderilen bir deneme mailidir. ' +
    'Sistem çalışıyor.</p>' +
    '<p>İyi çalışmalar.</p>'
  );
}

/**
 * Emails the manager ONE summary of everyone's unpaid canteen debt, sent from the
 * Outlook mailbox. This is the Outlook/Graph counterpart of sendWeeklyEmails()
 * (which mails each employee their own debt from Gmail). Attach to a time-driven
 * trigger for a weekly summary.
 */
function sendManagerDebtSummary() {
  var summary = buildDebtSummary_();
  if (!summary) return; // nothing owed
  var c = graphConfig_();
  sendMail_(c.MANAGER_EMAIL, summary.subject, summary.html);
}

/**
 * Emails EACH employee who has unpaid debt their own itemized bill, sent from the
 * Outlook mailbox via Graph. This is the Outlook counterpart of sendWeeklyEmails()
 * in Code.js (which sends the same thing from Gmail). Attach to a weekly
 * time-driven trigger. Recipient is each row's E-posta value.
 */
function sendWeeklyEmailsGraph() {
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

    sendMail_(email, 'Kantin borcunuz: ' + formatMoney(g.total), html);
  });
}

/** Builds { subject, html } from unpaid rows, or null if nobody owes anything. */
function buildDebtSummary_() {
  var sheet = getSheet(SHEET_RECORDS);
  var rows = sheet.getDataRange().getValues();

  // Group unpaid rows by person (email if present, else name).
  var groups = {}; // key -> { name, total }
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var paid = row[7] === true || String(row[7]).toUpperCase() === 'TRUE';
    if (paid) continue;

    var name = String(row[1]).trim();
    if (!name) continue;
    var email = String(row[2]).trim();
    var key = email || name;

    if (!groups[key]) groups[key] = { name: name, total: 0 };
    groups[key].total += Number(row[6]) || 0;
  }

  var keys = Object.keys(groups).filter(function (k) { return groups[k].total > 0; });
  if (keys.length === 0) return null;
  keys.sort(function (a, b) { return groups[b].total - groups[a].total; });

  var grand = 0;
  var itemRows = keys.map(function (k) {
    grand += groups[k].total;
    return '<tr><td>' + groups[k].name + '</td><td align="right">' +
      formatMoney(groups[k].total) + '</td></tr>';
  }).join('');

  var html =
    '<p>Merhaba,</p>' +
    '<p>Kantin ödenmemiş borç özeti:</p>' +
    '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
    '<tr><th align="left">Ad Soyad</th><th>Toplam Borç</th></tr>' + itemRows +
    '<tr><td align="right"><b>Genel Toplam</b></td><td align="right"><b>' +
    formatMoney(grand) + '</b></td></tr>' +
    '</table>' +
    '<p>İyi çalışmalar.</p>';

  return { subject: 'Kantin borç özeti: ' + formatMoney(grand), html: html };
}
