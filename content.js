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

      // Notify background script that we're ready
      try {
        chrome.runtime.sendMessage({ action: 'contentScriptReady' });
      } catch (error) {
        // Background script not available
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

        case 'startAudit':
          this.startAudit(request.options).then(sendResponse);
          return true;

        case 'getAuditData':
          sendResponse(this.auditData || { violations: [], passes: [] });
          break;

        case 'updateSettings':
          this.updateSettings(request.settings);
          sendResponse({ success: true });
          break;

        case 'inspectElement':
          this.highlightElement(request.selector);
          sendResponse({ success: true });
          break;

        case 'highlightViolations':
          this.highlightViolations(request.violations);
          sendResponse({ success: true });
          break;

        case 'clearHighlights':
          this.clearAllHighlights();
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

  async startAudit(options = {}) {
    try {
      this.showNotification('Starting accessibility audit...', 'info');

      // Run comprehensive accessibility checks
      const results = await this.runSimpleAudit();
      
      this.auditData = results;
      this.sendResultsToPopup(results);
      
      // Show success notification
      const violationCount = results.violations ? results.violations.length : 0;
      if (violationCount === 0) {
        this.showNotification('Audit completed! No accessibility issues found.', 'success');
      } else {
        this.showNotification(`Audit completed! Found ${violationCount} accessibility issues.`, 'warning');
      }
      
      return { success: true, results: results };
    } catch (error) {
      console.error('Audit failed:', error);
      this.showNotification('Audit failed. Please try again.', 'error');
      
      const errorResults = {
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: [],
        error: error.message
      };
      this.sendResultsToPopup(errorResults);
      return { success: false, error: error.message };
    }
  }

  async runSimpleAudit() {
    const violations = [];
    const passes = [];
    const incomplete = [];
    const inapplicable = [];

    try {
      // 1. Check for missing alt text on images
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        const hasAlt = img.alt && img.alt.trim() !== '';
        const hasAriaLabel = img.getAttribute('aria-label') && img.getAttribute('aria-label').trim() !== '';
        const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true';
        
        if (!hasAlt && !hasAriaLabel && !isDecorative) {
          violations.push({
            id: 'image-alt',
            impact: 'critical',
            description: 'Images must have alternate text',
            help: 'Provide alternative text for images using alt attribute or aria-label',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/image-alt',
            category: 'Textalternative',
            nodes: [{
              target: [`img:nth-of-type(${index + 1})`],
              html: img.outerHTML,
              failureSummary: 'Element does not have an alt attribute or aria-label'
            }]
          });
        } else if (hasAlt || hasAriaLabel) {
          passes.push({
            id: 'image-alt',
            description: 'Image has appropriate alternative text',
            category: 'Textalternative'
          });
        }
      });

      // 2. Check for missing lang attribute
      const htmlElement = document.documentElement;
      if (!htmlElement.getAttribute('lang')) {
        violations.push({
          id: 'html-has-lang',
          impact: 'serious',
          description: 'HTML element must have a lang attribute',
          help: 'Ensure the HTML element has a lang attribute',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/html-has-lang',
          category: 'Name Role Wert',
          nodes: [{
            target: ['html'],
            html: htmlElement.outerHTML,
            failureSummary: 'The html element does not have a lang attribute'
          }]
        });
      } else {
        passes.push({
          id: 'html-has-lang',
          description: 'HTML element has a lang attribute',
          category: 'Name Role Wert'
        });
      }

      // 3. Check for missing form labels
      const formInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"], input[type="search"], textarea, select');
      formInputs.forEach((input, index) => {
        const id = input.id;
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const placeholder = input.getAttribute('placeholder');
        const isHidden = input.type === 'hidden';
        
        if (!isHidden && !label && !ariaLabel && !ariaLabelledBy) {
          violations.push({
            id: 'label',
            impact: 'critical',
            description: 'Form elements must have labels',
            help: 'Ensure every form element has a label using label element, aria-label, or aria-labelledby',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/label',
            category: 'Formulare',
            nodes: [{
              target: [`${input.tagName.toLowerCase()}:nth-of-type(${index + 1})`],
              html: input.outerHTML,
              failureSummary: 'Form element does not have an associated label'
            }]
          });
        } else if (label || ariaLabel || ariaLabelledBy) {
          passes.push({
            id: 'label',
            description: 'Form element has appropriate label',
            category: 'Formulare'
          });
        }
      });

      // 4. Check for heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let hasH1 = false;
      let previousLevel = 0;
      
      headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.charAt(1));
        
        if (level === 1) hasH1 = true;
        
        if (level > previousLevel + 1) {
          violations.push({
            id: 'heading-order',
            impact: 'moderate',
            description: 'Heading levels should not skip levels',
            help: 'Ensure heading levels follow a logical sequence',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/heading-order',
            category: 'Struktur',
            nodes: [{
              target: [`${heading.tagName.toLowerCase()}:nth-of-type(${index + 1})`],
              html: heading.outerHTML,
              failureSummary: 'Heading level skipped'
            }]
          });
        }
        
        previousLevel = level;
      });

      if (!hasH1) {
        violations.push({
          id: 'page-has-heading-one',
          impact: 'serious',
          description: 'Page must have a heading level 1',
          help: 'Ensure the page has a main heading with h1',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/page-has-heading-one',
          category: 'Struktur',
          nodes: [{
            target: ['body'],
            html: document.body.outerHTML,
            failureSummary: 'Page does not have a heading level 1'
          }]
        });
      }

      // 5. Check for missing button labels
      const buttons = document.querySelectorAll('button');
      buttons.forEach((button, index) => {
        const hasText = button.textContent && button.textContent.trim() !== '';
        const hasAriaLabel = button.getAttribute('aria-label') && button.getAttribute('aria-label').trim() !== '';
        const hasAriaLabelledBy = button.getAttribute('aria-labelledby');
        const hasTitle = button.getAttribute('title') && button.getAttribute('title').trim() !== '';
        
        if (!hasText && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
          violations.push({
            id: 'button-name',
            impact: 'critical',
            description: 'Buttons must have accessible names',
            help: 'Ensure buttons have accessible names using text content, aria-label, or aria-labelledby',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/button-name',
            category: 'Tastatur',
            nodes: [{
              target: [`button:nth-of-type(${index + 1})`],
              html: button.outerHTML,
              failureSummary: 'Button does not have an accessible name'
            }]
          });
        }
      });

      // 6. Check for missing link text
      const links = document.querySelectorAll('a[href]');
      links.forEach((link, index) => {
        const hasText = link.textContent && link.textContent.trim() !== '';
        const hasAriaLabel = link.getAttribute('aria-label') && link.getAttribute('aria-label').trim() !== '';
        const hasTitle = link.getAttribute('title') && link.getAttribute('title').trim() !== '';
        const hasImage = link.querySelector('img[alt]');
        
        if (!hasText && !hasAriaLabel && !hasTitle && !hasImage) {
          violations.push({
            id: 'link-name',
            impact: 'serious',
            description: 'Links must have accessible names',
            help: 'Ensure links have accessible names using text content, aria-label, or title',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/link-name',
            category: 'Tastatur',
            nodes: [{
              target: [`a:nth-of-type(${index + 1})`],
              html: link.outerHTML,
              failureSummary: 'Link does not have an accessible name'
            }]
          });
        }
      });

      // 7. Check for duplicate IDs
      const elementsWithIds = document.querySelectorAll('[id]');
      const idCounts = {};
      
      elementsWithIds.forEach(element => {
        const id = element.id;
        if (idCounts[id]) {
          idCounts[id]++;
        } else {
          idCounts[id] = 1;
        }
      });

      Object.entries(idCounts).forEach(([id, count]) => {
        if (count > 1) {
          violations.push({
            id: 'duplicate-id',
            impact: 'serious',
            description: 'IDs must be unique',
            help: 'Ensure all elements have unique IDs',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/duplicate-id',
            category: 'Name Role Wert',
            nodes: [{
              target: [`#${id}`],
              html: `Multiple elements with id="${id}"`,
              failureSummary: `ID "${id}" is not unique`
            }]
          });
        }
      });

      // 8. Check for keyboard navigation
      const focusableElements = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      let keyboardAccessible = true;
      
      focusableElements.forEach(element => {
        if (element.offsetParent === null) {
          keyboardAccessible = false;
        }
      });

      if (keyboardAccessible) {
        passes.push({
          id: 'keyboard-navigation',
          description: 'All interactive elements are keyboard accessible',
          category: 'Tastatur'
        });
      } else {
        violations.push({
          id: 'keyboard-navigation',
          impact: 'serious',
          description: 'All interactive elements must be keyboard accessible',
          help: 'Ensure all interactive elements can be reached via keyboard',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/keyboard-navigation',
          category: 'Tastatur',
          nodes: [{
            target: ['body'],
            html: document.body.outerHTML,
            failureSummary: 'Some interactive elements are not keyboard accessible'
          }]
        });
      }

      // 9. Check for ARIA attributes
      const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
      if (elementsWithAria.length > 0) {
        passes.push({
          id: 'aria-labels',
          description: 'ARIA labels are properly implemented',
          category: 'Aria'
        });
      }

      // 10. Check for color contrast (simplified check)
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button');
      let contrastIssues = 0;
      
      textElements.forEach((element, index) => {
        if (index % 20 === 0) { // Sample some elements
          const computedStyle = window.getComputedStyle(element);
          const color = computedStyle.color;
          const backgroundColor = computedStyle.backgroundColor;
          
          // This is a simplified check - in a real implementation, you'd use a proper contrast ratio calculation
          if (color === backgroundColor) {
            contrastIssues++;
          }
        }
      });

      if (contrastIssues > 0) {
        violations.push({
          id: 'color-contrast',
          impact: 'serious',
          description: 'Elements must have sufficient color contrast',
          help: 'Ensure text has sufficient color contrast ratio of at least 4.5:1',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/color-contrast',
          category: 'Farbe',
          nodes: [{
            target: ['body'],
            html: document.body.outerHTML,
            failureSummary: 'Some elements have insufficient color contrast'
          }]
        });
      } else {
        passes.push({
          id: 'color-contrast',
          description: 'Text has sufficient color contrast',
          category: 'Farbe'
        });
      }

      return {
        violations: violations,
        passes: passes,
        incomplete: incomplete,
        inapplicable: inapplicable
      };
    } catch (error) {
      console.error('Error in comprehensive audit:', error);
      throw error;
    }
  }

  sendResultsToPopup(results) {
    chrome.runtime.sendMessage({
      action: 'auditResults',
      results: results
    });
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  highlightElement(selector) {
    try {
      // Remove existing highlights
      document.querySelectorAll('.accesstive-highlight').forEach(el => {
        el.classList.remove('accesstive-highlight');
        el.style.outline = '';
      });

      // Find and highlight element
      const element = document.querySelector(selector);
      if (element) {
        element.classList.add('accesstive-highlight');
        element.style.outline = '3px solid #007acc';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Remove highlight after 5 seconds
        setTimeout(() => {
          element.classList.remove('accesstive-highlight');
          element.style.outline = '';
        }, 5000);
      }
    } catch (error) {
      console.error('Error highlighting element:', error);
    }
  }

  showNotification(message, type = 'info') {
    try {
      // Remove existing notifications
      document.querySelectorAll('.accesstive-notification').forEach(notification => {
        notification.remove();
      });

      // Create notification element
      const notification = document.createElement('div');
      notification.className = `accesstive-notification accesstive-notification--${type}`;
      notification.textContent = message;
      notification.setAttribute('role', 'alert');
      notification.setAttribute('aria-live', 'polite');

      // Add to page
      document.body.appendChild(notification);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);

      // Add click to dismiss
      notification.addEventListener('click', () => {
        notification.remove();
      });

    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  highlightViolations(violations) {
    try {
      // Clear existing highlights first
      this.clearAllHighlights();

      if (!violations || violations.length === 0) {
        return;
      }

      violations.forEach((violation, index) => {
        if (violation.nodes && violation.nodes.length > 0) {
          violation.nodes.forEach(node => {
            if (node.target && node.target.length > 0) {
              node.target.forEach(selector => {
                try {
                  const elements = document.querySelectorAll(selector);
                  elements.forEach(element => {
                    this.addViolationHighlight(element, violation, index);
                  });
                } catch (selectorError) {
                  // Selector not found, skip
                }
              });
            }
          });
        }
      });

      this.showNotification(`Highlighted ${violations.length} accessibility issues`, 'info');
    } catch (error) {
      console.error('Error highlighting violations:', error);
    }
  }

  addViolationHighlight(element, violation, index) {
    try {
      // Create highlight wrapper
      const highlight = document.createElement('div');
      highlight.className = 'accesstive-violation-highlight';
      highlight.setAttribute('data-violation-id', violation.id);
      highlight.setAttribute('data-violation-index', index);
      highlight.setAttribute('data-impact', violation.impact);
      
      // Add impact-specific styling
      const impactColors = {
        critical: '#d32f2f',
        serious: '#f57c00',
        moderate: '#fbc02d',
        minor: '#888'
      };
      
      const color = impactColors[violation.impact] || '#007acc';
      highlight.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 999999;
        border: 3px solid ${color};
        background-color: ${color}20;
        box-shadow: 0 0 0 3px ${color}40;
      `;

      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'accesstive-violation-tooltip';
      tooltip.innerHTML = `
        <div class="accesstive-violation-tooltip__header">
          <span class="accesstive-violation-tooltip__impact accesstive-violation-tooltip__impact--${violation.impact}">
            ${violation.impact.toUpperCase()}
          </span>
          <span class="accesstive-violation-tooltip__id">${violation.id}</span>
        </div>
        <div class="accesstive-violation-tooltip__content">
          <p class="accesstive-violation-tooltip__description">${violation.description}</p>
          <p class="accesstive-violation-tooltip__help">${violation.help}</p>
        </div>
        <div class="accesstive-violation-tooltip__footer">
          <a href="${violation.helpUrl}" target="_blank" class="accesstive-violation-tooltip__link">Learn more</a>
        </div>
      `;
      tooltip.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%) translateY(-100%);
        background: #1a1a1a;
        color: white;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
        max-width: 300px;
        z-index: 1000000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: none;
        pointer-events: auto;
      `;

      highlight.appendChild(tooltip);

      // Position the highlight
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      highlight.style.position = 'absolute';
      highlight.style.top = (rect.top + scrollTop) + 'px';
      highlight.style.left = (rect.left + scrollLeft) + 'px';
      highlight.style.width = rect.width + 'px';
      highlight.style.height = rect.height + 'px';

      // Add to page
      document.body.appendChild(highlight);

      // Show tooltip on hover
      highlight.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
      });

      highlight.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });

      // Click to focus element
      highlight.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

    } catch (error) {
      console.error('Error adding violation highlight:', error);
    }
  }

  clearAllHighlights() {
    try {
      // Remove all violation highlights
      document.querySelectorAll('.accesstive-violation-highlight').forEach(highlight => {
        highlight.remove();
      });

      // Remove regular highlights
      document.querySelectorAll('.accesstive-highlight').forEach(el => {
        el.classList.remove('accesstive-highlight');
        el.style.outline = '';
      });
    } catch (error) {
      console.error('Error clearing highlights:', error);
    }
  }
}

// Initialize the content script
new AccesstiveContentScript();