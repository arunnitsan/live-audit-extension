/**
 * Accesstive - Live Audit Extension
 * Background Service Worker Class
 */

export class AccesstiveBackground {
  constructor() {
    this.init()
  }

  private init(): void {
    this.setupEventListeners()
    this.setupContextMenu()
  }

  private setupEventListeners(): void {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details)
    })

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup()
    })

    // Handle action clicks (extension icon)
    chrome.action.onClicked.addListener((tab) => {
      this.handleActionClick(tab)
    })

    // Handle messages from content scripts and other parts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse)
      return true // Keep message channel open for async responses
    })
  }

  private handleInstall(details: chrome.runtime.InstalledDetails): void {
    console.log('Accesstive extension installed:', details.reason)
    
    if (details.reason === 'install') {
      this.setDefaultSettings()
      this.openWelcomePage()
    } else if (details.reason === 'update') {
      this.handleUpdate(details.previousVersion)
    }
  }

  private handleStartup(): void {
    console.log('Accesstive extension started')
    this.setDefaultSettings()
  }

  private async handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
    try {
      if (!tab.id) {
        console.error('No tab ID available')
        return
      }

      // Open the side panel
      await chrome.sidePanel.open({ tabId: tab.id })
      
      // Wait a bit for the side panel to load, then try to send message to content script
      setTimeout(async () => {
        try {
          // First ping the content script to see if it's ready
          const response = await chrome.tabs.sendMessage(tab.id!, { action: 'ping' })
          if (response?.success) {
            // Content script is ready, send the initialize message
            await chrome.tabs.sendMessage(tab.id!, { 
              action: 'initializeAudit',
              url: tab.url 
            })
          }
        } catch (messageError) {
          console.log('Content script not ready yet, will retry when needed')
          // Don't treat this as an error since the content script might not be loaded yet
        }
      }, 100)
    } catch (error) {
      console.error('Error handling action click:', error)
    }
  }

  private async handleMessage(
    request: any, 
    _sender: chrome.runtime.MessageSender, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (request.action) {
        case 'ping':
          sendResponse({ success: true, timestamp: Date.now() })
          break

        case 'closeSidebar':
          await this.closeSidebar()
          sendResponse({ success: true })
          break

        case 'scanUrl':
          const result = await this.scanUrl(request.url, request.options)
          sendResponse({ success: true, data: result })
          break

        case 'getScanHistory':
          const history = await this.getScanHistory()
          sendResponse({ success: true, data: history })
          break

        case 'saveScanResult':
          await this.saveScanToHistory(request.data)
          sendResponse({ success: true })
          break

        case 'openOptions':
          await chrome.runtime.openOptionsPage()
          sendResponse({ success: true })
          break

        case 'getCurrentTabUrl':
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            const tab = tabs[0]
            if (tab && tab.url) {
              sendResponse({ success: true, url: tab.url })
            } else {
              sendResponse({ success: false, error: 'No active tab found' })
            }
          } catch (error) {
            sendResponse({ success: false, error: 'Failed to get tab URL' })
          }
          break

        default:
          sendResponse({ success: false, error: 'Unknown action' })
      }
    } catch (error) {
      console.error('Error handling message:', error)
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async setDefaultSettings(): Promise<void> {
    try {
      const defaultSettings = {
        language: 'en',
        standard: 'wcag21aa',
        theme: 'dark',
        showBestPractice: true,
        impactFilters: {
          critical: true,
          serious: true,
          moderate: true,
          minor: true,
          passed: false
        },
        selectedDisability: 'all',
        autoScan: true,
        notifications: true
      }

      await chrome.storage.sync.set({ settings: defaultSettings })
      console.log('Default settings applied')
    } catch (error) {
      console.error('Error setting default settings:', error)
    }
  }

  private async handleUpdate(previousVersion?: string): Promise<void> {
    console.log('Extension updated from version:', previousVersion)
    
    // Handle any migration logic here
    if (previousVersion && this.isVersionOlder(previousVersion, '1.0.0')) {
      await this.migrateSettings()
    }
  }

  private isVersionOlder(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0
      
      if (v1Part < v2Part) return true
      if (v1Part > v2Part) return false
    }
    
    return false
  }

  private async migrateSettings(): Promise<void> {
    // Add any settings migration logic here
    console.log('Migrating settings...')
  }

  private async openWelcomePage(): Promise<void> {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('options.html')
      })
    } catch (error) {
      console.error('Error opening welcome page:', error)
    }
  }

  private async closeSidebar(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'closeSidebar' })
      }
    } catch (error) {
      console.error('Error closing sidebar:', error)
    }
  }

  private async scanUrl(url: string, _options: any = {}): Promise<any> {
    try {
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL provided')
      }

      // This would typically call your audit API
      // For now, return mock data
      return {
        url,
        timestamp: Date.now(),
        issues: [],
        score: 100,
        status: 'completed'
      }
    } catch (error) {
      console.error('Error scanning URL:', error)
      throw error
    }
  }

  private async getScanHistory(): Promise<any[]> {
    try {
      const result = await chrome.storage.local.get(['scanHistory'])
      return result.scanHistory || []
    } catch (error) {
      console.error('Error getting scan history:', error)
      return []
    }
  }

  private async saveScanToHistory(scanData: any): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['scanHistory'])
      const history = result.scanHistory || []
      
      history.unshift({
        ...scanData,
        id: Date.now().toString(),
        timestamp: Date.now()
      })
      
      // Keep only last 50 scans
      if (history.length > 50) {
        history.splice(50)
      }
      
      await chrome.storage.local.set({ scanHistory: history })
    } catch (error) {
      console.error('Error saving scan to history:', error)
    }
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string)
      return true
    } catch (_) {
      return false
    }
  }

  private setupContextMenu(): void {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'audit-page',
        title: 'Audit this page with Accesstive',
        contexts: ['page']
      })

      chrome.contextMenus.create({
        id: 'audit-selection',
        title: 'Audit selected element',
        contexts: ['selection']
      })
    })

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab)
    })
  }

  private async handleContextMenuClick(
    info: chrome.contextMenus.OnClickData, 
    tab?: chrome.tabs.Tab
  ): Promise<void> {
    if (!tab?.id) return

    try {
      switch (info.menuItemId) {
        case 'audit-page':
          await chrome.sidePanel.open({ tabId: tab.id })
          await chrome.tabs.sendMessage(tab.id, { 
            action: 'initializeAudit',
            url: tab.url 
          })
          break

        case 'audit-selection':
          await chrome.sidePanel.open({ tabId: tab.id })
          await chrome.tabs.sendMessage(tab.id, { 
            action: 'auditSelection',
            selectionText: info.selectionText 
          })
          break
      }
    } catch (error) {
      console.error('Error handling context menu click:', error)
    }
  }
}
