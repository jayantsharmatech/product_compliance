import Dexie from 'dexie';

export const db = new Dexie('LegalMetrologyOfflineDB');

db.version(1).stores({
  pendingScans: '++id, tempId, imageBlob, extractedData, complianceScore, syncStatus, createdAt',
  scanHistory: 'id, productName, complianceScore, isExpired, scannedAt'
});

export async function saveScanOffline(extractedData, imageBlob, complianceScore) {
  const tempId = `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const recordId = await db.pendingScans.add({
    tempId: tempId,
    imageBlob: imageBlob,
    extractedData: extractedData,
    complianceScore: complianceScore || 0,
    syncStatus: 'PENDING',
    createdAt: new Date().toISOString()
  });
  return { recordId, tempId };
}

export async function getPendingScans() {
  return await db.pendingScans
    .where('syncStatus')
    .equals('PENDING')
    .toArray();
}

export async function markScanSynced(recordId) {
  return await db.pendingScans.update(recordId, {
    syncStatus: 'SYNCED',
    syncedAt: new Date().toISOString()
  });
}