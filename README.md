# 宜蘭高架履約期程與付款管制 — Unified Engine（測試分支）

> **重要：本分支為 PR #15 開發版本，尚未合併正式 main。** 下列正式歷史基準為既有說明，不能視為本次新版已正式上線。
>
> 本次採「由 AI 透過連線工具更新中央 Supabase 維護主檔；審核後同步唯讀 GitHub JSON 發布副本」。使用者不需登入、不在瀏覽器編輯或儲存履約資料。長官版及承辦版讀取同一組發布資料；發布副本並非即時資料庫連線。

- 正式 repository：[rbereo0002-png/yilan-rail-dashboard](https://github.com/rbereo0002-png/yilan-rail-dashboard)
- 正式網站：[GitHub Pages](https://rbereo0002-png.github.io/yilan-rail-dashboard/)
- 正式程式基準 commit：`b4c8dcf1208a7967fca8f65f06ba05c505a60838`（後續文件提交不改變此程式基準）。
- 舊 [lwtlin-sketch/yilan-rail-dashboard](https://github.com/lwtlin-sketch/yilan-rail-dashboard) 不再修改，永久保留作 rollback／歷史基準；舊版 commit：`184dceeb1a56056d90451205b971ffcf92b3a1f6`。


## 啟動與測試

這是無建置、無執行期套件依賴的 ES module 靜態網站。

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
- `store.js`：資料驗證、舊 JSON 相容、標段隔離與非同步競爭控制；**前端不使用本機持久保存**。
- `views.js`：Dashboard、時程、甘特圖、關聯、付款與純資料匯出。
- `app.js`：唯一入口與事件處理。正式入口不載入舊 stage / patch / stable。
- `supervision-engine.js`：保留監造模擬，正式首頁及目前匯出不執行。

## 日期與資料保存

原 `milestones.signDate` 保留為簽約基準日，可為預定。`actualSignDate` 必須有值且不晚於使用者裝置當地今日，才將簽約觸發期限列為契約期限、簽約款列為已達條件。原 JSON 未明確區分預定／實際，系統不猜測。

`rows.<節點>_submit` / `rows.<節點>_approval` 保留，避免既有實際日期遺失。工程會等外部日期的上方欄位與成果表使用同一資料；匯入衝突以成果表核定日優先，舊值保留於 `legacyDateConflicts` 並警示。匯出新增 `schemaVersion: 2`，不刪除原監造或其他未識別欄位。

**本分支前端一律唯讀，不提供「儲存本機」、網頁編輯或資料庫登入。** 中央資料庫為唯一可修改主檔；`data/north.json`、`data/south.json` 是依核對後由 AI 同步發布的唯讀副本。資料庫已更新但 JSON 尚未發布時，網頁仍會顯示上一次已發布版本。

承辦人與長官頁均是唯讀檢視，不以網址參數假扮權限控管。GitHub Pages 若為公開站點，發布資料也可能被外界取得；機敏內容需另做限制。

出流管制維持條件式；水保預設不適用，勾選啟用後顯示，停用不刪除日期。監造資料及程式保留，正式首頁暫不顯示，也不納入總覽／匯出。年度付款彙整範圍為工程設計與調查，不含用地及監造付款。

## 審查資料

[完整整併說明與測試範圍](docs/unified-engine-v1.md)

## 驗證與版本紀錄

歷史 Unified Engine v1.2 的 48 項自動測試曾通過。**本分支截至 115/11/18 已有 115 項測試通過；仍須進行新版本實際瀏覽器驗收。** 使用者已人工確認：南北段切換不跳回、畫面不跳動、實際簽約日空白／未來／今日／昨日四種情境及付款里程碑列印。這是使用者實機回報，不代表本執行環境完成瀏覽器自動測試。

實際簽約日輸入動態限制 `max=今日`；既存未來值保留並警示，不認列簽約生效，改採簽約基準日作管理預估。日期依裝置當地日期判斷。

詳見 [版本紀錄](CHANGELOG.md)。待辦：獨立 `test/index.html` 的 `SITE_URL` 未定義；本次僅記錄，不修改該頁或正式入口。

## 本次整合開發文件

- [中央資料庫／各子系統架構與進度](docs/control-system-refactor-20261118.md)
- [每次來函、會議紀錄之 AI 登錄與發布流程](docs/assistant-managed-publication-runbook-20261118.md)
- [審查最新版投影](review-workflow.js)、[全案共管去重](shared-controls.js)
