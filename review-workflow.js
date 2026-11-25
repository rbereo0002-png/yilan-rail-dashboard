// Current-state projection only. Historical records are never replaced by display state.
// A draft review letter is not evidence of an issued return or a binding correction due date.
const utcDays=(from,to)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
const isDraftEvidence = value=>/函稿|草稿|擬稿|待確認|待核定|待決行|發文完成待確認|正式發文字號待確認/.test(String(value||''));
export function currentReviewState(record={},base={},today=''){
  const version=String(record.currentVersion||'A').trim();
  const history=Array.isArray(record.history)?record.history:[];
  const last=history.at(-1)||{};
  const submitted=record.currentSubmittedDate||'';
  const approval=record.currentApprovalDate||'';
  const returnDate=record.currentReturnedDate||last.reviewLetterDate||'';
  const returnRef=record.currentReturnRef||last.reviewLetterNumber||'';
  const draftReturn=Boolean(returnDate && !record.currentReturnedDate && isDraftEvidence(returnRef));
  const evidenceStatus=record.returnEvidenceStatus || (draftReturn?'draft':returnDate?'unverified':'not-applicable');
  const due=record.currentDue||base.contractDue||'';
  const activeAction=record.activeReview||null;
  const actionDue=activeAction?.dueDate||'';
  const actionStatus=activeAction?.status||'';
  const actionDeadlineConfirmed=activeAction?.deadlineConfirmed!==false;
  const actionEvidenceStatus=activeAction?.evidenceStatus||'unverified';
  const actionSource=activeAction?.source||'';
  const actionType=activeAction?.type||'';
  const actionCompleted=Boolean(activeAction?.completedDate);
  const actionOverdueDays=!actionCompleted && actionDue && today && actionDue<today && actionDeadlineConfirmed ? utcDays(actionDue,today):0;
  const dueKind=history.length>0 || version!=='A'?'revision':'contract';
  const deadlineConfirmed=dueKind==='contract' || record.deadlineConfirmed===true || (evidenceStatus==='issued' && record.deadlineConfirmed!==false);
  const overdueDays=!submitted && !approval && deadlineConfirmed && due && today && due<today?utcDays(due,today):0;
  let code,label;
  if(approval){code='approved';label=version+'版已核定';}
  else if(submitted){code='under-review';label=actionStatus || version+'版已提送／審查中';}
  else if(dueKind==='revision'){
    code=overdueDays>0?'revision-overdue':'awaiting-revision';
    label='待提送'+version+'版'+(overdueDays>0?'（修正逾期'+overdueDays+'日）':'');
    if(!deadlineConfirmed)label+='（修正期限待正式確認）';
  } else {
    code=overdueDays>0?'initial-overdue':'awaiting-initial';
    label='待首次提送'+(overdueDays>0?'（逾期'+overdueDays+'日）':'');
  }
  return {version,code,label,due,dueKind,deadlineConfirmed,evidenceStatus,
    actionDue,actionStatus,actionSource,actionType,actionCompleted,actionOverdueDays,actionDeadlineConfirmed,actionEvidenceStatus,
    submitted,approval,returnDate,returnRef,overdueDays,
    contractDue:base.contractDue||record.contractDue||'',
    initialSubmit:base.actualSubmit||history[0]?.submittedDate||'',originalApproval:base.actualApproval||'',history};
}
export function latestReviewItems(project,schedule,today){
  const tracking=project.versionTracking||{};
  return Object.entries(tracking).map(([id,record])=>({
    id,name:record.name||schedule.model[id]?.name||id,
    ...currentReviewState(record,schedule.model[id]||{},today)
  }));
}

export function currentReviewGanttRows(model){
  return (model.currentReviews||[]).map(x=>{
    const chartEnd=x.approval||x.actionDue||x.submitted||x.due;
    const chartStart=x.returnDate||x.initialSubmit||x.submitted||x.contractDue||chartEnd;
    const start=chartStart && chartEnd && chartStart>chartEnd ? chartEnd : chartStart;
    return {id:'current-review-'+x.id,group:'現行審查版本',
      name:x.name+'（'+x.version+'版）',baselineStart:start,baselineDue:chartEnd,
      forecastStart:start,forecastDue:chartEnd,
      actualApproval:x.approval||'',effectiveApproval:x.approval||'',
      status:{text:x.label,cls:(x.overdueDays>0||x.actionOverdueDays>0)?'tl-danger':'tl-normal'},
      dueType:x.actionDue?'management':x.deadlineConfirmed?(x.dueKind==='contract'?'contract':'management'):'external',
      isReviewVersion:true};
  });
}
