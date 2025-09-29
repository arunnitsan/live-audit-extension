/**
 * Accesstive - Live Audit Extension
 * Content Script Class
 */

export class AccesstiveContentScript {
  private isInitialized: boolean = false
  private settings: Record<string, any> = {
    language: 'en',
    standard: 'wcag21aa',
    theme: 'dark',
    autoScan: true
  }

  constructor() {
    this.init()
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return

    try {
      await this.loadSettings()
      this.setupMessageListeners()
      this.setupPageObserver()
      this.isInitialized = true
      
      // Notify background script that content script is ready
      this.sendMessage({ action: 'contentScriptReady' })
      
      console.log('Accesstive content script initialized')
    } catch (error) {
      console.error('Failed to initialize content script:', error)
    }
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse)
      return true // Keep message channel open for async responses
    })
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

        case 'initializeAudit':
          await this.initializeAudit(request.url)
          sendResponse({ success: true })
          break

        case 'auditSelection':
          await this.auditSelection(request.selectionText)
          sendResponse({ success: true })
          break

        case 'highlightElement':
          await this.highlightElement(request.selector, request.issue)
          sendResponse({ success: true })
          break

        case 'removeHighlights':
          this.removeHighlights()
          sendResponse({ success: true })
          break

        case 'getPageInfo':
          const pageInfo = this.getPageInfo()
          sendResponse({ success: true, data: pageInfo })
          break

        default:
          sendResponse({ success: false, error: 'Unknown action' })
      }
    } catch (error) {
      console.error('Error handling message in content script:', error)
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['settings'])
      this.settings = { ...this.settings, ...result.settings }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  private setupPageObserver(): void {
    // Observe DOM changes to detect dynamic content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          this.handleDOMChanges(mutation.addedNodes)
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  private handleDOMChanges(nodes: NodeList): void {
    // Handle dynamic content changes
    nodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        // Check if new content needs auditing
        this.checkForNewContent(element)
      }
    })
  }

  private checkForNewContent(_element: Element): void {
    // Implement logic to check if new content needs auditing
    // This could trigger re-auditing of specific areas
  }

  private async initializeAudit(url?: string): Promise<void> {
    try {
      console.log('Initializing audit for URL:', url || window.location.href)
      
      // Send page information to sidebar
      const pageInfo = this.getPageInfo()
      this.sendMessage({ 
        action: 'pageInfo', 
        data: pageInfo 
      })

      // If auto-scan is enabled, start the audit
      if (this.settings.autoScan) {
        await this.startAudit()
      }
    } catch (error) {
      console.error('Error initializing audit:', error)
    }
  }

  private async auditSelection(selectionText: string): Promise<void> {
    try {
      console.log('Auditing selection:', selectionText)
      
      // Find the selected element
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const selectedElement = range.commonAncestorContainer.parentElement
        
        if (selectedElement) {
          // Send selection info to sidebar for targeted auditing
          this.sendMessage({
            action: 'auditSelection',
            data: {
              text: selectionText,
              element: selectedElement.outerHTML,
              selector: this.generateSelector(selectedElement)
            }
          })
        }
      }
    } catch (error) {
      console.error('Error auditing selection:', error)
    }
  }

  private async startAudit(): Promise<void> {
    try {
      // This would typically trigger the audit process
      // For now, we'll just notify that audit should start
      this.sendMessage({ action: 'startAudit' })
    } catch (error) {
      console.error('Error starting audit:', error)
    }
  }

  private async highlightElement(selector: string, issue: any): Promise<void> {
    try {
      const element = document.querySelector(selector)
      if (element) {
        this.addHighlight(element as HTMLElement, issue)
      }
    } catch (error) {
      console.error('Error highlighting element:', error)
    }
  }

  private addHighlight(element: HTMLElement, issue: any): void {
    // Remove existing highlights
    this.removeHighlights()
    
    // Add highlight class
    element.classList.add('accesstive-highlight')
    element.setAttribute('data-accesstive-issue', JSON.stringify(issue))
    
    // Scroll to element
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    
    // Remove highlight after delay
    setTimeout(() => {
      element.classList.remove('accesstive-highlight')
      element.removeAttribute('data-accesstive-issue')
    }, 5000)
  }

  private removeHighlights(): void {
    const highlightedElements = document.querySelectorAll('.accesstive-highlight')
    highlightedElements.forEach(element => {
      element.classList.remove('accesstive-highlight')
      element.removeAttribute('data-accesstive-issue')
    })
  }

  private getPageInfo(): any {
    return {
      url: window.location.href,
      title: document.title,
      language: document.documentElement.lang || 'en',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }
  }

  private generateSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim())
      if (classes.length > 0) {
        return `.${classes.join('.')}`
      }
    }
    
    return element.tagName.toLowerCase()
  }

  private sendMessage(message: any): void {
    try {
      chrome.runtime.sendMessage(message)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }
}
