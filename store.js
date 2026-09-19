import {YilanRules} from './rules.js';
import {validDate} from './dates.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const dateFields = ['noticeDate','pccDate','tenderApprovalDate','allWorksAwardDate','allWorksCloseDate','supervisionStart','constructionStart','constructionEnd','constructionClose'];
export function normalizeProject(input, expectedId) {
  if (!object(input) || !['north','south'].includes(input.id) || (expectedId && input.id !== expectedId)) throw new Error('專案 JSON 的標段不符');
  const p = structuredClone(input);
  if (!object(p.budget)) throw new Error('缺少預算資料');
  for (const key of ['milestones','settings','contract','dates','rows','notices']) {
    if (p[key] != null && !object(p[key])) throw new Error(`${key} 必須為物件`);
    p[key] ||= {};
  }
  p.migrationWarnings = Array.isArray(p.migrationWarnings) ? p.migrationWarnings.filter(x=>typeof x === 'string') : [];
  p.constructionPackages = Array.isArray(p.constructionPackages) ? p.constructionPackages : [];
  p.constructionPackages = p.constructionPackages.map((item,index) => {
    if (!object(item)) throw new Error(`施工分標第 ${index + 1} 筆必須為物件`);
    const pkg = {
      id:String(item.id || `pkg-${index + 1}`),
      code:String(item.code || ''),
      name:String(item.name || ''),
      scope:String(item.scope || ''),
      plannedTenderDate:item.plannedTenderDate || '',
      actualAwardDate:item.actualAwardDate || ''
    };
    if (pkg.plannedTenderDate && !validDate(pkg.plannedTenderDate)) throw new Error(`施工分標預定招標日期格式錯誤：${pkg.code || pkg.id}`);
    if (pkg.actualAwardDate && !validDate(pkg.actualAwardDate)) throw new Error(`施工分標決標日期格式錯誤：${pkg.code || pkg.id}`);
    return pkg;
  });
  p.specialDeliverables = Array.isArray(p.specialDeliverables) ? p.specialDeliverables : [];
  p.specialDeliverables = p.specialDeliverables.map((item,index) => {
    if (!object(item)) throw new Error(`標段特有子成果第 ${index + 1} 筆必須為物件`);
    const deliverable = {
      id:String(item.id || `special-${index + 1}`),
      parentRule:String(item.parentRule || ''),
      name:String(item.name || ''),
      actualSubmitDate:item.actualSubmitDate || '',
      actualApprovalDate:item.actualApprovalDate || '',
      note:String(item.note || '')
    };
    if (!deliverable.parentRule) throw new Error(`標段特有子成果缺少所屬主成果：${deliverable.name || deliverable.id}`);
    if (deliverable.actualSubmitDate && !validDate(deliverable.actualSubmitDate)) throw new Error(`子成果提送日期格式錯誤：${deliverable.name}`);
    if (deliverable.actualApprovalDate && !validDate(deliverable.actualApprovalDate)) throw new Error(`子成果核定日期格式錯誤：${deliverable.name}`);
    return deliverable;
  });
  const date = (obj,key) => {
    obj[key] ??= '';
    if (obj[key] !== '' && !validDate(obj[key])) throw new Error(`日期格式錯誤：${key}`);
  };
  for (const key of ['signDate','actualSignDate','awardDate','evaluationDate','negotiationDate']) date(p.milestones,key);
  for (const key of dateFields) date(p.dates,key);
  for (const key of Object.keys(p.rows)) if (/_submit$|_approval$/.test(key)) date(p.rows,key);
  for (const key of Object.keys(p.notices)) date(p.notices,key);
  for (const rule of YilanRules.getRules(p.id, {enabledRules:{soilWaterPlan:true}})) {
    if (rule.triggerType !== 'externalDate') continue;
    const key = `${rule.id}_approval`, legacy = p.dates[rule.dateField] || '';
    if (p.rows[key] && legacy && p.rows[key] !== legacy) {
      const warning = `${rule.name}有兩個日期，採用成果表核定日；舊值已保留於 legacyDateConflicts。`;
      if (!p.migrationWarnings.includes(warning)) p.migrationWarnings.push(warning);
      p.legacyDateConflicts = {...p.legacyDateConflicts, [rule.dateField]:legacy};
    }
    p.rows[key] = p.rows[key] || legacy;
    p.dates[rule.dateField] = p.rows[key];
  }
  p.settings = {pcmDays:30,payWorkdays:30,forecastMode:'budget',holidays:[],...p.settings};
  for (const key of ['pcmDays','payWorkdays']) {
    const n = Number(p.settings[key]);
    if (!Number.isInteger(n) || n < 0 || n > 3650) throw new Error(`${key} 必須為 0–3650 的整數`);
    p.settings[key] = n;
  }
  if (!['budget','contract'].includes(p.settings.forecastMode)) throw new Error('估算模式錯誤');
  if (!Array.isArray(p.settings.holidays) || p.settings.holidays.some(d => !validDate(d))) throw new Error('非工作日請使用 YYYY-MM-DD');
  for (const key of ['survey','geo','utility','land','design','supervision']) {
    for (const source of ['budget','contract']) {
      p[source][key] ??= p.budget[key] ?? 0;
      if (!Number.isFinite(Number(p[source][key])) || Number(p[source][key]) < 0) throw new Error(`${key} 金額無效`);
      p[source][key] = Number(p[source][key]);
    }
  }
  if (p.settings.enabledRules != null && !object(p.settings.enabledRules)) throw new Error('條件式啟用設定必須為物件');
  p.settings.enabledRules = {soilWaterPlan:false,...p.settings.enabledRules};
  if (typeof p.settings.enabledRules.soilWaterPlan !== 'boolean') throw new Error('水保啟用設定必須為布林值');
  p.schemaVersion = 2;
  return p;
}

export class ProjectStore {
  constructor({catalog, loader, storage, onChange = () => {}, readOnly = false}) {
    Object.assign(this,{catalog,loader,storage,onChange,readOnly});
    this.project = null; this.loading = false; this.error = ''; this.notice = '';
    this.request = 0; this.drafts = new Map(); this.dirty = new Set();
  }
  key(id) { return `yilan-dashboard-${id}`; }
  emit() { this.onChange(this); }
  async setReadOnly(readOnly) {
    const id = this.project?.id || this.selectedId || this.catalog.defaultProject;
    this.readOnly = readOnly;
    // Never present an editing draft as remote public data if the remote fetch fails.
    this.project = null;
    return this.select(id);
  }
  async select(id, {remoteOnly = false} = {}) {
    const entry = this.catalog.projects.find(p => p.id === id);
    if (!entry) { this.error = '找不到標段'; this.emit(); return false; }
    this.selectedId = id;
    const request = ++this.request;
    this.loading = true; this.error = ''; this.notice = ''; this.emit();
    try {
      let data;
      if (!this.readOnly && !remoteOnly && this.drafts.has(id)) data = this.drafts.get(id);
      else {
        data = normalizeProject(await this.loader(entry.data), id);
        if (request !== this.request) return false;
        if (!this.readOnly && !remoteOnly) {
          try {
            const saved = this.storage?.getItem(this.key(id));
            if (saved) data = normalizeProject(JSON.parse(saved), id);
          } catch (error) { this.notice = `本機資料未套用：${error.message}；已載入遠端資料。`; }
        }
      }
      if (request !== this.request) return false;
      this.project = normalizeProject(data, id);
      if (!this.readOnly) this.drafts.set(id,this.project);
      this.loading = false;
      try { this.storage?.setItem('yilan-dashboard-last-project',id); } catch { this.notice = '瀏覽器無法記住標段；目前資料仍可使用。'; }
      this.emit(); return true;
    } catch (error) {
      if (request !== this.request) return false;
      this.loading = false; this.error = `載入失敗：${error.message}`; this.emit(); return false;
    }
  }
  edit(mutator) {
    if (this.readOnly || this.loading || !this.project) return false;
    const next = structuredClone(this.project);
    mutator(next);
    this.project = normalizeProject(next,this.project.id);
    this.drafts.set(this.project.id,this.project); this.dirty.add(this.project.id);
    this.error = ''; this.emit(); return true;
  }
  importProject(data) {
    if (this.readOnly || this.loading) return false;
    const project = normalizeProject(data);
    if (!this.catalog.projects.some(p => p.id === project.id)) throw new Error('匯入標段不在專案清單');
    ++this.request;
    this.project = project; this.drafts.set(project.id,project); this.dirty.add(project.id);
    this.error = ''; this.emit(); return true;
  }
  save() {
    if (this.readOnly || !this.project || this.loading) return;
    if (!this.storage) throw new Error('此瀏覽器無法儲存本機資料，請匯出專案 JSON 保存。');
    this.storage.setItem(this.key(this.project.id),JSON.stringify(this.project));
    this.dirty.delete(this.project.id); this.notice = '已儲存在此瀏覽器。'; this.emit();
  }
  async reset() {
    if (this.readOnly || !this.project || this.loading) return;
    const id = this.project.id;
    // Do not erase the saved copy until the remote replacement loads successfully.
    if (await this.select(id,{remoteOnly:true})) {
      this.storage?.removeItem(this.key(id)); this.dirty.delete(id); this.emit();
    }
  }
}
