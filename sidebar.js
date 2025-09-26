/**
 * Accesstive - Live Audit Widget
 * Sidebar Script for Chrome Extension
 * 
 * This file provides minimal functionality to open the sidebar.
 * The main functionality is handled by audit.js
 */

class AccesstiveSidebarWidget {
  constructor() {
    this.init();
  }

  async init() {
    // Clear any existing errors first
    this.clearErrors();
    
    // Wait for DOM to be ready before showing widget
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.showWidget();
      });
    } else {
      // Use a small delay to ensure DOM is fully rendered
      setTimeout(() => {
        this.showWidget();
      }, 100);
    }
    
    // Get active tab URL and add it to the audit script
    await this.setActiveTabUrl();
  }

  clearErrors() {
    // Clear any existing error messages in the console
    console.clear();
  }

  showWidget() {
    // Try to find the widget
    const widget = document.getElementById('nsaAuditWidget');
    
    if (widget) {
      widget.style.display = 'flex';
      widget.style.visibility = 'visible';
      widget.style.opacity = '1';
      return;
    }
    
    // If widget not found, try container
    const container = document.getElementById('nsaAuditWidgetContainer');
    
    if (container) {
      container.style.display = 'flex';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      return;
    }
    
    // If neither found, try to find any element with 'nsa' in the ID
    const nsaElements = document.querySelectorAll('[id*="nsa"]');
    
    if (nsaElements.length > 0) {
      const firstNsaElement = nsaElements[0];
      firstNsaElement.style.display = 'flex';
      firstNsaElement.style.visibility = 'visible';
      firstNsaElement.style.opacity = '1';
      return;
    }
    
    // If still nothing found, retry after a longer delay
    setTimeout(() => {
      const retryWidget = document.getElementById('nsaAuditWidget');
      const retryContainer = document.getElementById('nsaAuditWidgetContainer');
      
      if (retryWidget) {
        retryWidget.style.display = 'flex';
        retryWidget.style.visibility = 'visible';
        retryWidget.style.opacity = '1';
      } else if (retryContainer) {
        retryContainer.style.display = 'flex';
        retryContainer.style.visibility = 'visible';
        retryContainer.style.opacity = '1';
      }
    }, 500);
  }

  async setActiveTabUrl() {
    try {
      // Get current tab - try multiple approaches
      if (!chrome.tabs || !chrome.tabs.query) {
        return;
      }
      
      let tab;
      try {
        // First try to get the active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = tabs[0];
      } catch (error) {
        // If that fails, try to get any tab
        const tabs = await chrome.tabs.query({});
        tab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
      }
      
      if (tab && tab.url) {
        // Find the audit script element
        const auditScript = document.getElementById('nsaAuditScript');
        if (auditScript) {
          // Add the URL as a data attribute
          auditScript.setAttribute('data-tab-url', tab.url);
        }
      }
    } catch (error) {
      console.error('Failed to get active tab URL:', error);
    }
  }

  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close sidebar by sending message to background script
        chrome.runtime.sendMessage({ action: 'closeSidebar' });
      }
    });
  }
}

// Initialize widget when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AccesstiveSidebarWidget();
  });
} else {
  // DOM is already loaded
  new AccesstiveSidebarWidget();
}