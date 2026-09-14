# Unified Engine v1.2 — 正式上線說明

目前正式版本：**Unified Engine v1.2**，已正式上線。

- 正式 repository：[rbereo0002-png/yilan-rail-dashboard](https://github.com/rbereo0002-png/yilan-rail-dashboard)
- 正式網站：[GitHub Pages](https://rbereo0002-png.github.io/yilan-rail-dashboard/)
- 正式程式基準 commit：`b4c8dcf1208a7967fca8f65f06ba05c505a60838`（後續文件提交不改變此程式基準）。
- 舊 [lwtlin-sketch/yilan-rail-dashboard](https://github.com/lwtlin-sketch/yilan-rail-dashboard) 不再修改，永久保留作 rollback／歷史基準；舊版 commit：`184dceeb1a56056d90451205b971ffcf92b3a1f6`。

## Before / After

| 面向 | Before | After |
|---|---|---|
| 規則 | app defs、rules、付款 add 呼叫各自定義 | rules.js 唯一業務規則來源 |
| 時程 | computeSchedule 被覆寫，Stage 2 / 3 各算一次 | schedule-engine 純函式計算 |
| 付款 | 依表格列序與 td index 反向解析 | paymentId / triggerRef 直接讀節點 |
| 畫面 | Observer、延遲補畫及定時校正互相覆蓋 | 一個事件提交一次狀態更新，一個 model 給全部 renderer |
| 南北段 | 請求先後次序不保證，草稿遺失 | 請求序號檢查、最後選擇生效、分段草稿 |
| 日期 | rows 寫入，window.rows 回填 | ProjectStore 持有 rows，明確參數傳入 |
| 延誤 | 核定日直接減提送期限 | 提送逾期、審查超過管理目標、後續基準偏移分開 |
| 完成度 | 隨管理／契約分類變動母體 | 固定契約成果母體，分類只影響到期警示 |
| Excel | 先重算表身後立刻讀 DOM，10/9欄錯位 | 與畫面共用純資料表格產生器，輸出實際日期文字 |
| 監造 | 視覺隱藏但仍計算與匯出 | 保留資料與獨立引擎，正式 model 不呼叫 |

流程：操作更新 ProjectStore → calculateModel → calculateSchedule → calculatePayments → 不可變結果 → Dashboard／表格／甘特圖／關聯／付款里程碑／匯出。

無新增執行期依賴，GitHub Pages 可直接提供靜態檔案。

## 保留業務資料的證據

- data/north.json、data/south.json、projects.json 均未修改。
- 原 rules.js 六組規則陣列與基準版本逐值比較；契約日數、說明、標段適用及預設 enabled 不變。
- 14 筆付款比例維持 10、10、10、10、10、90、90、90、20、5、40、5、5、5；工程設計累計 10、20、40、45、85、90、95、100%。
- 測量、地質、管線各保留 10%／90%；監造模擬保留 5%／93%／2% 及每兩個月分期。
- 未依 PDF 重新認定契約內容。既有 designRiskPlan 以 signDate 起算、說明卻寫契約生效日的問題仍待業務確認，本版不擅改起算條款。
- rowDrawing 起算點不明的既有管理推估限制保留，不因填入核定日就自動改為契約逾期。

## 日期與分類的明確處理

1. 原 signDate 作預定／管理基準；新增 actualSignDate，由使用者確認後填入。未登錄前不自動視為簽約完成。這是日期證據分流，不修改原日數或原 JSON。
2. 每個節點同時保留 baselineDue、contractDue、managementForecast、forecastDue、actualSubmit、actualApproval。
3. 實際日期在未來：仍保存與顯示，發出警示，不計完成／已達請款條件。
4. 工程會、招標、全部決標、結算日期：上方輸入與 rows approval 同步。舊資料衝突採 rows 優先，保留另一值及警示。
5. 契約期限以日曆天相加，假日只標示，不順延。付款行政天數沿用工作天計算及自訂非工作日。
6. 出流管制不增加固定日數；水保僅以 enabledRules.soilWaterPlan 控制顯示，停用不刪資料。
7. 30 日內 KPI 包含 14 日內；兩者不是可相加的互斥數量。
8. 外部條件達成僅表示日期證據具備，沒有新增實際請款／付款核銷功能。

## 可以刪除的舊檔案

本次先保留但完全不載入，方便審查與歷史對照。後續另案審查後可刪除：

- payment-tier-fix.js
- payment-tier-stable.js
- stage2-tier-stable.js
- stage3-kpi-print-fix.js

stage2.js、stage3.js 亦已無正式入口引用，功能已搬入新引擎／views；可一併移除。不能再將舊檔加入新首頁，因為舊全域 API 已退休。舊檔中的 Observer／計時器不是正式版本執行路徑。

原 style.css、timeline.css 保留；unified.css 只修正顯示、唯讀與列印衝突。未重設視覺風格。

## 架構整併檔案紀錄

既有：README.md、app.js、index.html、rules.js。

新增：dates.js、store.js、schedule-engine.js、payment-engine.js、model.js、views.js、supervision-engine.js、unified.css、package.json、docs/unified-engine-v1.md、tests/engine.test.js、tests/store.test.js、tests/entrypoint.test.js、tests/fixtures/legacy-business.json、tests/signing.test.js。

未修改：兩段 JSON、projects.json、test/index.html、舊 stage／patch／stable、style.css、timeline.css。

## 已執行驗證

- Node 語法檢查：新正式模組與測試檔。
- `node --test tests/*.test.js`：48 項全數通過。
- 原規則逐值比較；付款比例、累計、預算保留。
- 兩段舊 JSON、實際日期回填、未來核定日、固定完成度母體。
- 同一外部日期不同輸入來源的一致性、清除日期不復活、衝突保留。
- 快速切換及舊請求失敗、分段草稿、儲存／還原、唯讀遠端資料、失敗不覆蓋草稿。
- 日期、假日、PCM 推估、提送／審查延誤、管理專屬節點、條件式啟用。
- 表格欄數一致、匯出實際文字及轉義、模組引用、單一入口、正式路徑無 Observer／補畫計時器。
- git diff --check。

## 使用者實機驗證

依使用者本次確認，以下均已人工驗證：

- 南北段切換不跳回前一標段。
- 畫面不跳動。
- actualSignDate 空白、未來、今日、昨日四種情境，南北段均正確。
- 列印付款里程碑已驗證。

以上為使用者實機回報；本執行環境未完成瀏覽器自動化驗證，兩者分別記錄。

## 已知限制與後續回歸檢查

環境沒有 Chromium；嘗試安裝時下載逾時／502，未完成真實瀏覽器互動、畫面截圖、實際下載及列印測試。這些未被列為通過項目。

後續版本變更時，應在支援 ES modules 的瀏覽器回歸檢查：

1. 頁面放置不操作，無持續 DOM 重畫；操作日期後各區數值一致。
2. 南→北→南快速切換與慢速網路，最後選擇生效；各段草稿保留。
3. 填入實際核定後回填不空白，清除後付款也回復預估／外部條件。
4. 改契約金額、行政工作天、非工作日，明細與摘要同時更新。
5. 手動重算後付款表仍 10 欄、關聯表 9 欄；匯出的 Excel 相容檔對齊。
6. 公開模式可切換標段，但不能編輯；不顯示本機編輯草稿。
7. 列印寬度、甘特圖與水保啟用顯示。

本版 Excel 沿用 HTML .xls 相容格式，不是原生 XLSX；目前年度彙整不含用地及監造付款。獨立 test/index.html 的 SITE_URL 與雲端權限問題不屬本次整併修改範圍。

## v1.2 日期有效性與待辦

- 今日使用裝置當地日期；actualSignDate 輸入動態設定 max=今日。
- 實際簽約日有值且不晚於今日才生效。未來值不啟動簽約起算期限、簽約付款達成或其逾期判讀，保留資料並顯示警示，管理預估回到 signDate。
- Dashboard 分別顯示「尚未登錄實際簽約」「實際簽約日尚未生效」「履約管制中」；未生效 badge 顯示待確認。
- 裝置日期／時區錯誤會影響判斷；跨午夜須操作、重算或重新取得焦點才更新。
- 已簽約後總狀態為履約管制中，異常仍須查看個別 KPI。
- 獨立 test/index.html 的 SITE_URL 未定義，列為已知待辦，不屬正式入口；雲端登入／重設密碼設定另案處理。
- 公開模式是前端展示模式，不是登入授權機制。

## 正式交付狀態

已正式上線，main 已納入上述 v1.2 程式基準。舊 repository 作永久歷史回復點；本次僅更新文件，不修改程式、業務 JSON 或 release tag。
