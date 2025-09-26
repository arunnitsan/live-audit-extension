/**
 * Accesstive - Accessibility Audit Extension
 * Background Service Worker
 */

class AccesstiveBackground {
  constructor() {
    this.init();
  }

  init() {
    try {
      // Check if Chrome APIs are available
      if (!chrome || !chrome.runtime) {
        throw new Error('Chrome runtime API not available');
      }
      
      // Setup event listeners
      chrome.runtime.onInstalled.addListener((details) => this.handleInstall(details));
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => this.handleMessage(request, sender, sendResponse));
      
      // Setup context menu
      this.setupContextMenu();
    } catch (error) {
      console.error('Failed to initialize background service worker:', error);
    }
  }

  handleInstall(details) {
    this.setDefaultSettings();
  }

  async setDefaultSettings() {
    const defaultSettings = {
      language: 'en',
      standard: 'wcag21aa',
      showBestPractice: true
    };

    try {
      await chrome.storage.sync.set(defaultSettings);
    } catch (error) {
      console.error('Failed to save default settings:', error);
    }
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'startAudit':
        this.startAuditFromPopup(request.options).then(sendResponse);
        return true;

      case 'stopAudit':
        this.stopAuditFromPopup().then(sendResponse);
        return true;

      case 'getAuditData':
        this.getAuditDataFromPopup().then(sendResponse);
        return true;

      case 'auditResults':
        // Handle audit results from content script
        if (sender.tab && sender.tab.id) {
          this.handleAuditResults(sender.tab.id, request.results);
        }
        sendResponse({ success: true });
        break;

      case 'exportReport':
        this.exportReport(request.data, request.format).then(sendResponse);
        return true;

      case 'highlightViolations':
        this.highlightViolations(request.violations).then(sendResponse);
        return true;

      case 'clearHighlights':
        this.clearHighlights().then(sendResponse);
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  async startAuditFromPopup(options = {}) {
    try {
      // Get the active tab
      if (!chrome.tabs || !chrome.tabs.query) {
        throw new Error('Chrome tabs API not available');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      return await this.startAudit(tab.id, options);
    } catch (error) {
      console.error('Failed to start audit from popup:', error);
      return { success: false, error: error.message };
    }
  }

  async startAudit(tabId, options = {}) {
    try {
      // Try to inject content script if not already loaded
      try {
        await this.ensureContentScriptLoaded(tabId);
        
        // Wait for content script to be ready
        await this.waitForContentScript(tabId);
        
        // Send audit request to content script
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'startAudit',
          options: options
        });

        return response;
      } catch (contentScriptError) {
        
        // Fallback: return a simple audit result
        return {
          success: true,
          results: {
            violations: [
              {
                id: 'content-script-unavailable',
                impact: 'moderate',
                description: 'Content script could not be loaded. Some accessibility checks may be limited.',
                help: 'Please reload the page and try again.',
                helpUrl: 'https://accesstive.org/help',
                category: 'System',
                nodes: [{
                  target: ['body'],
                  html: document.body ? document.body.outerHTML : 'Page content',
                  failureSummary: 'Content script injection failed'
                }]
              }
            ],
            passes: [],
            incomplete: [],
            inapplicable: []
          }
        };
      }
    } catch (error) {
      console.error('Failed to start audit:', error);
      throw error;
    }
  }

  async stopAuditFromPopup() {
    try {
      // Get the active tab
      if (!chrome.tabs || !chrome.tabs.query) {
        throw new Error('Chrome tabs API not available');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      return await this.stopAudit(tab.id);
    } catch (error) {
      console.error('Failed to stop audit from popup:', error);
      return { success: false, error: error.message };
    }
  }

  async stopAudit(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'stopAudit' });
      return { success: true };
    } catch (error) {
      console.error('Failed to stop audit:', error);
      return { success: false, error: error.message };
    }
  }

  async getAuditDataFromPopup() {
    try {
      // Get the active tab
      if (!chrome.tabs || !chrome.tabs.query) {
        throw new Error('Chrome tabs API not available');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      return await this.getAuditData(tab.id);
    } catch (error) {
      console.error('Failed to get audit data from popup:', error);
      return { violations: [], passes: [] };
    }
  }

  async getAuditData(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getAuditData' });
      return response;
    } catch (error) {
      console.error('Failed to get audit data:', error);
      return { violations: [], passes: [] };
    }
  }

  handleAuditResults(tabId, results) {
    this.notifyPopupOfResults(tabId, results);
  }

  async notifyPopupOfResults(tabId, results) {
    // Store results for popup to retrieve
    try {
      await chrome.storage.local.set({
        [`auditResults_${tabId}`]: results
      });
    } catch (error) {
      console.error('Failed to store audit results:', error);
    }
  }

  async ensureContentScriptLoaded(tabId) {
    try {
      // Check if content script is already loaded
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return;
    } catch (error) {
      
      try {
        // Check if scripting API is available
        if (!chrome.scripting) {
          throw new Error('Chrome scripting API not available');
        }
        
        // Try to inject content script manually
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content.css']
        });
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
        throw new Error(`Could not inject content script into page: ${injectError.message}`);
      }
    }
  }

  async waitForContentScript(tabId, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Content script not available after retries');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async exportReport(data, format = 'json') {
    try {
      let content, filename, mimeType;

      switch (format) {
        case 'json':
          content = JSON.stringify(data, null, 2);
          filename = `accesstive-audit-${Date.now()}.json`;
          mimeType = 'application/json';
          break;
        case 'csv':
          content = this.convertToCSV(data);
          filename = `accesstive-audit-${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;
        case 'html':
          content = this.convertToHTML(data);
          filename = `accesstive-audit-${Date.now()}.html`;
          mimeType = 'text/html';
          break;
        default:
          throw new Error('Unsupported format');
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      return { success: true, filename: filename };
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  convertToCSV(data) {
    const headers = ['Rule ID', 'Impact', 'Description', 'Help URL'];
    const rows = [headers.join(',')];

    if (data.violations) {
      data.violations.forEach(violation => {
        const row = [
          `"${violation.id}"`,
          `"${violation.impact}"`,
          `"${violation.description}"`,
          `"${violation.helpUrl}"`
        ];
        rows.push(row.join(','));
      });
    }

    return rows.join('\n');
  }

  convertToHTML(data) {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Accesstive Audit Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .violation { border: 1px solid #ddd; margin: 10px 0; padding: 15px; }
          .critical { border-left: 5px solid #d32f2f; }
          .serious { border-left: 5px solid #f57c00; }
          .moderate { border-left: 5px solid #fbc02d; }
          .minor { border-left: 5px solid #388e3c; }
        </style>
      </head>
      <body>
        <h1>Accesstive Audit Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    `;

    if (data.violations && data.violations.length > 0) {
      html += `<h2>Violations (${data.violations.length})</h2>`;
      data.violations.forEach(violation => {
        html += `
          <div class="violation ${violation.impact}">
            <h3>${violation.id}</h3>
            <p><strong>Impact:</strong> ${violation.impact}</p>
            <p>${violation.description}</p>
            <p><a href="${violation.helpUrl}" target="_blank">Learn more</a></p>
          </div>
        `;
      });
    } else {
      html += '<p>No accessibility issues found!</p>';
    }

    html += '</body></html>';
    return html;
  }

  async highlightViolations(violations) {
    try {
      if (!chrome.tabs || !chrome.tabs.query) {
        throw new Error('Chrome tabs API not available');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: 'highlightViolations',
        violations: violations
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to highlight violations:', error);
      return { success: false, error: error.message };
    }
  }

  async clearHighlights() {
    try {
      if (!chrome.tabs || !chrome.tabs.query) {
        throw new Error('Chrome tabs API not available');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: 'clearHighlights'
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to clear highlights:', error);
      return { success: false, error: error.message };
    }
  }

  setupContextMenu() {
    try {
      if (!chrome.contextMenus) {
        console.warn('Context menus API not available');
        return;
      }
      
      // Remove existing context menu first to avoid duplicate ID error
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'auditPage',
          title: 'Audit this page with Accesstive',
          contexts: ['page']
        });
      });

      chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'auditPage') {
          this.startAudit(tab.id);
        }
      });
    } catch (error) {
      console.error('Failed to setup context menu:', error);
    }
  }
}

// Initialize the background service worker
new AccesstiveBackground();