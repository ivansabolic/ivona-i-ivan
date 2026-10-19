/**
 * RSVP backend for the wedding site — Google Apps Script "Web App".
 *
 * Deploy (once, from the spreadsheet):  Extensions → Apps Script → paste this file →
 *   Project Settings → Script properties → add RSVP_TOKEN (any long random string)
 *   and optionally NOTIFY_EMAIL (comma-separated addresses to notify on each RSVP).
 *   Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 *   Copy the Web app URL into script.js (RSVP_ENDPOINT) together with the same token (RSVP_TOKEN).
 *
 * Every submission appends one row to the sheet "Odgovori" (created on first use).
 */

const SHEET_NAME = 'Odgovori';
const HEADER = ['Vrijeme', 'Ime i prezime', 'Dolazak', 'Broj osoba', 'Pratnja', 'Posebna prehrana', 'Poruka', 'Izvor'];
const MAX_LEN = { ime: 120, prehrana: 300, poruka: 1500, pratnja: 8 };

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('RSVP_TOKEN') || '';
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (token && data.token !== token) return respond({ ok: false, error: 'unauthorized' }, 401);
    if (data.website) return respond({ ok: true, spam: true });            // honeypot filled → silently ignore

    const ime = clean(data.ime, MAX_LEN.ime);
    const dolazak = data.dolazak === 'da' ? 'Da' : data.dolazak === 'ne' ? 'Ne' : '';
    if (!ime || !dolazak) return respond({ ok: false, error: 'missing fields' }, 400);

    const pratnja = Array.isArray(data.pratnja)
      ? data.pratnja.map((p) => clean(p, MAX_LEN.ime)).filter(Boolean).slice(0, MAX_LEN.pratnja)
      : [];
    const osobe = dolazak === 'Da' ? 1 + pratnja.length : 0;
    const row = [
      new Date(),
      ime,
      dolazak,
      osobe,
      pratnja.join(', '),
      clean(data.prehrana, MAX_LEN.prehrana),
      clean(data.poruka, MAX_LEN.poruka),
      clean(data.izvor, 60),
    ];

    // Serialise writes so two simultaneous guests cannot clobber each other's row.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getSheet();
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    notify(props.getProperty('NOTIFY_EMAIL'), row);
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err && err.message || err) }, 500);
  }
}

// A plain GET is handy as a health check when setting things up.
function doGet() {
  return respond({ ok: true, service: 'rsvp' });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
    sheet.getRange(1, 1, 1, HEADER.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd.mm.yyyy. HH:mm');
  }
  return sheet;
}

function notify(to, row) {
  if (!to) return;
  var when = row[0], ime = row[1], dolazak = row[2], osobe = row[3], pratnja = row[4], prehrana = row[5], poruka = row[6];
  var subject = 'RSVP: ' + ime + ' – ' + dolazak + (dolazak === 'Da' ? ' (' + osobe + ')' : '');
  var lines = ['Ime: ' + ime, 'Dolazak: ' + dolazak, 'Broj osoba: ' + osobe];
  if (pratnja) lines.push('Pratnja: ' + pratnja);
  if (prehrana) lines.push('Prehrana: ' + prehrana);
  if (poruka) lines.push('Poruka: ' + poruka);
  lines.push('', 'Vrijeme: ' + when);
  var body = lines.join('\n');
  try { MailApp.sendEmail(to, subject, body); } catch (e) { /* notification is best-effort */ }
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function respond(obj, status) {
  // Apps Script web apps cannot set HTTP status codes; the body carries ok/error instead.
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
