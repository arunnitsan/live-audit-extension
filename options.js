/**
 * Accesstive - Accessibility Audit Extension
 * Options Page Script
 */

class AccesstiveOptions {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    const resetBtn = document.getElementById('reset-settings');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetSettings());
    }

    // Test button for sidebar
    const testSidebarBtn = document.getElementById('test-sidebar');
    if (testSidebarBtn) {
      testSidebarBtn.addEventListener('click', () => this.testSidebar());
    }

  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get();
      this.populateForm(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  populateForm(settings) {
    const languageSelect = document.getElementById('language');
    if (languageSelect) {
      languageSelect.value = settings.language || 'en';
    }

    const standardSelect = document.getElementById('standard');
    if (standardSelect) {
      standardSelect.value = settings.standard || 'wcag21aa';
    }

  }

  async saveSettings() {
    try {
      const settings = this.collectFormData();
      await chrome.storage.sync.set(settings);
      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  collectFormData() {
    const languageSelect = document.getElementById('language');
    const standardSelect = document.getElementById('standard');

    return {
      language: languageSelect ? languageSelect.value : 'en',
      standard: standardSelect ? standardSelect.value : 'wcag21aa'
    };
  }

  async resetSettings() {
    try {
      await chrome.storage.sync.clear();
      this.populateForm({ language: 'en', standard: 'wcag21aa' });
      this.showStatus('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showStatus('Failed to reset settings', 'error');
    }
  }

  async testSidebar() {
    try {
      // Open sidebar directly (user gesture required)
      if (chrome.sidePanel) {
        const window = await chrome.windows.getCurrent();
        if (window) {
          await chrome.sidePanel.open({ windowId: window.id });
          this.showStatus('Sidebar opened successfully', 'success');
        } else {
          this.showStatus('No current window found', 'error');
        }
      } else {
        this.showStatus('Side panel API not available', 'error');
      }
    } catch (error) {
      console.error('Failed to test sidebar:', error);
      this.showStatus('Failed to open sidebar: ' + error.message, 'error');
    }
  }


  showStatus(message, type) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status status--${type}`;
      statusElement.style.display = 'block';

      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
}

// Initialize options when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AccesstiveOptions();
});