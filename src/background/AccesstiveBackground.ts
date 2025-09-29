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

    // Handle tab updates (URL changes)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab)
    })

    // Handle tab activation (when user switches tabs)
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivation(activeInfo)
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
            console.log('🔍 Background script: Getting current tab URL...')
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            const tab = tabs[0]
            if (tab && tab.url) {
              console.log('✅ Background script: Found active tab URL:', tab.url)
              sendResponse({ success: true, url: tab.url })
            } else {
              console.warn('⚠️ Background script: No active tab found or no URL')
              sendResponse({ success: false, error: 'No active tab found' })
            }
          } catch (error) {
            console.error('❌ Background script: Failed to get tab URL:', error)
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

  private async handleTabUpdate(
    tabId: number, 
    changeInfo: chrome.tabs.TabChangeInfo, 
    tab: chrome.tabs.Tab
  ): Promise<void> {
    try {
      // Handle URL changes for the active tab
      if (changeInfo.url && tab.active && tab.url) {
        console.log('🔄 Tab URL updated:', {
          tabId: tabId,
          oldUrl: changeInfo.url,
          newUrl: tab.url,
          timestamp: new Date().toISOString(),
          changeInfo: changeInfo
        })
        
        // Store the URL change for reload detection
        await this.storeUrlChange(tabId, changeInfo.url, tab.url)
        
        // Notify the sidebar about the URL change
        await this.notifySidebarUrlChange(tab.url)
        
        // Also notify the content script
        try {
          await chrome.tabs.sendMessage(tabId, { 
            action: 'urlChanged',
            url: tab.url 
          })
          console.log('✅ Content script notified about URL change')
        } catch (error) {
          // Content script might not be loaded yet, this is okay
          console.log('⚠️ Content script not ready for URL change notification')
        }
      }
      
      // Handle page reload completion (status becomes 'complete')
      if (changeInfo.status === 'complete' && tab.active && tab.url) {
        console.log('📄 Page reload completed:', {
          tabId: tabId,
          url: tab.url,
          timestamp: new Date().toISOString()
        })
        
        // Check if this is a reload after URL change and trigger rescan
        await this.handlePageReloadComplete(tabId, tab.url)
      }
    } catch (error) {
      console.error('❌ Error handling tab update:', error)
    }
  }

  private async handleTabActivation(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
    try {
      // Get the active tab details
      const tab = await chrome.tabs.get(activeInfo.tabId)
      
      if (tab.url) {
        console.log('Tab activated:', tab.url)
        
        // Notify the sidebar about the URL change
        await this.notifySidebarUrlChange(tab.url)
      }
    } catch (error) {
      console.error('Error handling tab activation:', error)
    }
  }

  private async notifySidebarUrlChange(url: string): Promise<void> {
    try {
      console.log('📡 Notifying sidebar about URL change:', {
        url: url,
        timestamp: new Date().toISOString()
      })
      
      // Send message to all sidebars (there should only be one active)
      // We'll use the runtime message to reach the sidebar
      chrome.runtime.sendMessage({ 
        action: 'tabUrlChanged',
        url: url 
      }).then(() => {
        console.log('✅ Sidebar URL change notification sent successfully')
      }).catch((error) => {
        // This is expected if no sidebar is listening
        console.log('⚠️ No sidebar listening for URL change notification:', error)
      })
    } catch (error) {
      console.error('❌ Error notifying sidebar of URL change:', error)
    }
  }

  private async storeUrlChange(tabId: number, oldUrl: string, newUrl: string): Promise<void> {
    try {
      // Store URL change information to detect reloads
      const urlChangeData = {
        tabId: tabId,
        oldUrl: oldUrl,
        newUrl: newUrl,
        timestamp: Date.now(),
        needsRescan: true
      }
      
      await chrome.storage.local.set({
        [`urlChange_${tabId}`]: urlChangeData
      })
      
      console.log('💾 Stored URL change for reload detection:', urlChangeData)
    } catch (error) {
      console.error('❌ Error storing URL change:', error)
    }
  }

  private async handlePageReloadComplete(tabId: number, currentUrl: string): Promise<void> {
    try {
      // Check if there's a stored URL change for this tab
      const result = await chrome.storage.local.get([`urlChange_${tabId}`])
      const urlChangeData = result[`urlChange_${tabId}`]
      
      if (urlChangeData && urlChangeData.needsRescan && urlChangeData.newUrl === currentUrl) {
        console.log('🔄 Detected page reload after URL change, triggering rescan:', {
          tabId: tabId,
          url: currentUrl,
          previousUrl: urlChangeData.oldUrl,
          timestamp: new Date().toISOString()
        })
        
        // Clear the stored URL change to prevent duplicate scans
        await chrome.storage.local.remove([`urlChange_${tabId}`])
        
        // Wait a bit for the page to fully load and then trigger rescan
        setTimeout(async () => {
          try {
            // Notify sidebar to trigger rescan
            await this.notifySidebarRescan(currentUrl)
            
            // Also notify content script if available
            try {
              await chrome.tabs.sendMessage(tabId, { 
                action: 'triggerRescan',
                url: currentUrl 
              })
              console.log('✅ Content script notified to trigger rescan')
            } catch (error) {
              console.log('⚠️ Content script not ready for rescan notification')
            }
          } catch (error) {
            console.error('❌ Error triggering rescan after reload:', error)
          }
        }, 2000) // Wait 2 seconds for page to fully stabilize
      }
    } catch (error) {
      console.error('❌ Error handling page reload complete:', error)
    }
  }

  private async notifySidebarRescan(url: string): Promise<void> {
    try {
      console.log('🔄 Notifying sidebar to trigger rescan after reload:', {
        url: url,
        timestamp: new Date().toISOString()
      })
      
      // Send message to sidebar to trigger rescan
      chrome.runtime.sendMessage({ 
        action: 'triggerRescanAfterReload',
        url: url 
      }).then(() => {
        console.log('✅ Sidebar rescan notification sent successfully')
      }).catch((error) => {
        console.log('⚠️ No sidebar listening for rescan notification:', error)
      })
    } catch (error) {
      console.error('❌ Error notifying sidebar to rescan:', error)
    }
  }
}
