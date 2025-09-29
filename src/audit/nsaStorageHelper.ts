// NsaStorageHelper.ts
class NsaStorageHelper {
  private storageKey: string;
  private static globalStorage: Record<string, any> = {};

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  loadSettings(): Record<string, any> {
    const settings = NsaStorageHelper.globalStorage[this.storageKey] || {};
    return settings;
  }

  saveSettings(settings: Record<string, any>): void {
    NsaStorageHelper.globalStorage[this.storageKey] = settings;
  }

  resetSettings(): void {
    delete NsaStorageHelper.globalStorage[this.storageKey];
  }
}

// Example usage: one for settings, one for results
const nsaAuditSettingsStorage = new NsaStorageHelper('nsaAuditSettingsStorage');
const nsaAuditResultStorage = new NsaStorageHelper('nsaAuditResultStorage');

export { nsaAuditSettingsStorage, nsaAuditResultStorage };
