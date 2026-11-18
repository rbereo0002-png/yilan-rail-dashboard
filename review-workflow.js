// Single current-state projection for a deliverable's review lifecycle.
// Historical revisions remain queryable; they never become a second current task.
export function currentReviewState(record = {}, base = {}, today = '') {
  const version = String(record.currentVersion || 'A').trim();
  const history = Array.isArray(record.history) ? record.history : [];
  const last = history.at(-1) || {};
  const submitted = record.currentSubmittedDate || '';
  const due = record.currentDue || base.contractDue || '';
  const approval = record.currentApprovalDate || '';
  const returned = record.currentReturnedDate || '';
  const lastReturn = last.reviewLetterDate || '';
  const isRevision = history.length > 0 || version !== 'A';
  const overdueDays = !submitted && due && today && due < today
    ? Math.round((Date.parse(today+'T00:00:00Z') - Date.parse(due+'T00:00:00Z')) / 86400000) : 0;
  let code, label;
  if (approval) { code='approved'; label=version+'版已核定'; }
  else if (submitted) { code='under-review'; label=version+'版已提送／審查中'; }
  else if (isRevision) { code=overdueDays>0?'revision-overdue':'awaiting-revision'; label='待提送'+version+'版'+(overdueDays>0?'（逾期'+overdueDays+'日）':''); }
  else { code=overdueDays>0?'initial-overdue':'awaiting-initial'; label='待首次提送'+(overdueDays>0?'（逾期'+overdueDays+'日）':''); }
  return {version,code,label,due,submitted,approval,returnDate:returned || (isRevision?lastReturn:''),overdueDays,
    contractDue:base.contractDue || record.contractDue || '',initialSubmit:base.actualSubmit || history[0]?.submittedDate || '',
    history};
}
export function latestReviewItems(project, schedule, today) {
  const tracking = project.versionTracking || {};
  return Object.entries(tracking).map(([id, record]) => {
    const base=schedule.model[id] || {};
    return {id,name:base.name || id,...currentReviewState(record,base,today)};
  });
}
