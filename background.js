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
      
      // Setup action click listener
      if (chrome.action && chrome.action.onClicked) {
        chrome.action.onClicked.addListener((tab) => this.handleActionClick(tab));
      }
      
      // Setup context menu
      this.setupContextMenu();
    } catch (error) {
      console.error('Failed to initialize background service worker:', error);
    }
  }

  handleInstall(details) {
    this.setDefaultSettings();
  }

  handleActionClick(tab) {
    // Always open sidebar (removed tab widget functionality)
    if (!chrome.sidePanel) {
      chrome.runtime.openOptionsPage();
      return;
    }
    
    // Use the tab's window ID directly to maintain user gesture
    if (tab && tab.windowId) {
      try {
        chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (error) {
        console.error('Failed to open sidebar:', error);
        // Fallback to options page if sidebar fails
        chrome.runtime.openOptionsPage();
      }
    } else {
      // Fallback to options page if no tab info
      chrome.runtime.openOptionsPage();
    }
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
      case 'closeSidebar':
        this.closeSidebar().then(sendResponse);
        return true;

      case 'scanUrl':
        this.scanUrl(request.url, request.options).then(sendResponse);
        return true;

      case 'getScanHistory':
        this.getScanHistory().then(sendResponse);
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }



  async closeSidebar() {
    try {
      if (!chrome.sidePanel) {
        throw new Error('Side panel API not available');
      }
      
      // Side panel doesn't have a direct close method, but we can notify the sidebar
      return { success: true };
    } catch (error) {
      console.error('Failed to close sidebar:', error);
      return { success: false, error: error.message };
    }
  }



  async scanUrl(url, options = {}) {
    try {
      // Validate URL
      if (!url || !this.isValidUrl(url)) {
        throw new Error('Invalid URL provided');
      }

      // Create a new tab for scanning
      const tab = await chrome.tabs.create({ 
        url: url, 
        active: false 
      });

      // Wait for tab to load
      await this.waitForTabLoad(tab.id);

      // Store scan data
        const scanData = {
          url: url,
          timestamp: Date.now(),
          options: options
        };

        // Save to scan history
        await this.saveScanToHistory(scanData);

        // Close the scanning tab
        await chrome.tabs.remove(tab.id);

        return {
          success: true,
          url: url,
          timestamp: scanData.timestamp
        };

    } catch (error) {
      console.error('URL scan failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getScanHistory() {
    try {
      const result = await chrome.storage.local.get('scanHistory');
      const history = result.scanHistory || [];
      
      // Sort by timestamp (newest first)
      history.sort((a, b) => b.timestamp - a.timestamp);
      
      return { success: true, history: history };
    } catch (error) {
      console.error('Failed to get scan history:', error);
      return { success: false, error: error.message };
    }
  }

  async saveScanToHistory(scanData) {
    try {
      const result = await chrome.storage.local.get('scanHistory');
      const history = result.scanHistory || [];
      
      // Add new scan
      history.unshift(scanData);
      
      // Keep only last 50 scans
      if (history.length > 50) {
        history.splice(50);
      }
      
      await chrome.storage.local.set({ scanHistory: history });
    } catch (error) {
      console.error('Failed to save scan to history:', error);
    }
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }


  async waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          
          if (tab.status === 'complete') {
            resolve();
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error('Tab load timeout'));
            return;
          }
          
          setTimeout(checkTab, 100);
        } catch (error) {
          reject(error);
        }
      };
      
      checkTab();
    });
  }

  setupContextMenu() {
    try {
      if (!chrome.contextMenus) {
        return;
      }
      
      // Remove existing context menu first to avoid duplicate ID error
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'auditPage',
          title: 'Open Accesstive Sidebar',
          contexts: ['page']
        });
        
        chrome.contextMenus.create({
          id: 'openSidebar',
          title: 'Open Accesstive Sidebar',
          contexts: ['page']
        });
      });

      chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === 'auditPage' || info.menuItemId === 'openSidebar') {
          // Open sidebar in response to user gesture
          try {
            if (!chrome.sidePanel) {
              throw new Error('Side panel API not available');
            }
            
            const window = await chrome.windows.getCurrent();
            if (window) {
              await chrome.sidePanel.open({ windowId: window.id });
            }
          } catch (error) {
            console.error('Failed to open sidebar from context menu:', error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to setup context menu:', error);
    }
  }
}

// Initialize the background service worker
new AccesstiveBackground();