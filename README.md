# PostWallAd — 郵局牆面廣告版位出租平台

**虎之呼吸科技有限公司**  
服務區域：基隆市全區・新北市汐止區・新北市瑞芳區

---

## 網站網址

- 正式網址：https://postwallad.breathtiger.com/
- GitHub 儲存庫：https://github.com/breathtiger/postwallad

---

## 功能說明

| 頁面 | 路徑 | 功能 |
|------|------|------|
| 首頁 | `index.html` | 輪播圖、特色介紹、服務區域、三步驟 |
| 局所列表 | `locations.html` | 縣市/行政區篩選、搜尋、可用版位 badge |
| 版位詳細 | `spaces.html` | 版位卡片、即時報價、加入詢價、列印報價單 |
| 詢價送出 | `quotation.html` | 版位摘要確認、客戶資料表單、送出至 Google Sheets |

---

## 技術棧

### 公開目錄載入（2026-09-23 修正）

局所與版位頁優先讀取同源 `data/catalog.json`，不再等待 Apps Script 冷啟動。目錄僅含公開展示欄位，不包含內部成本或客戶資料。JSON 不可用時才退回既有 JSONP API。

`.github/workflows/publish.yml` 每半小時嘗試從 Sheets API 同步目錄並部署 Pages，亦可在 Actions 手動執行。GitHub 排程可能延遲；上游失敗時保留上次成功目錄，頁面顯示資料更新時間，售價與狀態仍以人工確認為準。本機可執行 `node scripts/sync-catalog.mjs` 重新同步。Pages 發布來源設定為 GitHub Actions。

詢價提交、PDF 與寄信仍依賴 Apps Script；此目錄修正不代表雲端寄信程式已更新。

- 純靜態前端：HTML / CSS / Vanilla JS
- UI：Bootstrap 5.3.3 + Font Awesome 6（cdnjs CDN）
- 後端：Google Apps Script（`Code.gs`）
- 資料庫：Google Sheets
- 跨域方案：JSONP

---

## Apps Script 部署說明

後端邏輯寫在 `Code.gs`（本地參考副本），需手動複製至 Google Apps Script 雲端編輯器。

### 步驟

1. 開啟 [script.google.com](https://script.google.com)，進入本專案的 Apps Script
2. 將 `Code.gs` 內容貼入（或更新對應函式）
3. 將 `Code.gs` 第 17 行的 `SPREADSHEET_ID` 佔位符換成實際 Spreadsheet ID
4. 點選「部署 → 管理部署項目 → 建立新版本」
5. 執行身分：**我（擁有者）**；存取對象：**所有人**

> ⚠️ Spreadsheet ID 為公司機密，請勿 commit 實際值。

### API 端點（doGet action 參數）

| action | 對應工作表 | 說明 |
|--------|-----------|------|
| `carousel` | `Carousel-titile` | 首頁輪播圖資料 |
| `locations` | `locations` | 郵局列表 |
| `spaces` | `ad_spaces` | 廣告版位 |
| `catalog` | `locations` + `ad_spaces` | 局所與版位合併資料（前台使用） |
| `bookings` | `bookings` | 訂單資料 |
| `seo` | `SEO` | 各頁面 SEO meta 資料 |
| `submitBooking` | `customers` + `bookings` | 送出詢價，寫入客戶資料與版位訂單（回傳 `{success, bookingId}`） |

所有請求須帶 `&callback=函式名稱`（JSONP 格式）。

> 公開資料 API 使用 Google Apps Script 快取，Google Sheets 更新後最多約 5 分鐘才會反映到網站；此設計可減少 Apps Script 冷啟動造成的長時間讀取畫面。

### 詢價寄信

當報價單 PDF 成功產生後，系統會寄送客戶一封附有 PDF 的報價單，並另寄一封內部通知到 `service@breathtiger.com` 與 `drake@breathtiger.com`。內部通知包含客戶聯絡資料、版位明細、詢價合計與 PDF 附件。

> ⚠️ 每次「建立新部署」會產生全新 URL。若要更新現有 URL，請選「管理部署 → 編輯 → 選新版本」，`site.js` 第 1 行 `apiUrl` 須與目前活躍部署一致。

---

## Google Sheets 工作表說明

### customers 工作表（詢價客戶資料）

每筆詢價訂單寫入一行：

| 欄位 | 說明 |
|------|------|
| booking_id | 訂單編號（`BK-YYYYMMDD-XXXX`） |
| 公司名稱 | 客戶公司名稱 |
| 統一編號 | 統編（個人可空） |
| 聯絡人姓名 | 聯絡人 |
| 聯絡電話 | 電話 |
| 電子信箱 | Email |
| 公司地址 | 地址（可空） |
| 總金額 | 所有版位報價合計 |
| 建立時間 | Asia/Taipei 時區，格式 `yyyy-MM-dd HH:mm:ss` |

### bookings 工作表（版位訂單明細）

每個版位寫入一行，多版位共享同一 `booking_id`：

| 欄位 | 說明 |
|------|------|
| booking_id | 同 customers 表的訂單編號 |
| space_id | 版位編號 |
| 刊登月份 | 刊登月數 |
| 報價金額 | 該版位報價 |

### SEO 工作表（頁籤名稱：SEO）

由此工作表統一管理各頁面的 SEO 文字，更新後自動帶入網站，**無需修改程式碼**。

| 欄位 | 說明 |
|------|------|
| 頁面 | 對應 HTML 檔名，例如 `index.html` |
| 標題title | `<title>` 與 `og:title` |
| meta描述(og) | `<meta description>` 與 `og:description` |
| meta關鍵字(og) | `<meta keywords>` |
| og圖片網址 | `og:image` 與 `twitter:image` |

填寫範例：

| 頁面 | 標題title | meta描述(og) | meta關鍵字(og) | og圖片網址 |
|------|----------|-------------|--------------|---------|
| index.html | 郵局牆面廣告版位｜基隆、汐止、瑞芳 | 中華郵政基隆… | 郵局廣告,牆面廣告… | https://… |
| locations.html | 局所列表｜郵局牆面廣告版位 | 瀏覽基隆市… | 基隆廣告,… | https://… |
| spaces.html | 廣告版位｜郵局牆面廣告版位 | 瀏覽各郵局… | 版位出租,… | https://… |

---

## 安全性規範

以下資訊為公司機密，禁止 commit 至 Git：
- Google Apps Script 部署網址
- Google Sheets Spreadsheet ID
- 任何 API Key、token、secret

---

## 聯絡資訊

- 公司：虎之呼吸科技有限公司
- Email：service@breathtiger.com
- LINE：https://lin.ee/Rtr3Tlq4
- 官網：https://www.breathtiger.com
