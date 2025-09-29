/**
 * Accesstive - Live Audit Extension
 * Main Audit Entry Point
 */

import { NsaAuditAccesstive } from './nsaAudit'

// Get API URL from environment or use default
const apiUrl = import.meta.env.VITE_AUDIT_URL || 'http://localhost:3200/nsa-accesstive'

// Initialize the audit system
console.log('====================================');
console.log(apiUrl);
console.log('====================================');
const auditManager = new NsaAuditAccesstive(apiUrl)

// Export for global access if needed
;(window as any).nsaAuditManager = auditManager

console.log('Accesstive audit system initialized')
