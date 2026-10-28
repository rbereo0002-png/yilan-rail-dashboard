// Shared topic classification; retain source IDs, categories and recorded dates.
export const isTransferControl = item =>
  /(?:同|共)月[台臺]轉乘/.test([item.name,item.source,item.note].filter(Boolean).join(' '));
export const transferStatus = item => item.status || item.computedStatus;
