# 版本紀錄

## v1.2 - Unified Engine

已正式上線。正式程式基準：`b4c8dcf1208a7967fca8f65f06ba05c505a60838`。

正式網站：https://rbereo0002-png.github.io/yilan-rail-dashboard/

- 單一時程引擎與單一付款引擎，全部畫面共用不可變 model。
- 正式入口移除多重 renderer／MutationObserver 補畫衝突；舊 patch／stable 程式留存但不載入。
- 修正南北段切換 race condition，最後選擇生效。
- 付款改用 paymentId，修正依欄位 index 解析造成的錯位。
- 三級期限：契約期限、管理預估、外部／條件式；三級付款：已達條件、管理預估、外部條件。
- actualSignDate 未來日期防呆，今日依裝置當地日期；未生效日期不認列簽約起算或簽約付款。
- 公開模式不讀取本機草稿；恢復 GitHub 資料保留載入失敗時的本機資料。
- 監造暫不顯示，但保留程式與資料機制。
- 出流管制條件式；水保預設停用但保留可啟用機制。
- KPI 明確標示已起算期限；付款里程碑列印每列兩個節點；修正可見章節編號。
- 48 項自動測試全數通過。使用者人工確認切換、畫面穩定、四種實際簽約日期情境與付款里程碑列印；並非本環境瀏覽器自動測試。

### 上線後文件收尾

更新 README、正式上線架構說明及本版本紀錄；不修改核心程式或三份業務 JSON。舊 lwtlin-sketch/yilan-rail-dashboard 永久保留作 rollback／歷史基準。

### 已知限制

Excel 為 HTML .xls 相容格式；年度付款不含用地與監造；公開模式不是登入授權。裝置日期與跨日更新限制、業務起算點待確認事項詳見 docs/unified-engine-v1.md。獨立 test/index.html 的 SITE_URL 未定義，列為待辦，本次不修正。
