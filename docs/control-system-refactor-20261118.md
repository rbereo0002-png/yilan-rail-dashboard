# 宜蘭至羅東鐵路高架化計畫｜管制系統整合重構狀態
更新：115/11/18

## 主要決策
- 使用者不自行登錄、不需前端資料庫帳號；未來提供來函、會議紀錄、審查成果，由受委託的 AI 逐次查核並透過連線工具更新中央資料庫。
- **維護主檔只有一個**：既有 Supabase 測試專案 `yilan-rail-control-test`。
- GitHub Pages 承辦/長官兩種網站為**唯讀呈現**，共用同一組審核發布的 `data/north.json`、`data/south.json`。這些 JSON 只能是發布副本，不是第二個手動維護的資料庫。不能假稱即時讀取 DB，更新須經逐次核對及發布。
- 不使用 localStorage 儲存履約主資料或登入憑證；停用本機編輯。正式 `main` 不受開發分支修改影響。
- **公開性注意**：目前 GitHub 倉庫為公開版本，發布任何未核定、機敏或個人資料前應先審查，不可直接同步資料庫全文。

## 測試資料庫
- `public.rail_control_snapshots`：north、south 各 1 份，revision=1。
- `public.rail_control_change_history`：資料更新前版本自動封存，已有交易回滾測試。
- `rail_private.shared_control_topics`：全案共管主題 10 項，唯一 ID。
- `rail_private.shared_control_links`：標段原始記錄 20 條，10 項各連北南段原始控制 ID，完整保留分段責任、日期及來源。
- `public.rail_control_members`：目前 0 個前端帳號，使用者無需設定，匿名無權直接讀寫維護主檔。
- 對修正版函文的 `draft` / `issued` 明確區分，未確認正式發文的退回通知不得產生正式逾期。

## 前端功能
- 承辦頁按「履約總覽／契約與時程／送審與月報／交辦介面與 KPI／估驗與付款／同月臺轉乘」獨立切換。各模組共用 `calculateModel`、`rules.js`、`schedule-engine.js`、`payment-engine.js`；不建立複本規則或付款索引。
- 長官頁仍為獨立入口，不連至承辦編輯工具。
- 目前送審只顯示最新版本；原始 A 版保留在可展開歷程。現行 A/B 版本均反映至承辦甘特圖和長官進度圖。
- 同月臺轉乘僅屬北段，116 年度上級 KPI 與契約本身分開列管。
- 全案共管項目長官頁只列全案父題一次，展開保留各段子題；總計去除跨標段同題重複計數，但不刪改歷史。

## 測試與待辦
- GitHub Actions 於最新測試分支完成 115 項 Node 回歸測試，115 通過、0 失敗；原 v1.3 RC 流程也成功。
- 未完成：實際桌機/手機/平板瀏覽器畫面驗證、公開資訊安全審查、發布主檔及 GitHub 副本版本一致的完整端到端演練、管理預估日期與契約期限逐項人工審查。
- 未合併正式 `main`，本 PR 仍保持 Draft。不可將尚未發布的資料庫 revision 直接當作正式網頁數據。
- 後續每份公文/紀錄的具體登錄及發布核對，依 `docs/assistant-managed-publication-runbook-20261118.md` 逐步進行。
