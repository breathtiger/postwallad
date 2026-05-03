// ════════════════════════════════════════════════════════════════
// PostWallAd — Google Apps Script 後端 API
// 虎之呼吸科技有限公司
//
// ⚠️ 本檔為本地參考副本，實際執行於 Google Apps Script 雲端編輯器。
//    修改後需複製貼至 Apps Script 並重新部署（建立新版本）才會生效。
//
// 部署設定：
//   - 執行身分：我（擁有者）
//   - 存取對象：所有人（匿名，不需登入）
//
// Google Sheets Spreadsheet ID：
//   請勿寫入此檔，改用 Apps Script「指令碼屬性」或直接在 getSheet() 內填入。
// ════════════════════════════════════════════════════════════════

// ── 設定區 ──────────────────────────────────────────────────────
// Spreadsheet ID（敏感資訊，請勿 commit 實際值；此處用佔位符）
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';

// ── 主入口 ──────────────────────────────────────────────────────
function doGet(e) {
  const action   = e.parameter.action   || '';
  const callback = e.parameter.callback || 'callback';

  switch (action) {
    case 'carousel':
      return jsonpResponse(callback, getSheetData('Carousel-titile'));
    case 'locations':
      return jsonpResponse(callback, getSheetData('locations'));
    case 'spaces':
      return jsonpResponse(callback, getSheetData('ad_spaces'));
    case 'bookings':
      return jsonpResponse(callback, getSheetData('bookings'));
    case 'seo':
      return jsonpResponse(callback, getSheetData('SEO'));
    case 'submitBooking':
      return submitBookingHandler(e, callback);
    default:
      return jsonpResponse(callback, { error: 'unknown action: ' + action });
  }
}

// ── 工具：讀取工作表 → JSON 陣列 ────────────────────────────────
function getSheetData(sheetName) {
  try {
    const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet  = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];

    const headers = values[0];
    return values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
  } catch (err) {
    return { error: err.message };
  }
}

// ── 訂單送出：寫入 customers + bookings ──────────────────────────
function submitBookingHandler(e, callback) {
  try {
    const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    const bookingId = generateBookingId();
    const ts        = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
    const items     = JSON.parse(e.parameter.items || '[]');

    // customers 表（一筆訂單一行）
    const custSheet = ss.getSheetByName('customers');
    custSheet.appendRow([
      bookingId,
      e.parameter.companyName || '',
      e.parameter.taxId       || '',
      e.parameter.contactName || '',
      e.parameter.phone       || '',
      e.parameter.email       || '',
      e.parameter.address     || '',
      parseFloat(e.parameter.totalAmount) || 0,
      ts
    ]);

    // bookings 表（每個版位一行）
    const bookSheet = ss.getSheetByName('bookings');
    items.forEach(function(item) {
      bookSheet.appendRow([
        bookingId,
        item.space_id || '',
        item.months   || 1,
        item.price    || 0
      ]);
    });

    return jsonpResponse(callback, { success: true, bookingId: bookingId });
  } catch (err) {
    return jsonpResponse(callback, { success: false, error: err.message });
  }
}

function generateBookingId() {
  const date = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return 'BK-' + date + '-' + rand;
}

// ── 工具：包裝 JSONP 回應 ────────────────────────────────────────
function jsonpResponse(callback, data) {
  const json    = JSON.stringify(data);
  const content = callback + '(' + json + ')';
  return ContentService
    .createTextOutput(content)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
