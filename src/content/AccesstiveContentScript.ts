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
          await this.highlightElement(request.selector, {
            issueIndex: request.issueIndex,
            issueTitle: request.issueTitle
          })
          sendResponse({ success: true })
          break

        case 'findElementsAndAttachTooltips':
          try {
            const { selector, issues } = request
            
            if (!selector || !issues) {
              sendResponse({ success: false, error: 'No selector or issues provided' })
              return
            }
            
            // Find elements using the selector (silent)
            const elements = this.findElementsBySelector(selector)
            
            if (elements.length === 0) {
              sendResponse({ success: false, error: 'No elements found' })
              return
            }
            
            // Attach tooltips to each found element (silent)
            for (const elem of elements) {
              await this.attachTooltipToElement(elem, issues)
            }
            
            sendResponse({ success: true, elementsCount: elements.length })
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
          }
          break

        case 'removeHighlights':
          this.removeHighlights()
          sendResponse({ success: true })
          break

        case 'triggerRescan':
          console.log('🔄 Triggering rescan from content script for URL:', request.url)
          await this.initializeAudit(request.url)
          sendResponse({ success: true })
          break

        case 'urlChanged':
          console.log('🔄 URL changed in content script:', request.url)
          await this.initializeAudit(request.url)
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
      console.log('🎯 Highlighting element with selector:', selector, 'Issue:', issue)
      
      // First, try to decode the selector if it's JSON encoded
      let decodedSelector = selector
      try {
        if (selector.startsWith('"') && selector.endsWith('"')) {
          decodedSelector = JSON.parse(selector)
        }
      } catch (e) {
        // If JSON parsing fails, use the original selector
        decodedSelector = selector
      }
      
      console.log('📝 Decoded selector:', decodedSelector)
      
      // Try multiple selectors to find the element
      let element = document.querySelector(decodedSelector)
      
      if (!element) {
        console.log('🔍 Element not found with original selector, trying alternatives...')
        
        // Generate progressive selectors for better element finding
        const progressiveSelectors = this.generateProgressiveSelectors(decodedSelector)
        
        for (const altSelector of progressiveSelectors) {
          console.log('🔄 Trying progressive selector:', altSelector)
          element = document.querySelector(altSelector)
          if (element) {
            console.log('✅ Found element with progressive selector:', altSelector)
            break
          }
        }
      }
      
      if (element) {
        this.addHighlight(element as HTMLElement, issue)
        console.log('✅ Element highlighted successfully:', element.tagName, element.className)
      } else {
        console.warn('❌ Element not found for selector:', decodedSelector)
        console.warn('💡 Available elements in page:', document.querySelectorAll('*').length)
        
        // Try to find similar elements for debugging
        const tagName = decodedSelector.match(/^([a-zA-Z]+)/)?.[1]
        if (tagName) {
          const similarElements = document.querySelectorAll(tagName.toLowerCase())
          console.log(`🔍 Found ${similarElements.length} elements with tag '${tagName}'`)
        }
      }
    } catch (error) {
      console.error('❌ Error highlighting element:', error)
    }
  }

  private addHighlight(element: HTMLElement, issue: any): void {
    // Remove existing highlights
    this.removeHighlights()
    
    // Store original styles for restoration
    const originalStyles = {
      outline: element.style.outline,
      boxShadow: element.style.boxShadow,
      backgroundColor: element.style.backgroundColor,
      border: element.style.border,
      zIndex: element.style.zIndex,
      position: element.style.position
    }
    
    // Add highlight class and styling
    element.classList.add('accesstive-highlight')
    element.setAttribute('data-accesstive-issue', JSON.stringify(issue))
    
    // Add prominent inline styles for better visibility
    element.style.outline = '4px solid #ff4444'
    element.style.boxShadow = '0 0 15px rgba(255, 68, 68, 0.8)'
    element.style.backgroundColor = 'rgba(255, 68, 68, 0.15)'
    element.style.border = '2px solid #ff4444'
    element.style.zIndex = '999999'
    element.style.position = 'relative'
    
    // Store original styles for restoration
    Object.entries(originalStyles).forEach(([key, value]) => {
      element.setAttribute(`data-original-${key}`, value)
    })
    
    // Scroll to element with smooth behavior
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    })
    
    console.log('🎯 Element highlighted with issue:', issue)
    console.log('📍 Element details:', {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      textContent: element.textContent?.substring(0, 100) + '...'
    })
    
    // Remove highlight after delay
    setTimeout(() => {
      this.removeElementHighlight(element, originalStyles)
    }, 8000) // Increased to 8 seconds for better visibility
  }

  private removeElementHighlight(element: HTMLElement, originalStyles: any): void {
    try {
      element.classList.remove('accesstive-highlight')
      element.removeAttribute('data-accesstive-issue')
      
      // Restore original styles
      Object.entries(originalStyles).forEach(([key, value]) => {
        element.style[key as any] = value as string
        element.removeAttribute(`data-original-${key}`)
      })
      
      console.log('🧹 Element highlight removed')
    } catch (error) {
      console.error('❌ Error removing element highlight:', error)
    }
  }

  private removeHighlights(): void {
    const highlightedElements = document.querySelectorAll('.accesstive-highlight')
    highlightedElements.forEach(element => {
      const htmlElement = element as HTMLElement
      
      // Restore original styles
      const originalStyles = {
        outline: htmlElement.getAttribute('data-original-outline') || '',
        boxShadow: htmlElement.getAttribute('data-original-boxShadow') || '',
        backgroundColor: htmlElement.getAttribute('data-original-backgroundColor') || '',
        border: htmlElement.getAttribute('data-original-border') || '',
        zIndex: htmlElement.getAttribute('data-original-zIndex') || '',
        position: htmlElement.getAttribute('data-original-position') || ''
      }
      
      htmlElement.classList.remove('accesstive-highlight')
      htmlElement.removeAttribute('data-accesstive-issue')
      
      // Restore all original styles
      Object.entries(originalStyles).forEach(([key, value]) => {
        htmlElement.style[key as any] = value
        htmlElement.removeAttribute(`data-original-${key}`)
      })
    })
    
    console.log('🧹 All highlights removed')
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

  /**
   * Generate progressively simplified selectors to find elements when the full selector fails
   */
  private generateProgressiveSelectors(selector: string): string[] {
    const selectors: string[] = []
    
    // Remove attribute selectors progressively
    let simplifiedSelector = selector
    
    // Try removing src attributes first (common issue)
    selectors.push(simplifiedSelector.replace(/\[src="[^"]*"\]/g, ''))
    
    // Try removing all attribute selectors
    selectors.push(simplifiedSelector.replace(/\[[^\]]*\]/g, ''))
    
    // Try removing specific attribute types
    selectors.push(simplifiedSelector.replace(/\[class="[^"]*"\]/g, ''))
    selectors.push(simplifiedSelector.replace(/\[id="[^"]*"\]/g, ''))
    
    // Try getting just the last element in the chain
    const parts = simplifiedSelector.split(' > ')
    if (parts.length > 1) {
      // Try the last element
      selectors.push(parts[parts.length - 1])
      
      // Try the last two elements
      if (parts.length > 2) {
        selectors.push(parts.slice(-2).join(' > '))
      }
      
      // Try the last three elements
      if (parts.length > 3) {
        selectors.push(parts.slice(-3).join(' > '))
      }
    }
    
    // Try just the tag name of the last element
    const lastPart = parts[parts.length - 1] || simplifiedSelector
    const tagMatch = lastPart.match(/^([a-zA-Z0-9-]+)/)
    if (tagMatch) {
      selectors.push(tagMatch[1])
    }
    
    // Try removing child combinators and using descendant selectors
    selectors.push(simplifiedSelector.replace(/ > /g, ' '))
    
    // Remove duplicates and empty selectors
    return [...new Set(selectors)].filter(s => s && s.trim().length > 0)
  }

  /**
   * Find elements by selector in the active tab's document
   */
  private findElementsBySelector(selector: string): Element[] {
    try {
      // Silent element finding - no console spam
      const directMatches = Array.from(document.querySelectorAll(selector))
      if (directMatches.length > 0) {
        return directMatches
      }
      
      return []
    } catch (error) {
      // Silent error handling
      return []
    }
  }

  /**
   * Attach tooltip to an element in the active tab
   */
  private async attachTooltipToElement(element: Element, issues: any[]): Promise<void> {
    try {
      console.log('🎯 Content Script: Attaching tooltip to element:', element.tagName)

      // Create a tooltip icon element
      const tooltipIcon = document.createElement('div')
      tooltipIcon.className = 'nsa-tooltip-icon'
      tooltipIcon.innerHTML = '⚠️' // Simple warning icon
      tooltipIcon.style.cssText = `
        position: absolute;
        background: #ff4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `

      // Position the tooltip icon relative to the element
      const rect = element.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

      tooltipIcon.style.top = (rect.top + scrollTop - 10) + 'px'
      tooltipIcon.style.left = (rect.right + scrollLeft + 5) + 'px'

      // Add click handler to show tooltip details
      tooltipIcon.addEventListener('click', (e) => {
        e.stopPropagation()
        this.showTooltipDetails(element, issues, tooltipIcon)
      })

      // Add hover handler for quick preview
      tooltipIcon.addEventListener('mouseenter', () => {
        this.showTooltipPreview(element, issues, tooltipIcon)
      })

      tooltipIcon.addEventListener('mouseleave', () => {
        this.hideTooltipPreview()
      })

      // Add the tooltip icon to the document
      document.body.appendChild(tooltipIcon)

      console.log('✅ Content Script: Tooltip attached successfully to element')

    } catch (error) {
      console.error('❌ Content Script: Error attaching tooltip to element:', error)
    }
  }

  /**
   * Show tooltip details on click
   */
  private showTooltipDetails(element: Element, issues: any[], tooltipIcon: HTMLElement): void {
    try {
      console.log('📋 Content Script: Showing tooltip details for', issues.length, 'issues')

      // Create tooltip content
      const tooltipContent = document.createElement('div')
      tooltipContent.className = 'nsa-tooltip-content'
      tooltipContent.style.cssText = `
        position: absolute;
        background: white;
        border: 2px solid #ff4444;
        border-radius: 8px;
        padding: 12px;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      `

      // Add issues to tooltip content
      issues.forEach((issue, index) => {
        const issueDiv = document.createElement('div')
        issueDiv.style.cssText = `
          margin-bottom: 8px;
          padding: 8px;
          background: #fff5f5;
          border-left: 4px solid #ff4444;
          border-radius: 4px;
        `
        
        issueDiv.innerHTML = `
          <div style="font-weight: bold; color: #d32f2f; margin-bottom: 4px;">
            ${issue.title || 'Accessibility Issue'}
          </div>
          <div style="color: #666; font-size: 12px;">
            ${issue.message || 'No description available'}
          </div>
        `
        
        tooltipContent.appendChild(issueDiv)
      })

      // Position tooltip content
      const iconRect = tooltipIcon.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

      tooltipContent.style.top = (iconRect.bottom + scrollTop + 5) + 'px'
      tooltipContent.style.left = (iconRect.left + scrollLeft) + 'px'

      // Add close button
      const closeButton = document.createElement('button')
      closeButton.innerHTML = '×'
      closeButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
      `
      closeButton.addEventListener('click', () => {
        document.body.removeChild(tooltipContent)
      })

      tooltipContent.appendChild(closeButton)
      document.body.appendChild(tooltipContent)

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (document.body.contains(tooltipContent)) {
          document.body.removeChild(tooltipContent)
        }
      }, 10000)

    } catch (error) {
      console.error('❌ Content Script: Error showing tooltip details:', error)
    }
  }

  /**
   * Show tooltip preview on hover
   */
  private showTooltipPreview(element: Element, issues: any[], tooltipIcon: HTMLElement): void {
    try {
      // Create simple preview tooltip
      const preview = document.createElement('div')
      preview.className = 'nsa-tooltip-preview'
      preview.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
        pointer-events: none;
      `
      
      preview.textContent = `${issues.length} accessibility issue${issues.length > 1 ? 's' : ''}`
      
      // Position preview
      const iconRect = tooltipIcon.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

      preview.style.top = (iconRect.bottom + scrollTop + 2) + 'px'
      preview.style.left = (iconRect.left + scrollLeft) + 'px'

      document.body.appendChild(preview)

      // Store reference for removal
      ;(tooltipIcon as any).tooltipPreview = preview

    } catch (error) {
      console.error('❌ Content Script: Error showing tooltip preview:', error)
    }
  }

  /**
   * Hide tooltip preview
   */
  private hideTooltipPreview(): void {
    try {
      const preview = document.querySelector('.nsa-tooltip-preview')
      if (preview && document.body.contains(preview)) {
        document.body.removeChild(preview)
      }
    } catch (error) {
      console.error('❌ Content Script: Error hiding tooltip preview:', error)
    }
  }
}
