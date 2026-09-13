// Date-only values throughout the domain. UTC is arithmetic, not a user timezone.
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
}
export function addDays(value, days) {
  if (!value || days == null) return null;
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) : null;
}
export function isHoliday(value, holidays = []) {
  if (!value) return false;
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 || holidays.includes(value);
}
export function addWorkdays(value, count, holidays = []) {
  if (!value) return null;
  let date = value;
  for (let n = 0; n < count;) {
    date = addDays(date, 1);
    if (!isHoliday(date, holidays)) n++;
  }
  return date;
}
export const formatDate = value => value ? value.replaceAll('-', '/') : '—';
export function todayLocal(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export const SIGN_DATE_WARNING = '實際簽約日不可晚於今日；目前仍以簽約基準日作管理預估。';
export function signingState(actualSignDate, today = todayLocal()) {
  const effective = validDate(actualSignDate) && actualSignDate <= today;
  const future = validDate(actualSignDate) && actualSignDate > today;
  return {effective, future, status:effective ? '履約管制中' : future ? '實際簽約日尚未生效' : '尚未登錄實際簽約'};
}
