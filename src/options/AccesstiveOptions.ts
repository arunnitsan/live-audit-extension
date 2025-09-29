/**
 * Accesstive - Live Audit Extension
 * Options Page Class
 */

export class AccesstiveOptions {
  private form: HTMLFormElement | null = null
  private statusElement: HTMLElement | null = null

  constructor() {
    this.init()
  }

  private async init(): Promise<void> {
    try {
      this.cacheElements()
      this.setupEventListeners()
      await this.loadSettings()
      
      console.log('Options page initialized')
    } catch (error) {
      console.error('Failed to initialize options page:', error)
    }
  }

  private cacheElements(): void {
    this.form = document.getElementById('accesstive-options-form') as HTMLFormElement
    this.statusElement = document.getElementById('accesstive-status')
  }

  private setupEventListeners(): void {
    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault()
        this.saveSettings()
      })
    }

    // Add event listeners for individual form elements
    const saveButton = document.getElementById('save-settings')
    if (saveButton) {
      saveButton.addEventListener('click', () => this.saveSettings())
    }

    const resetButton = document.getElementById('reset-settings')
    if (resetButton) {
      resetButton.addEventListener('click', () => this.resetSettings())
    }

    const testButton = document.getElementById('test-sidebar')
    if (testButton) {
      testButton.addEventListener('click', () => this.testSidebar())
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['settings'])
      const settings = result.settings || {}
      
      this.populateForm(settings)
    } catch (error) {
      console.error('Failed to load settings:', error)
      this.showStatus('Failed to load settings', 'error')
    }
  }

  private populateForm(settings: Record<string, any>): void {
    // Language setting
    const languageSelect = document.getElementById('language') as HTMLSelectElement
    if (languageSelect && settings.language) {
      languageSelect.value = settings.language
    }

    // Standard setting
    const standardSelect = document.getElementById('standard') as HTMLSelectElement
    if (standardSelect && settings.standard) {
      standardSelect.value = settings.standard
    }

    // Theme setting
    const themeSelect = document.getElementById('theme') as HTMLSelectElement
    if (themeSelect && settings.theme) {
      themeSelect.value = settings.theme
    }

    // Show best practice setting
    const bestPracticeCheckbox = document.getElementById('showBestPractice') as HTMLInputElement
    if (bestPracticeCheckbox) {
      bestPracticeCheckbox.checked = settings.showBestPractice !== false
    }

    // Auto scan setting
    const autoScanCheckbox = document.getElementById('autoScan') as HTMLInputElement
    if (autoScanCheckbox) {
      autoScanCheckbox.checked = settings.autoScan !== false
    }

    // Notifications setting
    const notificationsCheckbox = document.getElementById('notifications') as HTMLInputElement
    if (notificationsCheckbox) {
      notificationsCheckbox.checked = settings.notifications !== false
    }

    // Impact filters
    const impactFilters = settings.impactFilters || {}
    Object.keys(impactFilters).forEach(impact => {
      const checkbox = document.getElementById(`impact-${impact}`) as HTMLInputElement
      if (checkbox) {
        checkbox.checked = impactFilters[impact]
      }
    })
  }

  private async saveSettings(): Promise<void> {
    try {
      const settings = this.collectFormData()
      
      await chrome.storage.sync.set({ settings })
      
      this.showStatus('Settings saved successfully!', 'success')
      
      // Notify other parts of the extension about settings change
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings })
      
    } catch (error) {
      console.error('Failed to save settings:', error)
      this.showStatus('Failed to save settings', 'error')
    }
  }

  private collectFormData(): Record<string, any> {
    const formData: Record<string, any> = {}

    // Language
    const languageSelect = document.getElementById('language') as HTMLSelectElement
    if (languageSelect) {
      formData.language = languageSelect.value
    }

    // Standard
    const standardSelect = document.getElementById('standard') as HTMLSelectElement
    if (standardSelect) {
      formData.standard = standardSelect.value
    }

    // Theme
    const themeSelect = document.getElementById('theme') as HTMLSelectElement
    if (themeSelect) {
      formData.theme = themeSelect.value
    }

    // Show best practice
    const bestPracticeCheckbox = document.getElementById('showBestPractice') as HTMLInputElement
    if (bestPracticeCheckbox) {
      formData.showBestPractice = bestPracticeCheckbox.checked
    }

    // Auto scan
    const autoScanCheckbox = document.getElementById('autoScan') as HTMLInputElement
    if (autoScanCheckbox) {
      formData.autoScan = autoScanCheckbox.checked
    }

    // Notifications
    const notificationsCheckbox = document.getElementById('notifications') as HTMLInputElement
    if (notificationsCheckbox) {
      formData.notifications = notificationsCheckbox.checked
    }

    // Impact filters
    formData.impactFilters = {}
    const impactTypes = ['critical', 'serious', 'moderate', 'minor', 'passed']
    impactTypes.forEach(impact => {
      const checkbox = document.getElementById(`impact-${impact}`) as HTMLInputElement
      if (checkbox) {
        formData.impactFilters[impact] = checkbox.checked
      }
    })

    return formData
  }

  private async resetSettings(): Promise<void> {
    try {
      if (confirm('Are you sure you want to reset all settings to default values?')) {
        await chrome.storage.sync.clear()
        
        // Reload the page to show default values
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to reset settings:', error)
      this.showStatus('Failed to reset settings', 'error')
    }
  }

  private async testSidebar(): Promise<void> {
    try {
      // Open a new tab with a test page
      const testUrl = 'https://example.com'
      const tab = await chrome.tabs.create({ url: testUrl })
      
      // Wait for the tab to load
      await this.waitForTabLoad(tab.id!)
      
      // Open the sidebar
      await chrome.sidePanel.open({ tabId: tab.id! })
      
      this.showStatus('Test sidebar opened in new tab', 'success')
    } catch (error) {
      console.error('Failed to test sidebar:', error)
      this.showStatus('Failed to test sidebar', 'error')
    }
  }

  private waitForTabLoad(tabId: number, timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId)
          
          if (tab.status === 'complete') {
            resolve()
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Tab load timeout'))
          } else {
            setTimeout(checkTab, 100)
          }
        } catch (error) {
          reject(error)
        }
      }
      
      checkTab()
    })
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    if (this.statusElement) {
      this.statusElement.textContent = message
      this.statusElement.className = `accesstive-status ${type}`
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.statusElement!.textContent = ''
        this.statusElement!.className = 'accesstive-status'
      }, 3000)
    }
  }
}
