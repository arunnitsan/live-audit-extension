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

  constructor() {
    this.init()
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
    } catch (error) {
      console.error('Failed to initialize sidebar widget:', error)
    }
  }

  private async initializeWidget(): Promise<void> {
    try {
      // Initialize the widget toggle
      this.widgetToggle = new NsaWidgetToggle()
      
      // Initialize the audit manager
      const apiUrl = this.getApiUrl()
      this.auditManager = new NsaAuditAccesstive(apiUrl)
      
      // Set up tooltips
      this.setupTooltips()
      
      // Set up keyboard navigation
      this.setupKeyboardNavigation()
      
      // Show the widget
      this.showWidget()
      
      this.isInitialized = true
      console.log('Sidebar widget initialized successfully')
    } catch (error) {
      console.error('Error initializing widget:', error)
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
        // The URL will be used by the audit manager when it initializes
      }
    } catch (error) {
      console.error('Failed to get active tab URL:', error)
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
