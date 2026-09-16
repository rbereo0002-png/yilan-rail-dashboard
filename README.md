# 宜蘭高架履約期程與付款管制 — Unified Engine v1.2

目前正式版本：**Unified Engine v1.2**，已正式上線。

本功能分支新增 **v1.3 `.xlsx` 匯出**，尚未合併或發布至正式 Pages。操作與驗證說明見 [docs/xlsx-export-v1.md](docs/xlsx-export-v1.md)。

- 正式 repository：[rbereo0002-png/yilan-rail-dashboard](https://github.com/rbereo0002-png/yilan-rail-dashboard)
- 正式網站：[GitHub Pages](https://rbereo0002-png.github.io/yilan-rail-dashboard/)
- 正式程式基準 commit：`b4c8dcf1208a7967fca8f65f06ba05c505a60838`（後續文件提交不改變此程式基準）。
- 舊 [lwtlin-sketch/yilan-rail-dashboard](https://github.com/lwtlin-sketch/yilan-rail-dashboard) 不再修改，永久保留作 rollback／歷史基準；舊版 commit：`184dceeb1a56056d90451205b971ffcf92b3a1f6`。


## 啟動與測試

這是無建置的 ES module 靜態網站；Excel 匯出使用 repository 內固定版本 ExcelJS 4.4.0，無外部 CDN 執行期依賴。

```sh
python3 -m http.server 8000
node --test tests/*.test.js
```

透過 HTTP 開啟 `index.html`；不能直接用 file://。`package.json` 僅指定 ESM 與測試指令，不需要 npm install。既有 `test/index.html` 是獨立的 Supabase 頁面，本版未改動它。

## 唯一資料流

`操作 → ProjectStore → calculateModel → 時程引擎 → 付款引擎 → 同一份不可變結果 → 畫面／匯出`

- `rules.js`：唯一業務規則，包含原時程規則、14 筆付款規則、監造模擬比例。
- `schedule-engine.js`：契約期限、管理預估、外部條件、實際日期、延誤。
- `payment-engine.js`：以 paymentId / triggerRef 連動，不解析 HTML 表格。
- `model.js`：一次計算時程、付款、總覽與統計。
- `store.js`：資料驗證、舊 JSON 相容、本機保存、標段草稿、非同步競爭控制。
- `views.js`：Dashboard、時程、甘特圖、關聯、付款與純資料匯出。
- `excel-export.js`：直接讀取不可變 model，輸出 8 個 `.xlsx` 工作表；`excel-library.js` 延遲載入本機固定版本套件。
- `app.js`：唯一入口與事件處理。正式入口不載入舊 stage / patch / stable。
- `supervision-engine.js`：保留監造模擬，正式首頁及目前匯出不執行。

## 日期與資料保存

原 `milestones.signDate` 保留為簽約基準日，可為預定。`actualSignDate` 必須有值且不晚於使用者裝置當地今日，才將簽約觸發期限列為契約期限、簽約款列為已達條件。原 JSON 未明確區分預定／實際，系統不猜測。

`rows.<節點>_submit` / `rows.<節點>_approval` 保留，避免既有實際日期遺失。工程會等外部日期的上方欄位與成果表使用同一資料；匯入衝突以成果表核定日優先，舊值保留於 `legacyDateConflicts` 並警示。匯出新增 `schemaVersion: 2`，不刪除原監造或其他未識別欄位。

編輯後按「儲存本機」只存目前標段；不同標段未儲存草稿於本次頁面工作期間保留，重新整理前須儲存或匯出 JSON。GitHub 正式資料仍以 `data/north.json`、`data/south.json` 為來源，系統不會自動寫回 GitHub。

公開檢視使用 `?view=1`，直接載入遠端 JSON、不套用編輯草稿；這是展示模式，不是登入或存取權限控管。

出流管制維持條件式；水保預設不適用，勾選啟用後顯示，停用不刪除日期。監造資料及程式保留，正式首頁暫不顯示，也不納入總覽／匯出。年度付款彙整範圍為工程設計與調查，不含用地及監造付款。

## 審查資料

[完整整併說明與測試範圍](docs/unified-engine-v1.md)

## 驗證與版本紀錄

48 項自動測試全數通過。使用者已人工確認：南北段切換不跳回、畫面不跳動、實際簽約日空白／未來／今日／昨日四種情境及付款里程碑列印。這是使用者實機回報，不代表本執行環境完成瀏覽器自動測試。

實際簽約日輸入動態限制 `max=今日`；既存未來值保留並警示，不認列簽約生效，改採簽約基準日作管理預估。日期依裝置當地日期判斷。

詳見 [版本紀錄](CHANGELOG.md)。待辦：獨立 `test/index.html` 的 `SITE_URL` 未定義；本次僅記錄，不修改該頁或正式入口。
