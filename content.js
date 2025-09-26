/**
 * Accesstive - Accessibility Audit Extension
 * Content Script
 */

class AccesstiveContentScript {
  constructor() {
    this.isInitialized = false;
    this.settings = {
      language: 'en',
      standard: 'wcag21aa'
    };
    this.init();
  }

  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadSettings();
      this.setupMessageListeners();
      this.isInitialized = true;
      
      // Notify background script that content script is ready
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'contentScriptReady' });
      }
    } catch (error) {
      console.error('Failed to initialize content script:', error);
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'ping':
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get();
      this.settings = { ...this.settings, ...result };
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
}

// Initialize the content script
new AccesstiveContentScript();