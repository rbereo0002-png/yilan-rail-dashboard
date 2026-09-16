# v1.3 正式 XLSX 匯出功能分支

基準 main：`708fca3302cd674d17d9af4236cf3b43cc7d0096`。
開發分支：`feature/xlsx-export-v1`；本次不合併 main、不發布 Pages。

## 使用與來源

按「匯出 Excel (.xlsx)」，輸出目前選定標段：
`宜蘭高架_南段_履約管制_YYYYMMDD.xlsx` 或北段同格式。
日期取自目前畫面的 model.today，不另行重算或改寫 state。

採 ExcelJS 4.4.0，使用其原始 browser bundle，固定版本納入 vendor，
首次匯出才載入。此套件直接支援凍結首列、粗體、日期及數值格式；
不增加後端、建置流程或外部 CDN 依賴。來源、MIT 授權及雜湊見 vendor/README.md。

| 工作表 | 既有 model 來源 |
|---|---|
| 履約總覽 | project、today、dashboard、payments.totals、summary.warnings |
| 設計主時程 | schedule.list |
| 前後置關聯 | schedule.list、schedule.model（前置節點名稱） |
| 付款預測 | payments.list |
| 年度資金需求 | payments.years |
| 契約時限主檔 | schedule.list |
| 基準資料 | project.milestones／settings／dates／notices |
| 延誤影響 | summary.affected |

不解析 DOM、不讀取 td index、不重算時程或付款。日期只轉為 UTC 日期值以避免時區位移，
百分比只將 model 的百分數轉成 Excel 比例。金額保留 model 精度，以 `#,##0` 呈現，與畫面相同；
比例使用 `0.00%`。空白及無效日期留空。文字值不作公式解讀。

起算日沿用畫面的 forecastStart；三級期限仍以 dueType、contractDue 及 managementForecast 判斷，
不將管理預估日當成契約期限。基準資料明列「管理預估日期不等同契約明定期限。」
年度資金需求直接使用現有彙整；外部條件未定日期者不臆估年度。未加入施工監造工作表。
本次依匯出欄位要求保留既有決標日、評選日及議價日資料，不調整採購事件或業務欄位。

匯出取得現有不可變 model 的參照，非同步產檔期間切換標段不影響該次檔名或內容。
公開模式可匯出所見資料；JSON、列印及本機草稿流程保持原有行為。
views.js 的舊 exportHTML helper 為既有測試保留，但正式 Excel 按鈕不再呼叫，也不再下載 `.xls`。

## 自動驗證

- `node --test tests/*.test.js`：61 項全部通過，原有 48 項不變，新增 13 項。
- 使用同一 vendored browser bundle 寫入及讀回南北段 OOXML ZIP，驗證中文工作表、
  凍結首列、粗體、日期、numeric 金額、percentage format、model 對應、空表、字串安全及切換快照。
- 驗證匯出前後 model、project、store 草稿及三份業務 JSON 不變。
- 正式 11 個自有 JS 模組及 vendor bundle 語法檢查、`git diff --check` 通過。
- 七個受保護核心 JS 與三份業務 JSON 相對基準 main 完全未修改。

## 合併前人工驗證

本環境有 Playwright 套件，但沒有 Chromium 執行檔，因此尚未驗證實際瀏覽器下載。
也未在 Microsoft Excel 實際開啟；自動測試通過不等同完成 Excel UI 驗收。

1. 以 HTTP 開啟功能分支，南北段各按一次匯出，確認檔名、8 張工作表與畫面一致。
2. 在 Microsoft Excel 開啟，確認無副檔名不一致或修復提示，日期及中文正常。
3. 確認凍結首列、金額千分位、百分比；分別測試公開模式與有本機草稿的編輯模式。
4. 下載期間切換標段，確認匯出保留按下按鈕時的標段；確認 JSON 與列印仍可操作。

建議建立 PR，在人工驗證完成後再決定是否合併。
