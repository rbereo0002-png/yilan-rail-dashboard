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
export function todayTaipei() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
