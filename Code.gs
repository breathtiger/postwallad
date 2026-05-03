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
// Script Properties（在 Apps Script 專案設定中填入，勿 commit 實際值）：
//   SPREADSHEET_ID     — 主資料庫 Google Sheets ID
//   QUOTE_TEMPLATE_ID  — 報價單範本 Sheets 檔案 ID
//   QUOTE_FOLDER_ID    — 產生的 PDF 存放 Drive 資料夾 ID
// ════════════════════════════════════════════════════════════════

// ── 設定區 ──────────────────────────────────────────────────────
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

// ── 訂單送出：寫入 customers + bookings → 生成報價單 PDF → 寄信 ──
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

    // 生成報價單 PDF（失敗不影響主流程）
    let pdfUrl = '';
    try {
      const customer = {
        companyName:  e.parameter.companyName  || '',
        taxId:        e.parameter.taxId        || '',
        contactName:  e.parameter.contactName  || '',
        phone:        e.parameter.phone        || '',
        email:        e.parameter.email        || '',
        address:      e.parameter.address      || ''
      };
      const quoteResult = generateQuotePdf(bookingId, customer, items);
      pdfUrl = quoteResult.pdfUrl;
      try {
        sendQuoteEmail(e.parameter.email, customer.companyName, bookingId, quoteResult.pdfBlob);
      } catch (_) { /* 寄信失敗不中斷 */ }
    } catch (_) { /* PDF 失敗不中斷，bookingId 仍回傳 */ }

    return jsonpResponse(callback, { success: true, bookingId: bookingId, pdfUrl: pdfUrl });
  } catch (err) {
    return jsonpResponse(callback, { success: false, error: err.message });
  }
}

// ── 報價單 PDF：複製範本分頁 → 填資料 → 匯出 → 存 Drive ─────────
function generateQuotePdf(bookingId, customer, items) {
  const props          = PropertiesService.getScriptProperties();
  const templateFileId = props.getProperty('QUOTE_TEMPLATE_ID');
  const saveFolderId   = props.getProperty('QUOTE_FOLDER_ID');
  if (!templateFileId) throw new Error('QUOTE_TEMPLATE_ID 未設定');

  const ss            = SpreadsheetApp.openById(templateFileId);
  const templateSheet = ss.getSheetByName('報價單範本');
  if (!templateSheet) throw new Error('找不到「報價單範本」分頁');

  // 複製分頁，以 booking_id 命名
  const newSheet = templateSheet.copyTo(ss);
  newSheet.setName(bookingId);

  // ── 填入甲方資訊 ──────────────────────────────────────────────
  newSheet.getRange('B3').setValue(customer.companyName);
  newSheet.getRange('B4').setValue(customer.taxId);
  newSheet.getRange('B5').setValue(customer.contactName);
  newSheet.getRange('B6').setValue(customer.phone);
  newSheet.getRange('B7').setValue(customer.email);
  newSheet.getRange('B8').setValue(customer.address);

  // ── 動態調整版位列數 ──────────────────────────────────────────
  const FIRST_ROW  = 10;  // 版位資料起始列
  const TMPL_ROWS  = 3;   // 範本原有列數（第 10–12 列）
  const COL_REPORT = 7;   // G 欄：報價金額  ⚠️ 若版面錯位請改為 6（F 欄）
  const N          = items.length;

  if (N > TMPL_ROWS) {
    // 在最後一個範本列後插入不足的列，複製格式
    const lastTmplRow = FIRST_ROW + TMPL_ROWS - 1;
    newSheet.insertRowsAfter(lastTmplRow, N - TMPL_ROWS);
    const fmtSrc = newSheet.getRange(lastTmplRow, 1, 1, 7);
    for (let i = TMPL_ROWS; i < N; i++) {
      fmtSrc.copyTo(
        newSheet.getRange(FIRST_ROW + i, 1, 1, 7),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
    }
  } else if (N < TMPL_ROWS) {
    newSheet.deleteRows(FIRST_ROW + N, TMPL_ROWS - N);
  }

  // ── 填入版位資料 ──────────────────────────────────────────────
  items.forEach(function(item, i) {
    const r = FIRST_ROW + i;
    newSheet.getRange(r, 1).setValue(i + 1);                                              // A: 項次
    newSheet.getRange(r, 2).setValue(item.locationName || '');                             // B: 局所
    newSheet.getRange(r, 3).setValue(item.space_id    || '');                             // C: 版位編號
    newSheet.getRange(r, 4).setValue((item.w || '-') + ' × ' + (item.h || '-') + ' cm'); // D: 尺寸
    newSheet.getRange(r, 5).setValue(item.months      || 1);                              // E: 刊登月份
    newSheet.getRange(r, COL_REPORT).setValue(item.price || 0);                           // G: 報價
  });

  // ── 金額 / 稅額 / 總價 ────────────────────────────────────────
  const amountRow = FIRST_ROW + N;
  const totalAmt  = items.reduce(function(s, it) { return s + (Number(it.price) || 0); }, 0);
  const tax       = Math.round(totalAmt * 0.05);
  newSheet.getRange(amountRow,     COL_REPORT).setValue(totalAmt);
  newSheet.getRange(amountRow + 1, COL_REPORT).setValue(tax);
  newSheet.getRange(amountRow + 2, COL_REPORT).setValue(totalAmt + tax);

  // ── 日期（民國年，動態搜尋儲存格）────────────────────────────
  const now     = new Date();
  const rocYear = now.getFullYear() - 1911;
  const mm      = ('0' + (now.getMonth() + 1)).slice(-2);
  const dd      = ('0' + now.getDate()).slice(-2);
  const dateStr = '日期：中華民國　' + rocYear + ' 年 ' + mm + ' 月 ' + dd + ' 日';
  const allData = newSheet.getDataRange().getValues();
  outer: for (let r = amountRow + 2; r < allData.length; r++) {
    for (let c = 0; c < allData[r].length; c++) {
      const val = String(allData[r][c] || '');
      if (val.includes('日期') || val.includes('中華民國')) {
        newSheet.getRange(r + 1, c + 1).setValue(dateStr);
        break outer;
      }
    }
  }

  // ── 匯出單一分頁為 PDF ────────────────────────────────────────
  SpreadsheetApp.flush();
  const gid   = newSheet.getSheetId();
  const token = ScriptApp.getOAuthToken();
  const exportUrl = 'https://docs.google.com/spreadsheets/d/' + templateFileId +
    '/export?format=pdf&gid=' + gid +
    '&size=A4&portrait=true&fitw=true&gridlines=false' +
    '&printtitle=false&sheetnames=false&fzr=false' +
    '&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5';
  const pdfBlob = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + token }
  }).getBlob().setName('報價單-' + bookingId + '.pdf');

  // ── 存入 Google Drive，設公開連結 ─────────────────────────────
  let pdfUrl = '';
  if (saveFolderId) {
    const folder = DriveApp.getFolderById(saveFolderId);
    const file   = folder.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();
  }

  return { pdfBlob: pdfBlob, pdfUrl: pdfUrl };
}

// ── 寄信：PDF 附件 ＋ CC 公司信箱 ────────────────────────────────
function sendQuoteEmail(toEmail, companyName, bookingId, pdfBlob) {
  MailApp.sendEmail({
    to:          toEmail,
    cc:          'service@breathtiger.com',
    subject:     '【虎之呼吸科技】郵局牆面廣告報價單　' + bookingId,
    body:        (companyName || '您') + ' 您好，\n\n' +
                 '感謝您的詢價！附件為郵局牆面廣告報價單，敬請確認。\n\n' +
                 '如有任何問題，歡迎透過以下方式與我們聯繫：\n' +
                 'Email：service@breathtiger.com\n' +
                 'LINE：https://lin.ee/Rtr3Tlq4\n\n' +
                 '虎之呼吸科技有限公司 敬上',
    attachments: [pdfBlob]
  });
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
