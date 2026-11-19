# 長官／承辦人一致性全面檢查與修正記錄（115/11/19）

## 修正前主要原因
- 兩版網站皆從相同 `data/north.json`、`data/south.json` 讀取，但是 **「相同原始資料」不等於「相同業務狀態／統計計算」**。
- 北段風險評估 `versionTracking.designRiskPlan` 只知 11/16 A版提交及 11/17 契約期限，審查意見 11/26 另放於 `kpiControls.north-risk-plan-A-review-1151126`。長官／承辦人不同區塊各自讀其中一處造成狀態及顯示差異。
- 舊版部分 KPI 只憑 `actualDate` 認定完成，使「會議已開但仍待結論」、「簡報已提但內容未核定」提前退出清單。
- 長官部分審查逾期、管理目標及待辦由獨立的頁面過濾計算，與承辦人共用模型的審查列管內容不完全一致。

## 已修改並可驗證的項目
| 類型 | 來源及 ID | 更正 | 期限及狀態性質 |
|---|---|---|---|
| 北段風險評估A版 | `versionTracking.designRiskPlan` | A版提送 115/11/16、契約期限 115/11/17、機關與PCM意見回復期限 115/11/26 共用同一成果與現行審查行動 | 11/17 廠商契約；11/26 審查單位行政回復，並非B版期限 |
| 北段風險會審獨立清單 | `north-risk-plan-A-review-1151126` | 改為來源關聯、保留原紀錄但排除雙重KPI計數／提醒 | 已函送依使用者確認；正式函號及發文日期未提供，留白待補 |
| 北段同月臺初步簡報 | `north-yilan-hsr-same-platform-meeting` | 有辦理日仍顯示「後續列管」 | 已開會審查，不等於已完成修正 |
| 北段同月臺V6 | `north-yilan-hsr-transfer-revised-analysis-1151106` | 115/11/5 已提送，但後續審查／方案核定仍開放列管 | 提送完成不等於核定 |
| 北段地方與臺鐵整合 | `north-kickoff-1151006-26` | 研討提報完成後續仍列管 | 原 115/10/31 目標不得再作尚未開會逾期 |
| 北段時程及最晚決策 | `north-kickoff-1151006-27` | 研討提報完成後續仍列管 | 待後續正式成果 |
| 北段分標及臨時軌切換 | `north-kickoff-1151006-28` | 研討提報完成後續仍列管 | 待後續正式成果 |
| 北段11/2 PCM會議 | `north-pcm-1151102-meeting` | 會議已召開／工作未結案，續列管 | 原會議召開不重複當即將到期 |
| 南段11/2 PCM會議 | `south-pcm-1151102-meeting` | 同上 | 同上 |

## 統一顯示規範
1. `model.js` 的 `currentReviews` + `reviewAttention` 唯一推導現行審查進度及行政回復期限，長官與承辦人不得另做第二套資料。
2. `dashboard.workViews.today/due14/due30` 和 `dashboard.executiveItems` 共用同一 `reviewAttention.id`，且只列現行版次。回復審查意見期限與原契約送審期限分欄。
3. 相同來源 KPI 已以 `linkedReview` 標記；保留來源供查詢，但不在 KPI、逾期統計或重要待辦重複計算。
4. `computedStatus='後續列管'` 表示中間里程碑已達成但後續審查／決策未完成，不回頭把原已完成的日期當作未辦逾期。
5. 南段五件現行 B 版仍依原記錄處理；只有函稿、待核定者不逕認正式回覆或修正期限已確認。

## 發布及驗證
- 中央 DB `north` 更新 revision 1→2，原 revision 已進入 change_history；`south` 維持 revision 1。
- GitHub PR #16 的南北段 JSON 與中央 DB 逐字段比對相同。
- 新增 `tests/review-consistency.test.js`，比對廠商原契約、PCM/機關回復、跨頁面 action ID、審查逾期不重複及中間工作未結案。
- 自動／瀏覽器測試需全數通過後才合併正式 `main`。尚待補正式會審函號及日期；不可自行臆造。
