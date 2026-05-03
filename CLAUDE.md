# PostWallAd — 工作交接文件

## 專案說明
**郵局牆面廣告版位出租銷售平台**（虎之呼吸科技有限公司）
服務區域：基隆市全區、新北市汐止區、新北市瑞芳區

## 技術棧
- 純靜態前端：HTML / CSS / Vanilla JS
- Bootstrap 5.3.3 + Font Awesome 6（cdnjs CDN，無網域限制）
- 後端：Google Apps Script（`Code.gs`，本地有參考副本）
- 資料庫：Google Sheets（Spreadsheet ID: `159dxUpnxrXp-V3uR4c6BqWhZUep-4_8MpENLI7dimeY`）
- 跨域方案：JSONP（Apps Script 不支援 CORS）

---

## 檔案結構
```
postwallad/
├── index.html       # 首頁（輪播、特色介紹、服務區域、三步驟）
├── locations.html   # 郵局列表頁（篩選、搜尋、卡片展示）
├── spaces.html      # 版位詳細頁（版位卡片、即時報價、加入詢價）
├── quotation.html   # 詢價送出頁（版位摘要確認 + 客戶資料表單 + 送出至 Sheets）
├── site.js          # 主程式（輪播 + 郵局列表 + 版位頁邏輯 + 詢價流程 + SEO 注入）
├── spaces.js        # 舊版版位渲染（已廢棄，勿使用）
├── Code.gs          # ⚠️ Apps Script 本地參考副本（勿直接執行，需貼至雲端）
├── style.css        # 全站樣式（含列印、版位卡片、報價單）
├── README.md        # 功能說明與部署指南
└── CLAUDE.md        # 本文件
```

### Code.gs 注意事項
- 本地 `Code.gs` 是**參考副本**，實際執行在 Google Apps Script 雲端
- 修改後需手動複製貼至 Apps Script 並**重新部署（建立新版本）**
- `SPREADSHEET_ID` 佔位符需在雲端編輯器替換為實際值（禁止 commit 實際值）
- **此檔不得刪除**，作為雲端程式碼的唯一本地備份

---

## Google Sheets 工作表欄位

### locations（郵局列表）
`location_id, 郵遞區號, 局名, 縣市, 行政區, 地址, 電話號碼, 封面圖網址, File ID, File ID圖片網址`

### ad_spaces（廣告版位）— 完整欄位（依截圖確認）
| 欄 | 欄位名稱 | 說明 |
|---|---|---|
| A | space_id | 版位編號 |
| B | location_id | 局所 ID |
| C | 寬cm. | 寬度 |
| D | 高cm | 高度 |
| E | 面積m2 | 面積 |
| F | 才數 | 才數 |
| G | 郵局廣告成本價格(整數面積*500) | 成本參考 |
| H | 出租價格 | 郵局底價 |
| **I** | **出租報價/月** | **月租金（報價計算用，乘月數）** |
| J | 印刷輸出材質 | 材質 |
| K | 印刷成本單價/才 | 單價 |
| L | 印刷成本 | 成本 |
| M | 印刷成本（含復原） | 成本×2 |
| N | 印刷輸出價格x2 | 印刷底價 |
| **O** | **印刷輸出報價** | **印刷費（固定，不乘月數）** |
| P | 吊車 | 吊車費 |
| **Q** | **吊車費用（裝＋拆＋道路申請）/1天** | **施工費（固定）** |
| R | 施工成本（裝＋拆） | 施工成本 |
| **S** | **施工報價** | **施工報價（固定）** |
| T | 總成本 | 內部成本 |
| U | 總報價 | 最終售價（黃色欄） |
| ... | File ID圖片網址 | 版位照片 |
| ... | 狀態下拉(可刊登/不可登) | 狀態 |

### 報價公式（重要）
```
總報價 = I（出租價格/月）× 月數 + O（印刷費）+ Q（施工費用）+ S（施工價格）
```
- **欄 I**：月租金，唯一乘以月數的項目
- **欄 O、Q、S**：固定費用，不隨月數變動
- 欄名可能含全/半形符號，統一用 `includes()` 模糊比對取值

範例：A020 × 1個月 = 15,000×1 + 15,000 + 5,000 + 7,500 = **87,500**
範例：A020 × 2個月 = 15,000×2 + 15,000 + 5,000 + 7,500 = **102,500**

### bookings（每個版位一行）
`booking_id, space_id, 刊登月份, 報價金額`

- 一筆訂單可有多行（每個版位各一行，共享同一 `booking_id`）
- `booking_id` 格式：`BK-YYYYMMDD-XXXX`（日期 + 4碼隨機大寫英數字）

### customers（客戶資料，每筆訂單一行）
`booking_id, 公司名稱, 統一編號, 聯絡人姓名, 聯絡電話, 電子信箱, 公司地址, 總金額, 建立時間`

### Carousel-titile（輪播）
`Slogan, 行動號召, 封面圖網址, File ID, File ID圖片網址`

---

## API 端點（Code.gs doGet）
- `?action=carousel`      → 輪播圖資料（工作表：`Carousel-titile`）
- `?action=locations`     → 郵局列表（工作表：`locations`）
- `?action=spaces`        → 版位列表（工作表：`ad_spaces`）
- `?action=bookings`      → 訂單資料（工作表：`bookings`）
- `?action=seo`           → 各頁面 SEO meta（工作表：`SEO`）
- `?action=submitBooking` → 送出詢價（寫入 `customers` + `bookings`，需帶完整客戶欄位與 `items` JSON）
- 所有請求須帶 `&callback=函式名稱`（JSONP）

### submitBooking 參數
| 參數 | 說明 |
|------|------|
| `companyName` | 公司名稱 |
| `taxId` | 統一編號（可空） |
| `contactName` | 聯絡人姓名 |
| `phone` | 聯絡電話 |
| `email` | 電子信箱 |
| `address` | 公司地址（可空） |
| `totalAmount` | 總金額（未稅，各版位 price 加總） |
| `items` | JSON 陣列，每項 `{space_id, months, price, locationName, w, h}` |

回傳：`{ success, bookingId, pdfUrl }`（pdfUrl 為空代表 PDF 生成失敗，不影響訂單寫入）

### Apps Script 部署注意事項
- 每次「建立新部署」會產生**全新 URL**，舊 URL 仍指向舊版本
- 若要更新現有 URL：選「管理部署 → 編輯 → 選新版本」，URL 不變
- `site.js` 第 1 行 `apiUrl` 必須與目前活躍部署的 URL 一致
- 新增 DriveApp / UrlFetchApp / MailApp 後，需在 `appsscript.json` 明確宣告 OAuth 範圍，並重新部署觸發授權

### Script Properties（雲端 Apps Script 設定，勿 commit 實際值）
| 屬性名稱 | 用途 |
|---------|------|
| `SPREADSHEET_ID` | 主資料庫 Sheets ID |
| `QUOTE_TEMPLATE_ID` | 報價單範本 Sheets 檔案 ID |
| `QUOTE_FOLDER_ID` | 產生的 PDF 存放 Drive 資料夾 ID |

### appsscript.json 必要 OAuth 範圍
```json
"oauthScopes": [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/gmail.send"
]
```

---

## 完成進度

### ✅ 已完成
- 首頁（index.html）：輪播圖、特色介紹、服務區域、三步驟、SEO / JSON-LD
- 郵局列表（locations.html）：JSONP 載入、縣市/行政區篩選、搜尋、「只顯示有可用版位」checkbox、卡片展示、可用版位數 badge
- 後端 API（Code.gs）：所有 action 路由正常，含 submitBooking
- 版位詳細頁（spaces.html）：郵局資訊 + Google Maps 嵌入、版位卡片列表、月份輸入即時報價、加入詢價/取消 toggle、詢價 Modal（含跨局所版位、刪除單項、「索取報價單」單按鈕）、圖片點擊放大
- 詢價送出頁（quotation.html）：版位摘要確認（含局所名稱欄）、客戶資料表單、JSONP 送出至 Sheets（customers + bookings），成功顯示 booking_id
- Google Sheets 雙表架構：customers（每筆訂單一行）+ bookings（每個版位一行）
- **跨局所購物車**：sessionStorage 持久化（`pw_inquiry_cart`），跨郵局保留版位選擇；切換局所後進入 spaces.html 自動恢復按鈕狀態
- **導覽列 badge**：全站 4 頁導覽列顯示「選擇版位報價」連結，紅底黃字跳動數字（`cartBounce` CSS 動畫），無版位時自動隱藏
- Icon 系統：全站從 Bootstrap Icons 遷移至 Font Awesome 6（`fa-solid fa-*` 格式，cdnjs CDN）
- SEO 動態注入：`site.js` 頁面載入時呼叫 `?action=seo`，依頁面檔名匹配 SEO 工作表並更新 title / meta / og 標籤
- **報價單 PDF 自動生成（程式完成，OAuth 待解）**：
  - Code.gs 新增 `generateQuotePdf()`：複製「郵局牆面廣告報價單-範本」Sheets 的「報價單範本」分頁，以 `booking_id` 命名新分頁，填入甲方資訊（B3~B8）、動態版位列（增減列數）、金額/稅額（5%）/總價（COL G）、民國年日期；UrlFetchApp 匯出 PDF 存入 Drive 資料夾
  - Code.gs 新增 `sendQuoteEmail()`：MailApp 寄信給客戶（附 PDF）+ CC service@breathtiger.com
  - quotation.html 成功頁新增「下載報價單 PDF」紅色按鈕（pdfUrl 有值才顯示）
  - site.js：items JSON 新增 `locationName / w / h`；JSONP 逾時延長至 30 秒；onSuccess 處理 pdfUrl

### 🔲 待完成
- **Apps Script OAuth 範圍授權**：web app 部署需在 `appsscript.json` 加入 drive / external_request / gmail.send 範圍，重新部署觸發授權後 PDF 生成才會在正式環境運作
- **git push**：site.js、quotation.html、Code.gs 本次修改尚未推送至 GitHub Pages

### ⚠️ 待確認
- ad_spaces 欄 I、O、Q、S 的確切欄位名稱（現用 `includes()` 模糊比對）
- 部分版位 NT$ 格式的數值是否由 Apps Script 以數字或字串回傳

---

## 重要程式碼慣例

```javascript
// JSONP 載入（8秒逾時保護）
jsonp('spaces', function(data) { ... });

// XSS 防護（所有使用者可見字串都要過）
escHtml(str)

// 版位可用性判定（模糊比對「狀態」欄位）
isAvailable(space)  // 狀態 === '可刊登'

// 圖片 URL 轉換（Drive → 可用格式）
validUrl(val)  // 回傳 lh3.googleusercontent.com 或 drive.google.com/thumbnail 格式

// 報價計算（I×月數 + O + Q + S，用 includes() 找欄位名）
calcSpaceTotal(space, months)

// 數值解析（處理 NT$ 格式字串或純數字）
parseNum(val)  // 去除非數字字元後 parseFloat

// 詢價購物車（sessionStorage 跨頁面）
const CART_KEY = 'pw_inquiry_cart';
// cart 結構：Array of { space_id, location_id, locationName, months, total, w, h, monthlyRent, fixedCost }

// 前往詢價頁（保存 cart 至 sessionStorage 後跳轉）
goToQuotation()  // 定義在 initSpaces IIFE 內，掛至 window.goToQuotation

// 詢價頁邏輯（quotation.html 專屬 IIFE）
initQuotation()  // 讀取 sessionStorage cart，渲染摘要，處理表單送出
```

---

## 聯絡資訊
- 公司：虎之呼吸科技有限公司
- Email：service@breathtiger.com
- LINE：https://lin.ee/Rtr3Tlq4
- 官網：https://www.breathtiger.com
