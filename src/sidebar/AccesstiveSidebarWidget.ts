/**
 * Accesstive - Live Audit Widget
 * Sidebar Widget Class
 */

import { NsaAuditAccesstive } from '@audit/nsaAudit'
import { NsaWidgetToggle } from '@audit/nsaWidgetToggle'

export class AccesstiveSidebarWidget {
  private auditManager: NsaAuditAccesstive | null = null
  private widgetToggle: NsaWidgetToggle | null = null
  private isInitialized: boolean = false
  private currentTabUrl: string = ''

  constructor() {
    this.init()
    // Expose instance globally for testing (only in development)
    if (typeof window !== 'undefined') {
      (window as any).accesstiveSidebar = this
      console.log('🔧 AccesstiveSidebarWidget exposed globally as window.accesstiveSidebar')
    }
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Clear any existing errors first
      this.clearErrors()
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.initializeWidget()
        })
      } else {
        // Use a small delay to ensure DOM is fully rendered
        setTimeout(() => {
          this.initializeWidget()
        }, 100)
      }
      
      // Get active tab URL and add it to the audit script
      await this.setActiveTabUrl()
      
      // Set up message listener for tab changes
      this.setupMessageListener()
    } catch (error) {
      console.error('Failed to initialize sidebar widget:', error)
    }
  }

  private async initializeWidget(): Promise<void> {
    try {
      console.log('🚀 Initializing Accesstive sidebar widget...')
      
      // Get the current tab URL first - this is critical for the data-tab-url attribute
      await this.setActiveTabUrl()
      
      // Verify the URL was set correctly
      if (!this.currentTabUrl) {
        console.warn('⚠️ No URL set after setActiveTabUrl, retrying...')
        await this.setActiveTabUrl()
      }
      
      // Initialize the widget toggle
      this.widgetToggle = new NsaWidgetToggle()
      
      // Initialize the audit manager
      const apiUrl = this.getApiUrl()
      this.auditManager = new NsaAuditAccesstive(apiUrl)
      
      // Set up tooltips
      this.setupTooltips()
      
      // Set up keyboard navigation
      this.setupKeyboardNavigation()
      
      // Set up message listener for tab changes
      this.setupMessageListener()
      
      // Show the widget
      this.showWidget()
      
      this.isInitialized = true
      console.log('🎉 Sidebar widget initialized successfully')
      console.log('📍 Final current tab URL:', this.currentTabUrl)
    } catch (error) {
      console.error('❌ Error initializing widget:', error)
    }
  }

  private getApiUrl(): string {
    // Get API URL from environment or use default
    const apiUrl = import.meta.env.VITE_AUDIT_URL || 'http://localhost:3200/nsa-accesstive'
    console.log('Using API URL:', apiUrl)
    return apiUrl
  }

  private clearErrors(): void {
    // Clear any existing error messages in the console
    console.clear()
  }

  private showWidget(): void {
    // Try to find the widget
    const widget = document.getElementById('nsaAuditWidget')
    
    if (widget) {
      widget.style.display = 'flex'
      widget.style.visibility = 'visible'
      widget.style.opacity = '1'
      return
    }
    
    // If widget not found, try container
    const container = document.getElementById('nsaAuditWidgetContainer')
    
    if (container) {
      container.style.display = 'flex'
      container.style.visibility = 'visible'
      container.style.opacity = '1'
      return
    }
    
    // If neither found, try to find any element with 'nsa' in the ID
    const nsaElements = document.querySelectorAll('[id*="nsa"]')
    
    if (nsaElements.length > 0) {
      const firstNsaElement = nsaElements[0] as HTMLElement
      firstNsaElement.style.display = 'flex'
      firstNsaElement.style.visibility = 'visible'
      firstNsaElement.style.opacity = '1'
      return
    }
    
    // If still nothing found, retry after a longer delay
    setTimeout(() => {
      const retryWidget = document.getElementById('nsaAuditWidget')
      const retryContainer = document.getElementById('nsaAuditWidgetContainer')
      
      if (retryWidget) {
        retryWidget.style.display = 'flex'
        retryWidget.style.visibility = 'visible'
        retryWidget.style.opacity = '1'
      } else if (retryContainer) {
        retryContainer.style.display = 'flex'
        retryContainer.style.visibility = 'visible'
        retryContainer.style.opacity = '1'
      }
    }, 500)
  }

  private async setActiveTabUrl(): Promise<void> {
    try {
      // Get the URL from the background script instead of directly accessing tabs API
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentTabUrl' })
      if (response?.success && response.url) {
        // Store the URL for use by the audit functionality
        console.log('Current tab URL:', response.url)
        
        // Set the data-tab-url attribute on the script tag
        this.updateScriptUrlAttribute(response.url)
        
        // Store the URL for the audit manager
        this.currentTabUrl = response.url
      } else {
        // No fallback for sidebar - we must get the URL from the background script
        console.warn('Background script did not provide URL. Sidebar cannot determine current tab URL.')
        console.warn('This usually means the extension needs to be reloaded or the background script is not responding.')
        // Don't set a fallback URL for the sidebar - it should always get the actual tab URL
      }
    } catch (error) {
      console.error('Failed to get active tab URL:', error)
      console.error('Sidebar cannot function without the current tab URL. Please reload the extension or check if background script is working.')
      // Don't set a fallback URL - the sidebar should always get the actual tab URL from the background script
    }
  }

  private updateScriptUrlAttribute(url: string): void {
    try {
      console.log('🔍 Looking for script element with src="./sidebar.js"')
      
      // Try multiple selectors to find the script tag
      const selectors = [
        '#accesstiveSidebar'
      ]
      
      let scriptElement: HTMLScriptElement | null = null
      let usedSelector = ''
      
      for (const selector of selectors) {
        scriptElement = document.querySelector(selector) as HTMLScriptElement
        if (scriptElement) {
          usedSelector = selector
          console.log(`✅ Found script element using selector: ${selector}`)
          break
        }
      }
      
      if (scriptElement) {
        console.log('📋 Script element details:', {
          src: scriptElement.src,
          type: scriptElement.type,
          attributes: Array.from(scriptElement.attributes).map(attr => ({ name: attr.name, value: attr.value }))
        })
        
        const oldUrl = scriptElement.getAttribute('data-tab-url')
        console.log(`📝 Setting data-tab-url from "${oldUrl}" to "${url}"`)
        
        scriptElement.setAttribute('data-tab-url', url)
        
        // Verify the update was successful
        const updatedUrl = scriptElement.getAttribute('data-tab-url')
        console.log('📝 Updated script data-tab-url:', {
          oldUrl: oldUrl,
          newUrl: url,
          updatedUrl: updatedUrl,
          element: scriptElement,
          usedSelector: usedSelector,
          timestamp: new Date().toISOString()
        })
        
        if (updatedUrl === url) {
          console.log('✅ Script data-tab-url attribute successfully updated')
        } else {
          console.error('❌ Failed to update script data-tab-url attribute. Expected:', url, 'Got:', updatedUrl)
        }
        
        // Additional verification - check if the attribute is actually in the DOM
        const htmlContent = scriptElement.outerHTML
        console.log('🔍 Script element HTML after update:', htmlContent)
        
      } else {
        console.warn('⚠️ Script element not found with any selector. Available scripts:', 
          Array.from(document.querySelectorAll('script')).map(script => ({
            src: (script as HTMLScriptElement).src,
            type: script.type,
            outerHTML: script.outerHTML
          }))
        )
      }
    } catch (error) {
      console.error('❌ Failed to update script URL attribute:', error)
    }
  }

  private setupTooltips(): void {
    // Initialize tooltips for all elements with tooltip classes
    this.initializeTooltips()
    
    // Set up event listeners for dynamic content
    this.setupTooltipEventListeners()
  }

  private initializeTooltips(): void {
    // Find all tooltip elements
    const tooltipElements = document.querySelectorAll('.nsa-tooltip, .nsa-tooltip-enhanced')
    
    tooltipElements.forEach(element => {
      this.setupTooltipElement(element)
    })
  }

  private setupTooltipElement(element: Element): void {
    // Add focus event listener for accessibility
    element.addEventListener('focus', () => {
      this.showTooltip(element)
    })

    // Add blur event listener
    element.addEventListener('blur', () => {
      this.hideTooltip(element)
    })

    // Add mouse events for better UX
    element.addEventListener('mouseenter', () => {
      this.showTooltip(element)
    })

    element.addEventListener('mouseleave', () => {
      this.hideTooltip(element)
    })

    // Add keyboard support
    element.addEventListener('keydown', (e: Event) => {
      const keyboardEvent = e as KeyboardEvent
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        e.preventDefault()
        this.toggleTooltip(element)
      }
    })
  }

  private setupTooltipEventListeners(): void {
    // Use event delegation for dynamically added content
    document.addEventListener('mouseenter', (e) => {
      try {
        if (e.target && e.target instanceof Element && typeof e.target.closest === 'function') {
          const tooltipElement = e.target.closest('.nsa-tooltip, .nsa-tooltip-enhanced')
          if (tooltipElement && !tooltipElement.hasAttribute('data-tooltip-initialized')) {
            tooltipElement.setAttribute('data-tooltip-initialized', 'true')
            this.setupTooltipElement(tooltipElement)
          }
        }
      } catch (error) {
        console.warn('Error in tooltip event listener:', error)
      }
    })
  }

  private showTooltip(element: Element): void {
    const tooltipContent = element.querySelector('.nsa-tooltip-text, .nsa-tooltip-content') as HTMLElement
    if (tooltipContent) {
      tooltipContent.style.visibility = 'visible'
      tooltipContent.style.opacity = '1'
      
      // Add a small delay to prevent flickering
      clearTimeout((element as any).tooltipTimeout)
    }
  }

  private hideTooltip(element: Element): void {
    const tooltipContent = element.querySelector('.nsa-tooltip-text, .nsa-tooltip-content') as HTMLElement
    if (tooltipContent) {
      // Add a small delay to prevent flickering when moving between elements
      (element as any).tooltipTimeout = setTimeout(() => {
        tooltipContent.style.visibility = 'hidden'
        tooltipContent.style.opacity = '0'
      }, 100)
    }
  }

  private toggleTooltip(element: Element): void {
    const tooltipContent = element.querySelector('.nsa-tooltip-text, .nsa-tooltip-content') as HTMLElement
    if (tooltipContent) {
      const isVisible = tooltipContent.style.visibility === 'visible'
      if (isVisible) {
        this.hideTooltip(element)
      } else {
        this.showTooltip(element)
      }
    }
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close sidebar by sending message to background script
        chrome.runtime.sendMessage({ action: 'closeSidebar' })
      }
    })
  }

  private setupMessageListener(): void {
    // Listen for messages from background script about tab changes
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'tabUrlChanged' && request.url) {
        console.log('Tab URL changed to:', request.url)
        this.handleTabUrlChange(request.url)
        sendResponse({ success: true })
      } else if (request.action === 'triggerRescanAfterReload' && request.url) {
        console.log('🔄 Triggering rescan after page reload:', request.url)
        this.handleRescanAfterReload(request.url)
        sendResponse({ success: true })
      }
      return true // Keep message channel open for async responses
    })
  }

  private async handleTabUrlChange(newUrl: string): Promise<void> {
    try {
      console.log('🔄 URL Change Detected:', {
        oldUrl: this.currentTabUrl,
        newUrl: newUrl,
        timestamp: new Date().toISOString()
      })
      
      // Update the stored URL
      this.currentTabUrl = newUrl
      
      // Update the script data-tab-url attribute
      this.updateScriptUrlAttribute(newUrl)
      
      // Trigger rescan if audit manager is available
      if (this.auditManager) {
        console.log('🔄 Triggering rescan for new URL:', newUrl)
        // The audit manager will handle the rescan with the new URL
        await this.auditManager.fetchAccessibilityReport()
        console.log('✅ Rescan completed for URL:', newUrl)
      } else {
        console.warn('⚠️ Audit manager not available for rescan')
      }
      
      // Also notify the content script about the URL change
      try {
        await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'urlChanged',
              url: newUrl 
            }).catch((error) => {
              console.log('Content script not ready for URL change notification:', error)
            })
          }
        })
      } catch (error) {
        console.log('Error notifying content script:', error)
      }
    } catch (error) {
      console.error('❌ Error handling tab URL change:', error)
    }
  }

  /**
   * Public method to manually test URL updates
   * This can be called from the browser console for testing
   */
  public async testUrlUpdate(testUrl: string = 'https://example.com'): Promise<void> {
    console.log('🧪 Testing URL update functionality...')
    try {
      await this.handleTabUrlChange(testUrl)
      console.log('🧪 Test completed successfully')
    } catch (error) {
      console.error('🧪 Test failed:', error)
    }
  }

  /**
   * Public method to test script tag attribute update directly
   * This can be called from the browser console for testing
   */
  public testScriptAttributeUpdate(testUrl: string = 'https://test.com'): void {
    console.log('🧪 Testing script attribute update directly...')
    this.updateScriptUrlAttribute(testUrl)
  }

  private async handleRescanAfterReload(url: string): Promise<void> {
    try {
      console.log('🔄 Handling rescan after page reload:', {
        url: url,
        currentUrl: this.currentTabUrl,
        timestamp: new Date().toISOString()
      })
      
      // Update the stored URL
      this.currentTabUrl = url
      
      // Update the script data-tab-url attribute
      this.updateScriptUrlAttribute(url)
      
      // Trigger rescan if audit manager is available
      if (this.auditManager) {
        console.log('🔄 Triggering automatic rescan after page reload for URL:', url)
        // Add a small delay to ensure page is fully loaded
        setTimeout(async () => {
          try {
            await this.auditManager!.fetchAccessibilityReport()
            console.log('✅ Automatic rescan completed after page reload')
          } catch (error) {
            console.error('❌ Error during automatic rescan after reload:', error)
          }
        }, 1000) // Additional 1 second delay for page stability
      } else {
        console.log('⚠️ Audit manager not available for rescan after reload')
      }
    } catch (error) {
      console.error('❌ Error handling rescan after reload:', error)
    }
  }

  /**
   * Public method to manually refresh the current tab URL
   */
  public async refreshCurrentTabUrl(): Promise<void> {
    console.log('🔄 Manually refreshing current tab URL...')
    try {
      await this.setActiveTabUrl()
      if (this.currentTabUrl) {
        console.log('✅ Current tab URL refreshed:', this.currentTabUrl)
      } else {
        console.warn('⚠️ Failed to refresh current tab URL')
      }
    } catch (error) {
      console.error('❌ Error refreshing current tab URL:', error)
    }
  }

  /**
   * Public method to manually fix the data-tab-url attribute
   */
  public fixDataTabUrl(): void {
    console.log('🔧 Manually fixing data-tab-url attribute...')
    if (this.currentTabUrl) {
      this.updateScriptUrlAttribute(this.currentTabUrl)
      console.log('✅ data-tab-url attribute fixed with URL:', this.currentTabUrl)
    } else {
      console.warn('⚠️ No current tab URL available to fix data-tab-url')
      console.warn('💡 Try calling window.accesstiveSidebar.refreshCurrentTabUrl() first')
    }
  }

  /**
   * Public method to get current status for debugging
   */
  public getStatus(): any {
    const scriptElement = document.querySelector('script[src="./sidebar.js"]') as HTMLScriptElement
    return {
      isInitialized: this.isInitialized,
      currentTabUrl: this.currentTabUrl,
      scriptDataTabUrl: scriptElement?.getAttribute('data-tab-url'),
      auditManagerAvailable: !!this.auditManager,
      widgetToggleAvailable: !!this.widgetToggle,
      timestamp: new Date().toISOString()
    }
  }

  public destroy(): void {
    // Clean up resources
    if (this.auditManager) {
      this.auditManager.destroy()
    }
    
    if (this.widgetToggle) {
      // Add cleanup method to widget toggle if needed
    }
    
    this.isInitialized = false
  }
}
