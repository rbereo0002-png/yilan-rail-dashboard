export const YilanRules = {
  commonRules: [
    {id:'execPlan',group:'啟動',name:'執行服務計畫書',triggerType:'awardDate',days:30,dayType:'calendar',predecessor:'award',contractRule:true,deadlineClass:'contract',conditional:false,payment:'工程設計10%（累計20%）',note:'契約生效（決標）後30日內提送'},
    {id:'surveyPlan',group:'調查',name:'補充測量工作計畫書',triggerType:'awardDate',days:30,dayType:'calendar',predecessor:'award',contractRule:true,deadlineClass:'contract',conditional:false,note:'契約生效（決標）後30日內提送'},
    {id:'geoPlan',group:'調查',name:'補充地質調查工作計畫書',triggerType:'awardDate',days:30,dayType:'calendar',predecessor:'award',contractRule:true,deadlineClass:'contract',conditional:false,note:'契約生效（決標）後30日內提送'},
    {id:'utilityPlan',group:'調查',name:'管線調查工作計畫書',triggerType:'awardDate',days:30,dayType:'calendar',predecessor:'award',contractRule:true,deadlineClass:'contract',conditional:false,note:'契約生效（決標）後30日內提送'},
    {id:'surveyResult',group:'調查',name:'補充測量成果報告',triggerType:'approvalOf',triggerRef:'surveyPlan',days:120,dayType:'calendar',predecessor:'surveyPlan',contractRule:true,deadlineClass:'dynamic',conditional:false,note:'補充測量工作計畫核定後120日內'},
    {id:'geoResult',group:'調查',name:'補充地質調查成果報告',triggerType:'approvalOf',triggerRef:'geoPlan',days:120,dayType:'calendar',predecessor:'geoPlan',contractRule:true,deadlineClass:'dynamic',conditional:false,note:'補充地質調查工作計畫核定後120日內'},
    {id:'utilityResult',group:'調查',name:'管線調查成果報告',triggerType:'approvalOf',triggerRef:'utilityPlan',days:120,dayType:'calendar',predecessor:'utilityPlan',contractRule:true,deadlineClass:'dynamic',conditional:false,note:'管線調查工作計畫核定後120日內'},
    {id:'designRiskPlan',group:'配套成果',name:'施工風險評估執行服務計畫書',triggerType:'awardDate',days:60,dayType:'calendar',predecessor:'award',contractRule:true,deadlineClass:'contract',conditional:false,note:'契約生效後60日內提送'},
    {id:'basic',group:'設計',name:'基本設計成果初稿',triggerType:'approvalOf',triggerRef:'execPlan',days:150,dayType:'calendar',predecessor:'execPlan',contractRule:true,deadlineClass:'dynamic',conditional:false,payment:'工程設計20%（累計40%）',note:'執行服務計畫書核定後150日內提送'},
    {id:'valueEngineering',group:'配套成果',name:'價值工程研析報告',triggerType:'sameAs',triggerRef:'basic',predecessor:'basic',contractRule:true,deadlineClass:'inherit',conditional:false,note:'併基本設計成果提送'},
    {id:'designRisk',group:'配套成果',name:'設計階段施工風險評估報告',triggerType:'sameAs',triggerRef:'basic',predecessor:'basic',contractRule:true,deadlineClass:'inherit',conditional:false,note:'併基本設計成果提送'},
    {id:'pcc',group:'審議',name:'工程會經費審議核定',triggerType:'externalDate',dateField:'pccDate',predecessor:'basic',contractRule:false,deadlineClass:'external',conditional:false,payment:'工程設計5%（累計45%）',note:'外部審議節點；契約未訂統一固定日數'},
    {id:'final',group:'設計',name:'期末設計成果初稿',triggerType:'basicApprovalOrNotice',triggerRef:'basic',days:300,dayType:'calendar',predecessor:'basic',contractRule:true,deadlineClass:'dynamic',conditional:false,payment:'工程設計40%（累計85%）',note:'基本設計核定後或甲方通知日起300日內提送'},
    {id:'riskFinal',group:'配套成果',name:'施工風險評估／價值工程正式本',triggerType:'sameAs',triggerRef:'final',predecessor:'final',contractRule:true,deadlineClass:'inherit',conditional:false,note:'併期末設計成果提送'},
    {id:'tender',group:'招標',name:'招標文件成果核定',triggerType:'externalDate',dateField:'tenderApprovalDate',predecessor:'final',contractRule:false,deadlineClass:'external',conditional:false,payment:'工程設計5%（累計90%）',note:'付款節點；契約未訂統一固定日數'},
    {id:'worksAward',group:'招標',name:'各分標工程全部決標',triggerType:'externalDate',dateField:'allWorksAwardDate',predecessor:'tender',contractRule:false,deadlineClass:'external',conditional:false,payment:'工程設計5%（累計95%）',note:'依各分標工程決標情形列管'},
    {id:'riskUpdate',group:'施工前置',name:'施工標決標後施工風險簡報／進版更新',triggerType:'eventAfter',triggerRef:'worksAward',predecessor:'worksAward',contractRule:false,deadlineClass:'external',conditional:false,note:'施工標決標後辦理；契約未訂固定日數'},
    {id:'close',group:'完工',name:'全部工程竣工驗收、結算且無待解決事項',triggerType:'externalDate',dateField:'allWorksCloseDate',predecessor:'worksAward',contractRule:false,deadlineClass:'external',conditional:false,payment:'工程設計尾款至100%',note:'契約完成及設計尾款節點'}
  ],
  northExtraRules: [
    {id:'stationData',group:'車站',name:'車站規劃資料蒐集',triggerType:'approvalOf',triggerRef:'execPlan',days:60,dayType:'calendar',predecessor:'execPlan',contractRule:true,deadlineClass:'dynamic',conditional:false,note:'執行服務計畫核定後60日'},
    {id:'stationConcept',group:'車站',name:'車站概念設計',triggerType:'approvalOf',triggerRef:'execPlan',days:120,dayType:'calendar',predecessor:'execPlan',contractRule:true,deadlineClass:'dynamic',conditional:false,note:'執行服務計畫核定後120日'}
  ],
  southExtraRules: [],
  landRules: [
    {id:'rowDrawing',group:'用地',name:'設計完成後路權圖等成果',triggerType:'eventAfter',triggerRef:'final',days:30,dayType:'calendar',predecessor:'final',contractRule:true,deadlineClass:'dynamic',conditional:false,note:'完成設計後30日；「完成設計」之精確起算點尚待確認，現階段僅作管理推估'},
    {id:'tempBoundary',group:'用地',name:'臨時界樁測設',triggerType:'externalNotice',days:30,dayType:'calendar',predecessor:null,contractRule:true,deadlineClass:'external',conditional:false,note:'甲方通知後30日；未輸入通知日以前不自動推算'},
    {id:'permBoundaryPlan',group:'用地',name:'永久路權樁控制點設置計畫',triggerType:'externalNotice',days:10,dayType:'calendar',predecessor:null,contractRule:true,deadlineClass:'external',conditional:false,note:'甲方通知開工後10日；未輸入通知日以前不自動推算'},
    {id:'permBoundary',group:'用地',name:'永久路權樁測設完成',triggerType:'externalNotice',days:280,dayType:'calendar',predecessor:null,contractRule:true,deadlineClass:'external',conditional:false,note:'甲方通知開工後280日；未輸入通知日以前不自動推算'}
  ],
  waterRules: [
    {id:'runoffFinal',group:'水利',name:'出流管制計畫書',triggerType:'conditional',triggerRef:'basic',predecessor:'basic',contractRule:false,deadlineClass:'external',conditional:true,enabled:true,applicability:'pending',note:'條件式工作；依實際適用法令、基地條件及甲方通知辦理，目前不設定固定契約日數。'},
    {id:'soilWaterPlan',group:'水保',name:'水土保持計畫',triggerType:'conditional',triggerRef:'basic',predecessor:'basic',contractRule:false,deadlineClass:'external',conditional:true,enabled:false,applicability:'not-required',note:'目前暫判無水保計畫適用範圍，預設不顯示；後續如確認依法須辦再啟用。'}
  ],
  supervisionRules: [],
  settings:{showSupervision:false,showLandRules:true,showWaterRules:true},
  getRules(projectId, options = {}){
    const all=[...this.commonRules];
    if(projectId==='north') all.push(...this.northExtraRules);
    if(projectId==='south') all.push(...this.southExtraRules);
    if(this.settings.showLandRules) all.push(...this.landRules.filter(rule=>rule.enabled!==false));
    if(this.settings.showWaterRules) all.push(...this.waterRules.filter(rule=>
      rule.enabled!==false || options.enabledRules?.[rule.id] === true));
    return all;
  }
};

// Moved verbatim business values from app.js computePayments; IDs replace row indexes.
export const paymentRules = [
  {paymentId:'design-sign',budgetKey:'design',category:'工程設計',name:'契約簽訂',ratio:10,triggerRef:'sign',designCumulative:10,note:'簽約完成'},
  {paymentId:'survey-plan',budgetKey:'survey',category:'補充測量',name:'工作計畫書經甲方同意',ratio:10,triggerRef:'surveyPlan',note:'先付10%'},
  {paymentId:'geo-plan',budgetKey:'geo',category:'補充地質',name:'工作計畫書經甲方同意',ratio:10,triggerRef:'geoPlan',note:'先付10%'},
  {paymentId:'utility-plan',budgetKey:'utility',category:'管線調查',name:'工作計畫書經甲方同意',ratio:10,triggerRef:'utilityPlan',note:'先付10%'},
  {paymentId:'design-exec',budgetKey:'design',category:'工程設計',name:'執行服務計畫書經甲方同意',ratio:10,triggerRef:'execPlan',designCumulative:20,note:'設計累計20%'},
  {paymentId:'survey-result',budgetKey:'survey',category:'補充測量',name:'正式成果核可／實作結算',ratio:90,triggerRef:'surveyResult',note:'現金流以餘90%上限估算；實際依實作'},
  {paymentId:'geo-result',budgetKey:'geo',category:'補充地質',name:'正式成果核可／實作結算',ratio:90,triggerRef:'geoResult',note:'現金流以餘90%上限估算；實際依實作'},
  {paymentId:'utility-result',budgetKey:'utility',category:'管線調查',name:'正式成果核可／實作結算',ratio:90,triggerRef:'utilityResult',note:'現金流以餘90%上限估算；實際依實作'},
  {paymentId:'design-basic',budgetKey:'design',category:'工程設計',name:'基本設計成果審查核可',ratio:20,triggerRef:'basic',designCumulative:40,note:'設計累計40%'},
  {paymentId:'design-pcc',budgetKey:'design',category:'工程設計',name:'計畫經費審議經工程會核定',ratio:5,triggerRef:'pcc',designCumulative:45,note:'日期未填則不列年度'},
  {paymentId:'design-final',budgetKey:'design',category:'工程設計',name:'期末設計成果審查核可',ratio:40,triggerRef:'final',designCumulative:85,note:'設計累計85%'},
  {paymentId:'design-tender',budgetKey:'design',category:'工程設計',name:'招標文件成果審查核可',ratio:5,triggerRef:'tender',designCumulative:90,note:'設計累計90%'},
  {paymentId:'design-award',budgetKey:'design',category:'工程設計',name:'各分標工程決標完成',ratio:5,triggerRef:'worksAward',designCumulative:95,note:'依各標工程預算比例支付'},
  {paymentId:'design-close',budgetKey:'design',category:'工程設計',name:'全部工程竣工驗收、結算且無待解決事項',ratio:5,triggerRef:'close',designCumulative:100,note:'設計累計100%'}
];

// Existing rowDrawing ambiguity and supervision simulation retained, not new deadlines.
export const calculationPolicy = {managementOnly: ['rowDrawing']};
export const supervisionPaymentRules = {advance:5,progress:93,retention:2,intervalMonths:2};
