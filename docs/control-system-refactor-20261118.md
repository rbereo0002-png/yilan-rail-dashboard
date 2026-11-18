# 履約管制系統整合重構：資料主檔、審查歷程與去重清單（115/11/18）

## 現況確認
- 正式 main 維持原狀。本文件屬隔離開發分支，不作正式發布。
- GitHub Pages 的 `data/north.json`、`data/south.json` 是兩份靜態標段主資料；既有承辦頁使用 `localStorage` 遮蔽來源檔，長官頁直接下載 GitHub JSON，因此曾出現「承辦儲存後，長官看不到」。
- 可用 Supabase 帳戶僅查得 `yilan-rail-control-test`，目前狀態 `INACTIVE`；在取得可運作且設定好身分驗證及 RLS 的中央後端之前，僅能唯讀檢視，不可假裝本機變更已同步。
- 開發分支已停止專案資料 `localStorage` 保存與載入，並於入口清除舊的 `yilan-dashboard-north`、`yilan-dashboard-south`、`yilan-dashboard-last-project`。這不影響其他網站的儲存資料或長官版的純字型偏好。
- 預覽版故意停用編輯及本機儲存。正式版在資料庫寫入、遷移與操作測試合格前不得合併。

## 管制主檔設計
1. **deliverable**：`contractId + deliverableId` 唯一，不同頁面只能參照，同一成果初次提送只計算一次。
2. **reviewEvent**：`eventId` 唯一；`deliverableId`、`version`、`type`（submitted, review_returned, reviewer_completed, resubmitted, approved, cancelled）、`eventDate`、`dueDate`、`referenceNumber`、`evidenceStatus`。追加歷程而非改寫前版。
3. **activeReview**：不另保存第二份主檔，由 reviewEvent 推導。退回後列「待提B版」、退回日、期限、逾期天數；B版提送後列「B版審查中」。歷史僅展開查詢。
4. **managementControl**：各標案專屬及全案共管事項使用全域 `controlId`；跨系統用對應關聯表引用，避免每標一份「全案」資料。
5. **paymentCondition**：`paymentId` 唯一，來源為設計成果／核定／外部條件；不得由畫面表格位置判定。
6. **KPI**：契約期限與上級年度目標各自獨立、互相引用；同一事件可影響多類指標，但計算去重。

## 預備合併的實際交叉項目（需核對會議紀錄後逐筆歸併）
| 議題 | 北段來源記錄 | 南段來源記錄 | 建議 |
|---|---|---|---|
| 116年基本設計全案KPI | north-2027-key-main-basic-submit | south-2027-key-main-basic-submit | 建立共用 KPI，兩段呈現同一資料 |
| 115/11/2研討會辦理 | north-pcm-1151102-meeting | south-pcm-1151102-meeting | 共用會議主記錄 |
| PCM整體時程／兩階段經費審議 | north-pcm-1151102-schedule | south-pcm-1151102-schedule | 全案父事項、個別子任務 |
| 分標策略 | north-pcm-1151102-packages | south-pcm-1151102-packages | 全案父事項、北南各自工項 |
| 系統機電 RI／EI 介面 | north-pcm-1151102-system | south-pcm-1151102-system | 全案介面共管，保留段別責任 |
| 臨時軌切換 | north-pcm-1151102-switch | south-pcm-1151102-switch | 總流程一筆，南北切換各自子任務 |
| 蘭陽溪橋 | north-pcm-1151102-bridge | south-pcm-1151102-bridge | 共管決策一筆，設計影響分段 |
| 車站出入口 | north-pcm-1151102-station | south-pcm-1151102-station | 不得直接合併宜蘭與羅東車站個別設計 |
| 中間切換檢查測試 | north-pcm-1151102-inspection | south-pcm-1151102-inspection | 共用原則，分標實施分列 |
| PCM綱要時程網圖 | north-pcm-1151102-network | south-pcm-1151102-network | 共用 PCM 主事項 |

**注意：相近名稱不代表重複。** 不因名稱近似就直接刪除南北段原始記錄。完成權責、來源文號、期限、子任務比對後，方可建立相互關聯並遷移。

## 資料移轉安全門檻
- 匯入前以來源 SHA / 來源檔名 / 筆數 / 結構版本備份並校對。
- 每筆舊 ID 映射到新 ID；歷史版次、函號、退回日期及原契約期限不遺失。
- 對未確認正式發文的函稿保留 `evidenceStatus=draft`，不得寫成已正式退回。
- 修正版期限與首次契約期限相互獨立，不自動覆蓋付款核定依據。
- 多人同時修改需交易與版本號衝突檢查，不採用最後寫入無條件覆蓋。
- 資料庫至少分讀取者、承辦編輯者、管理者，RLS 必須限制跨角色寫入。機密管理資料不得直接公開於 GitHub Pages JSON。
- 合併門檻：南北段項目數核對、歷程保留、契約／KPI／審查去重、長官承辦一致、回歸測試與手機平板呈現全部通過。

## 當前完成與尚待
- 已完成：開發分支、共同最新審查狀態推導、長官與承辦審查列表改讀同一推導、不計入舊版再次逾期、停用本機專案資料保存、未啟用資料庫時唯讀保護。
- 尚待：中央資料庫上線、登入權限／RLS、歷程事件移轉、全案共管去重、主要畫面布局整合、實際瀏覽器／自動測試，以及正式部署。不可視為整案已完成。
