// Load the pinned browser bundle only when an export is requested.
let pending;
export async function loadExcelLibrary() {
  pending ||= import('./vendor/exceljs-4.4.0.min.js').catch(error => {
    pending = null;
    throw new Error(`Excel 套件載入失敗，請重新整理後再試：${error.message}`);
  });
  await pending;
  if (!globalThis.ExcelJS?.Workbook) throw new Error('Excel 套件未正確載入');
  return globalThis.ExcelJS;
}
