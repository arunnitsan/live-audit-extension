import styles from '../assets/scss/style-audit.scss?inline';
import 'tippy.js/dist/tippy.css';
import { nsaAuditResultStorage, nsaAuditSettingsStorage } from './nsaStorageHelper';
import NsaBaseAccesstive from './nsaBasePlugin';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { IssueCounter, AccessibilityIssue, GroupedData, AuditData } from './nsaAudit';
import areaIcon from '../assets/icons/area.svg?raw';
import textAlternativesIcon from '../assets/icons/text-alternatives.svg?raw';
import nameRoleValueIcon from '../assets/icons/name-role-value.svg?raw';
import semanticsIcon from '../assets/icons/semantics.svg?raw';
import formsIcon from '../assets/icons/forms.svg?raw';
import sensoryIcon from '../assets/icons/sensory.svg?raw';
import keyboardIcon from '../assets/icons/keyboard.svg?raw';
import colorIcon from '../assets/icons/color.svg?raw';
import structureIcon from '../assets/icons/structure.svg?raw';
import errorIcon from '../assets/icons/error.svg?raw';
import nextIcon from '../assets/icons/next.svg?raw';
import prevIcon from '../assets/icons/prev.svg?raw';
import helpIcon from '../assets/icons/help.svg?raw';
import aiSolutionIcon from '../assets/icons/ai-solution.svg?raw';
import chevronDownIcon from '../assets/icons/chevron-down.svg?raw';
import chevronUpIcon from '../assets/icons/chevron-up.svg?raw';
import NsaAiSolutionManager from './nsaAiSolution';

// Import shared templates
import {
  renderIssueDetails,
  createCodeEditor
} from './nsaTemplates';

class NsaTooltipManager extends NsaBaseAccesstive {
  private readonly nsaTooltipIconClass = 'nsa-audit-tooltip-icon';
  private readonly impactPriority = ['critical', 'serious', 'moderate', 'minor', 'passed'];
  private readonly voidAndWrappedElements = ['IMG', 'INPUT', 'VIDEO', 'PICTURE', 'SELECT', 'TEXTAREA', 'SVG', 'IFRAME', 'AUDIO', 'CANVAS', 'EMBED', 'OBJECT', 'SOURCE', 'TRACK', 'WBR', 'BUTTON'];
  private issues: AccessibilityIssue[] = [];
  private dropdown: HTMLSelectElement | null = null;
  private impactFilters: Record<string, HTMLInputElement> = {};
  private bestPracticeFilter: HTMLInputElement | null = null;
  private tippyMap: Map<Element, TippyInstance> = new Map();
  private issueIndexMap: Map<Element, number> = new Map();
  private elementsWithTooltips: Set<Element> = new Set();
  private highlightedElements: Set<Element> = new Set();
  private languageDropdown: HTMLSelectElement | null = null;
  private disabilityDropdown: HTMLSelectElement | null = null;
  private readonly aiSolutionManager: NsaAiSolutionManager;
  // Rate limiting for content script calls
  private contentScriptPending: Set<string> = new Set();
  private failedSelectors: Set<string> = new Set();

  constructor() {
    super();
    this.aiSolutionManager = new NsaAiSolutionManager();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Wait for Shadow DOM to be ready
      await this.waitForShadowDOM();

      // Initialize the tooltip manager
      this.nsaInitialize();
    } catch (error) {
      console.error('Failed to initialize tooltip manager:', error);
    }
  }

  private nsaInitialize(): void {
    this.nsaCacheElements();
    this.nsaLoadSettings();
    this.nsaSetupEventListeners();
    this.nsaLoadStoredAuditData();
    this.nsaSetupHighlightButtons();
    this.nsaSetupGlobalTooltipHandlers();
  }
  
  /**
   * Setup global tooltip handlers for better UX
   */
  private nsaSetupGlobalTooltipHandlers(): void {
    // Close all tooltips on Escape key
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.nsaCloseAllTooltips();
      }
    });
    
    // Close tooltips when clicking outside
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as Element;
      // Don't close if clicking on a tooltip icon or tooltip content
      if (!target.closest('.nsa-audit-tooltip-icon') && 
          !target.closest('[data-tippy-root]')) {
        this.nsaCloseAllTooltips();
      }
    });
    
    // Update tooltip positions on window resize with optimized debounce
    let resizeTimeout: number;
    let resizeAnimationFrame: number;
    window.addEventListener('resize', () => {
      // Cancel any pending updates
      clearTimeout(resizeTimeout);
      if (resizeAnimationFrame) {
        cancelAnimationFrame(resizeAnimationFrame);
      }
      
      // Immediate update for responsive feel
      resizeAnimationFrame = requestAnimationFrame(() => {
        this.nsaUpdateAllTooltipPositions();
      });
      
      // Final update after resize settles
      resizeTimeout = window.setTimeout(() => {
        this.nsaUpdateAllTooltipPositions();
      }, 100);
    });
    
    // Also update on scroll (for fixed positioning)
    let scrollTimeout: number;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        this.nsaUpdateAllTooltipPositions();
      }, 50);
    }, { passive: true });
    
    // Update tooltip positions when sidebar opens/closes
    this.shadowRoot?.addEventListener('nsaSidebarToggled', () => {
      setTimeout(() => {
        this.nsaUpdateAllTooltipPositions();
      }, 300); // Wait for sidebar animation
    });
    
    // Listen for DOM mutations that might affect layout
    const observer = new MutationObserver(() => {
      // Debounced update
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        this.nsaUpdateAllTooltipPositions();
      }, 200);
    });
    
    // Observe sidebar for size changes
    const sidebarWidget = document.getElementById('nsaAuditWidget');
    if (sidebarWidget) {
      observer.observe(sidebarWidget, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }
  }
  
  /**
   * Update positions of all tooltips (visible and hidden)
   * Uses requestAnimationFrame for smooth, performance-optimized updates
   */
  private nsaUpdateAllTooltipPositions(): void {
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      // Update each tooltip instance (don't close them)
      this.tippyMap.forEach((instance) => {
        try {
          // Force position recalculation
          if (instance.popperInstance) {
            instance.popperInstance.forceUpdate();
          }
          
          // If tooltip is visible, ensure it stays properly positioned
          if (instance.state.isVisible) {
            instance.popperInstance?.update();
          }
        } catch (error) {
          // Silently handle errors
        }
      });
    });
  }
  
  /**
   * Close all open tooltips
   */
  public nsaCloseAllTooltips(): void {
    this.tippyMap.forEach((instance) => {
      if (instance.state.isVisible) {
        instance.hide();
      }
    });
  }

  private nsaCacheElements(): void {
    this.dropdown = this.queryShadowSelector('#nsaStandardDropdown') as HTMLSelectElement;
    this.languageDropdown = this.queryShadowSelector('#nsaLanguageDropdown') as HTMLSelectElement;
    this.disabilityDropdown = this.queryShadowSelector('#nsaDisabilityDropdown') as HTMLSelectElement;
    this.impactFilters = {
      critical: this.queryShadowSelector('#nsaImpactCriticalFilter') as HTMLInputElement,
      serious: this.queryShadowSelector('#nsaImpactSeriousFilter') as HTMLInputElement,
      moderate: this.queryShadowSelector('#nsaImpactModerateFilter') as HTMLInputElement,
      minor: this.queryShadowSelector('#nsaImpactMinorFilter') as HTMLInputElement,
      passed: this.queryShadowSelector('#nsaImpactPassedFilter') as HTMLInputElement
    };
    this.bestPracticeFilter = this.queryShadowSelector('#nsaBestPracticeFilter') as HTMLInputElement;
  }

  private nsaSetupEventListeners(): void {
    if (!this.shadowRoot) return;

    this.dropdown?.addEventListener('change', () => this.nsaSaveSettings());
    this.disabilityDropdown?.addEventListener('change', () => this.nsaSaveSettings());
    Object.values(this.impactFilters).forEach(checkbox => {
      checkbox?.addEventListener('change', () => this.nsaSaveSettings());
    });
    this.bestPracticeFilter?.addEventListener('change', () => this.nsaSaveSettings());
  }

  public nsaSetupHighlightButtons(): void {
    if (!this.shadowRoot) return;

    document.querySelectorAll('.nsa-highlight-button')?.forEach((btn) => {
      btn.removeEventListener('click', this.handleHighlightClick);
      btn.addEventListener('click', this.handleHighlightClick);
    });
  }

  private handleHighlightClick = (e: Event) => {
    e.stopPropagation();
    const selector = (e.currentTarget as HTMLElement)?.getAttribute('data-selector');
    if (selector) this.nsaFocusTooltipForSelector(selector);
  };

  private nsaSaveSettings(): void {
    const settings = nsaAuditSettingsStorage.loadSettings() || {};
    settings.selectedStandard = this.dropdown?.value || 'wcag21aa';
    settings.selectedDisability = this.disabilityDropdown?.value || 'all';
    settings.impactFilters = settings.impactFilters || {};
    Object.entries(this.impactFilters).forEach(([impact, checkbox]) => {
      if (checkbox) {
        settings.impactFilters[impact] = checkbox.checked;
      }
    });
    const wasBestPracticeEnabled = settings.showBestPractice;
    settings.showBestPractice = this.bestPracticeFilter?.checked;
    nsaAuditSettingsStorage.saveSettings(settings);
    if (wasBestPracticeEnabled !== settings.showBestPractice) {
      const event = new CustomEvent('nsaBestPracticeFilterChanged', {
        detail: { showBestPractice: settings.showBestPractice }
      });
      this.shadowRoot?.dispatchEvent(event);
    }
    this.nsaFetchAuditData();
  }

  private nsaLoadSettings(): Record<string, any> {
    const settings = nsaAuditSettingsStorage.loadSettings();
    if (!settings.impactFilters) {
      settings.impactFilters = {
        critical: false,
        serious: false,
        moderate: false,
        minor: false,
        passed: false
      };
    }
    if (settings.showBestPractice === undefined) {
      settings.showBestPractice = true;
    }
    if (!settings.selectedDisability) {
      settings.selectedDisability = 'all';
    }
    return settings;
  }

  private nsaLoadStoredAuditData(): void {
    const storedData = nsaAuditResultStorage.loadSettings();
    if (!storedData || Object.keys(storedData).length === 0) return;
    const dataArray = Array.isArray(storedData) ? storedData : [storedData];
    this.nsaExtractIssues(dataArray);
  }

  private parseDisabilitiesFromHtml(disabilitiesAffected: string[]): string[] {
    if (!disabilitiesAffected || !Array.isArray(disabilitiesAffected)) {
      return [];
    }

    return disabilitiesAffected.map(disability => {
      // If it's already a string, return as is
      if (typeof disability === 'string') {
        // Remove HTML tags and get clean text
        return disability.replace(/<[^>]*>/g, '').trim().toLowerCase();
      }
      return '';
    }).filter(disability => disability.length > 0);
  }

  private issueAffectsDisability(issue: AccessibilityIssue, selectedDisability: string): boolean {
    if (selectedDisability === 'all') {
      return true;
    }

    if (!issue.disabilitiesAffected || !Array.isArray(issue.disabilitiesAffected)) {
      return false;
    }

    // Parse HTML content to get clean disability names
    const disabilityNames = this.parseDisabilitiesFromHtml(issue.disabilitiesAffected);

    // Map disability values to common disability types
    const disabilityMap: Record<string, string[]> = {
      'attention-deficit': ['attention', 'adhd', 'focus'],
      'blind': ['blind', 'blindness'],
      'deafblind': ['deafblind', 'deaf-blind'],
      'mobility': ['mobility', 'motor', 'physical'],
      'low-vision': ['low-vision', 'vision'],
      'colorblindness': ['colorblind', 'color-blind'],
      'keyboard': ['keyboard', 'keyboard-only'],
      'deaf': ['deaf', 'hearing'],
      'cognitive': ['cognitive', 'learning']
    };

    // Check if any of the disability names match the selected disability
    const keywords = disabilityMap[selectedDisability] || [];
    return disabilityNames.some(disabilityName =>
      keywords.some(keyword => disabilityName.includes(keyword))
    );
  }

  public nsaFetchAuditData(): void {
    try {
      const storedData = nsaAuditResultStorage.loadSettings();
      if (!storedData || Object.keys(storedData).length === 0) return;
      const dataArray = Array.isArray(storedData) ? storedData : [storedData];
      this.nsaExtractIssues(dataArray);
      this.nsaDestroyTooltips();
      this.nsaAttachTooltips();
    } catch (error) {
      console.error('Failed to fetch audit data:', error);
    }
  }

  private nsaExtractIssues(dataArray: AuditData[]): void {
    this.issues = [];
    if (!dataArray || dataArray.length === 0) return;
    const settings = this.nsaLoadSettings();
    const selectedStandard = settings?.selectedStandard || 'wcag21aa';
    IssueCounter.countIssues(dataArray, settings, selectedStandard, this.issueAffectsDisability.bind(this));
    dataArray.forEach(data => {
      Object.entries(data.grouped).forEach(([category, categoryData]: [string, GroupedData]) => {
        const cleanCategory = category.replace('cat.', '');
        ['errors', 'warnings', 'notices'].forEach(type => {
          const issueList = categoryData[type as keyof GroupedData] || [];
          issueList.forEach(issue => {
            if (selectedStandard !== 'tags' && !issue.tags?.includes(selectedStandard)) return;
            if (!settings.showBestPractice && issue.tags?.includes('best-practice')) return;
            const impactFiltersEnabled = Object.values(settings.impactFilters || {}).some(val => val);
            if (impactFiltersEnabled && !settings.impactFilters?.[issue.impact]) return;

            // Filter by disability if selected
            if (settings.selectedDisability && !this.issueAffectsDisability(issue, settings.selectedDisability)) return;

            // Skip issues with impact "passed" or null impact
            if (issue.impact === 'passed' || !issue.impact) return;

            // Only include critical, serious, moderate, and minor impacts
            if (!['critical', 'serious', 'moderate', 'minor'].includes(issue.impact)) return;

            if (!issue.selector || !issue.context) return;

            // Skip selectors that are widget attributes or sidebar elements
            if (this.isSidebarElementSelector(issue.selector) || !this.isValidAccessibilitySelector(issue.selector)) {
              console.log('⚠️ Tooltip Manager: Skipping invalid selector during issue extraction:', issue.selector);
              return;
            }

            this.issues.push({
              title: issue.title,
              message: issue.message,
              code: issue.code,
              selector: issue.selector,
              context: issue.context,
              category: cleanCategory,
              type: type as 'error' | 'warning' | 'notice',
              impact: issue.impact,
              level: issue.level || type as 'error' | 'warning' | 'notice',
              tags: issue.tags,
              helpUrl: issue.helpUrl,
              whyMatters: issue.whyMatters,
              fix: issue.fix,
              description: issue.description || issue.message,
              algorithmSimple: issue.algorithmSimple,
              wcagReferences: issue.wcagReferences,
              disabilitiesAffected: issue.disabilitiesAffected
            });
          });
        });
      });
    });
  }

  public nsaAttachTooltips(): void {
    this.nsaRemoveAllTooltips();
    this.nsaLoadStoredAuditData();
    const elementIssuesMap = this.nsaGroupIssuesByElement();
    elementIssuesMap.forEach((issues, element) => {
      if (issues.length > 0) {
        this.nsaAttachTooltip(element, issues);
      }
    });
  }

  private nsaGroupIssuesByElement(): Map<Element, AccessibilityIssue[]> {
    const elementIssuesMap = new Map<Element, AccessibilityIssue[]>();
    const settings = this.nsaLoadSettings();
    const impactFilters = settings?.impactFilters || {};
    const showBestPractice = settings?.showBestPractice ?? false;
    const hasActiveFilters = Object.values(impactFilters).some(val => val);

    const isIssueVisible = (issue: AccessibilityIssue): boolean => {
      // Skip issues with impact "passed" or null impact
      if (issue.impact === 'passed' || !issue.impact) return false;

      // Only show critical, serious, moderate, and minor impacts
      if (!['critical', 'serious', 'moderate', 'minor'].includes(issue.impact)) return false;

      const isBestPractice = issue.tags?.includes('best-practice');
      if (!hasActiveFilters) return isBestPractice ? showBestPractice : true;
      if (isBestPractice) return showBestPractice && impactFilters[issue.impact];
      return impactFilters[issue.impact];
    };

    // 🚀 PERFORMANCE: Cache selector lookups to avoid repeated queries
    const selectorCache = new Map<string, Element[]>();

    this.issues.forEach(issue => {
      try {
        // Use cached elements if available
        let elements = selectorCache.get(issue.selector);
        if (!elements) {
          elements = this.findElementsBySelector(issue.selector);
          selectorCache.set(issue.selector, elements);
        }

        elements.forEach(element => {
          if (!elementIssuesMap.has(element)) {
            elementIssuesMap.set(element, []);
          }
          if (isIssueVisible(issue)) {
            elementIssuesMap.get(element)?.push(issue);
          }
        });
      } catch (error) {
        console.error('Error processing issue:', error);
      }
    });

    // Remove elements that don't have any visible issues
    elementIssuesMap.forEach((issues, element) => {
      if (issues.length === 0) {
        elementIssuesMap.delete(element);
      }
    });

    // Sort remaining issues by impact priority
    elementIssuesMap.forEach((issues, element) => {
      const sortedIssues = issues.sort((a, b) => {
        const priorityA = this.impactPriority.indexOf(a.impact);
        const priorityB = this.impactPriority.indexOf(b.impact);
        return priorityA - priorityB;
      });
      elementIssuesMap.set(element, sortedIssues);
    });

    return elementIssuesMap;
  }

  private nsaRemoveAllTooltips(): void {
    // Remove all tooltip elements from the DOM
    document.querySelectorAll(`.${this.nsaTooltipIconClass}`).forEach(el => el.remove());

    // Remove sibling tooltips specifically
    document.querySelectorAll('.nsa-tooltip-sibling').forEach(el => el.remove());

    // Remove any sidebar tooltip indicators (fallback elements)
    document.querySelectorAll('.nsa-sidebar-tooltip-indicator').forEach(el => el.remove());

    // Destroy any remaining tippy instances
    this.tippyMap.forEach((instance) => instance?.destroy?.());

    // Clear all tracking collections
    this.tippyMap.clear();
    this.elementsWithTooltips.clear();
    this.issueIndexMap.clear();
    this.highlightedElements.clear();

    // Remove any highlight classes
    document.querySelectorAll('.nsa-audit-hover-highlight, .nsa-audit-highlight').forEach(el => {
      el.classList.remove('nsa-audit-hover-highlight', 'nsa-audit-highlight');
    });
  }

  private nsaAttachTooltip(element: Element, issues: AccessibilityIssue[]): void {
    try {
      if (element.closest('#nsaAuditWidget')) return;

      // Skip if no issues
      if (!issues || issues.length === 0) return;

      // Only violations and incomplete: critical, serious, moderate, minor
      const validIssues = issues.filter(issue =>
        issue.impact &&
        issue.impact !== 'passed' &&
        ['critical', 'serious', 'moderate', 'minor'].includes(issue.impact)
      );

      // Skip if no valid issues
      if (validIssues.length === 0) return;

      // Skip SOURCE tags inside PICTURE
      if (element.tagName === 'SOURCE' && element.closest('picture')) return;

      // ⚠️ CRITICAL: Validate element is visible and properly positioned
      if (!this.isElementValidForTooltip(element)) {
        return;
      }

      // First, remove any existing tooltip to avoid duplicates
      this.removeTooltipFromElement(element);

      // Create the tooltip icon - using the filtered valid issues
      const tooltipIcon = this.nsaCreateTooltipIcon(validIssues);

      // Use the consistent list for void elements that need special handling
      const isVoidElement = this.voidAndWrappedElements.includes(element.tagName);

      if (isVoidElement) {
        if (validIssues.some(issue => issue.impact !== 'passed')) {
          // Wrap void element in a relative positioned container
          const wrapper = document.createElement('span');
          wrapper.className = 'nsa-tooltip-wrapper';
          wrapper.style.position = 'relative';
          wrapper.style.display = 'inline-block';
          
          // Add data attribute to link tooltip to its target element
          tooltipIcon.setAttribute('data-target-element-id', this.generateUniqueId(element));
          tooltipIcon.setAttribute('data-original-element', element.tagName.toLowerCase());
          
          // Apply the unique ID to target element if it doesn't have one yet
          if (!element.id && !element.getAttribute('data-nsa-element-id')) {
            const uniqueId = this.generateUniqueId(element);
            element.setAttribute('data-nsa-element-id', uniqueId);
          }
          
          // Insert wrapper before element and move element into wrapper
          element.parentNode?.insertBefore(wrapper, element);
          wrapper.appendChild(element);
          wrapper.appendChild(tooltipIcon);
        } else {
          return;
        }
      } else {
        // Simple inline append - icon flows naturally with content
        // No need to modify parent styles
        element.appendChild(tooltipIcon);
      }

      // Mark this element as having a tooltip
      this.elementsWithTooltips.add(element);

      // Get current index or use default
      const currentIndex = this.issueIndexMap.get(element) || 0;

      // Setup tippy tooltip - using the filtered valid issues
      const instance = this.nsaSetupTooltipTippy(tooltipIcon, validIssues, currentIndex);

      // Store the tippy instance for this element
      this.tippyMap.set(element, instance);

    } catch (error) {
      console.error('Error in nsaAttachTooltip:', error);
    }
  }

  // Generate a consistent unique ID for an element
  /**
   * Validate if element is suitable for tooltip attachment
   * Prevents attaching tooltips to hidden, absolutely positioned, or problematic elements
   */
  private isElementValidForTooltip(element: Element): boolean {
    try {
      const htmlElement = element as HTMLElement;
      
      // Check if element is visible
      const rect = htmlElement.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return false; // Element has no dimensions
      }
      
      // Check computed styles
      const styles = window.getComputedStyle(htmlElement);
      
      // Skip hidden elements
      if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
        return false;
      }
      
      // Skip elements that are positioned off-screen or have fixed/absolute positioning
      // that might cause tooltip positioning issues
      const position = styles.position;
      if (position === 'fixed' || position === 'absolute') {
        // Only skip if the element is positioned off-screen
        if (rect.top < -1000 || rect.left < -1000 || 
            rect.top > window.innerHeight + 1000 || 
            rect.left > window.innerWidth + 1000) {
          return false;
        }
      }
      
      // Skip elements that are too small (likely hidden or decorative)
      if (rect.width < 2 && rect.height < 2) {
        return false;
      }
      
      return true;
    } catch (error) {
      // If we can't validate, skip it
      return false;
    }
  }

  private generateUniqueId(element: Element): string {
    // Use existing ID if available
    if (element.id) return element.id;
    if (element.getAttribute('data-nsa-element-id')) {
      return element.getAttribute('data-nsa-element-id') as string;
    }

    // Create a unique ID based on element properties
    const tag = element.tagName.toLowerCase();
    const classes = element.className ? element.className.replace(/\s+/g, '-') : '';
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    return `nsa-${tag}${classes ? '-' + classes : ''}-${timestamp}-${randomSuffix}`;
  }

  private nsaCreateTooltipIcon(issues: AccessibilityIssue[]): HTMLElement {
    const tooltipIcon = document.createElement('span');
    tooltipIcon.className = `${this.nsaTooltipIconClass} nsa-impact-${issues[0].impact}`;
    
    // Inline-block positioning for maximum compatibility
    tooltipIcon.style.display = 'inline-flex';
    tooltipIcon.style.cursor = 'pointer';
    tooltipIcon.style.transition = 'all 0.2s ease';
    tooltipIcon.style.margin = '0 0 0 8px';
    tooltipIcon.style.verticalAlign = 'middle';
    tooltipIcon.style.position = 'relative'; // Anchor for tippy positioning
    
    // Hover effect
    tooltipIcon.addEventListener('mouseenter', () => {
      tooltipIcon.style.transform = 'scale(1.15)';
    });
    tooltipIcon.addEventListener('mouseleave', () => {
      tooltipIcon.style.transform = 'scale(1)';
    });

    let iconSvg = '';
    const title = issues[0].category.toLowerCase();

    const categoryIconMap: Record<string, string> = {
      'text-alternatives': textAlternativesIcon,
      'color': colorIcon,
      'keyboard': keyboardIcon,
      'form': formsIcon,
      'structure': structureIcon,
      'area': areaIcon,
      'name-role-value': nameRoleValueIcon,
      'semantics': semanticsIcon,
      'sensory-and-visual-cues': sensoryIcon,
      'time-and-media': errorIcon,
      'tables': errorIcon,
      'language': errorIcon,
      'parsing': errorIcon
    };

    iconSvg = categoryIconMap[title] || errorIcon;

    const iconContainer = document.createElement('div');
    iconContainer.innerHTML = iconSvg;
    iconContainer.style.width = '22px';
    iconContainer.style.height = '22px';
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.lineHeight = '1';

    tooltipIcon.appendChild(iconContainer);
    tooltipIcon.setAttribute('tabindex', '0');
    tooltipIcon.setAttribute('role', 'button');
    tooltipIcon.setAttribute('aria-label', `${issues.length} accessibility issue${issues.length > 1 ? 's' : ''}`);

    // Store the selector on the tooltip icon for hover highlighting
    tooltipIcon.setAttribute('data-target-selector', issues[0].selector);

    // Add hover event listeners to highlight the element
    tooltipIcon.addEventListener('mouseenter', () => {
      this.highlightElementByTooltipIcon(tooltipIcon, true);
    });

    tooltipIcon.addEventListener('mouseleave', () => {
      this.highlightElementByTooltipIcon(tooltipIcon, false);
    });

    if (issues.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'nsa-tooltip-badge';
      badge.textContent = issues.length.toString();
      tooltipIcon.appendChild(badge);
    }

    return tooltipIcon;
  }

  private highlightElementByTooltipIcon(tooltipIcon: HTMLElement, isHovering: boolean): void {
    try {
      // First try finding element by selector
      const selector = tooltipIcon.getAttribute('data-target-selector');
      if (!selector) return;

      // If we're highlighting a new element, first remove all existing highlights
      if (isHovering) {
        this.removeAllHoverHighlights();
      }

      // For sibling tooltips, check for target element ID
      let elements: Element[] = [];
      const targetElementId = tooltipIcon.getAttribute('data-target-element-id');

      if (targetElementId) {
        // Try to find the element by ID or data-nsa-element-id attribute
        const targetElement = document.querySelector(`[data-nsa-element-id="${targetElementId}"]`) as HTMLElement;
        if (targetElement) {
          elements = [targetElement];
        }
      }

      // If no elements found by ID, try selector
      if (elements.length === 0) {
        elements = this.findElementsBySelector(selector);
      }

      if (elements.length === 0) return;

      // Apply or remove highlight class to/from all matching elements
      elements.forEach(element => {
        if (isHovering) {
          element.classList.add('nsa-audit-hover-highlight');
          this.highlightedElements.add(element);
        } else {
          element.classList.remove('nsa-audit-hover-highlight');
          this.highlightedElements.delete(element);
        }
      });
    } catch (error) {
      console.error('Error in highlightElementByTooltipIcon:', error);
    }
  }

  // New method to remove all hover highlights
  private removeAllHoverHighlights(): void {
    this.highlightedElements.forEach(element => {
      element.classList.remove('nsa-audit-hover-highlight');
    });
    this.highlightedElements.clear();
  }

  private nsaSetupTooltipTippy(tooltipIcon: HTMLElement, issues: AccessibilityIssue[], initialIndex: number = 0): TippyInstance {
    try {
      const sortedIssues = [...issues].sort((a, b) =>
        this.impactPriority.indexOf(a.impact) - this.impactPriority.indexOf(b.impact)
      );

      // Create a container for the tooltip content
      const tooltipContainer = document.createElement('div');
      tooltipContainer.id = 'nsa-tooltip-container';

      // Create Shadow DOM for the tooltip content
      const shadowRoot = tooltipContainer.attachShadow({ mode: 'open' });

      // Add styles to the Shadow DOM
      const style = document.createElement('style');
      style.textContent = styles;
      shadowRoot.appendChild(style);

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'nsa-tooltip-content-wrapper';
      let currentIndex = initialIndex;

      // Validate initialIndex is within bounds
      if (initialIndex < 0 || initialIndex >= sortedIssues.length) {
        console.warn(`initialIndex ${initialIndex} out of bounds, resetting to 0`);
        currentIndex = 0;
      }

      // Store the current index in the parent element and tooltip itself
      if (tooltipIcon.parentElement) {
        this.issueIndexMap.set(tooltipIcon.parentElement, currentIndex);
        tooltipIcon.parentElement.setAttribute('data-nsa-current-issue-index', currentIndex.toString());
      }
      tooltipIcon.setAttribute('data-current-issue-index', currentIndex.toString());

      const renderIssue = (index: number) => {
        if (index < 0 || index >= sortedIssues.length) {
          console.warn(`Render issue index ${index} out of bounds, resetting to 0`);
          index = 0;
        }

        const issue = sortedIssues[index];
        this.updateTooltipIcon(tooltipIcon, issue);

        // Use the shared template for issue details
        // Set dropdown to FALSE so details are visible immediately
        return renderIssueDetails(
          issue,
          index,
          {
            helpIcon: helpIcon,
            aiSolutionIcon: aiSolutionIcon,
            chevronDownIcon: chevronDownIcon,
            chevronUpIcon: chevronUpIcon,
            showButtons: true,
            dropdown: false  // FALSE = show details immediately
          }
        );
      };

      // Create and set up navigation controls
      const navControls = document.createElement('div');
      // Show navigation controls only when we have multiple issues
      navControls.className = sortedIssues.length > 1
        ? 'nsa-tooltip-nav nsa-tooltip-nav--visible'
        : 'nsa-tooltip-nav nsa-hidden';

      const prevBtn = document.createElement('button');
      const nextBtn = document.createElement('button');
      prevBtn.className = 'nsa-tooltip-prev';
      nextBtn.className = 'nsa-tooltip-next';
      prevBtn.innerHTML = prevIcon;
      nextBtn.innerHTML = nextIcon;

      // Disable prev button if we're at the first issue
      prevBtn.disabled = currentIndex === 0;
      // Disable next button if we're at the last issue
      nextBtn.disabled = currentIndex === sortedIssues.length - 1;

      // Add counter for multiple issues
      if (sortedIssues.length > 1) {
        const counter = document.createElement('div');
        counter.className = 'nsa-tooltip-counter';
        counter.innerHTML = `<span class="nsa-node-current">${currentIndex + 1}</span> / <span class="nsa-node-total">${sortedIssues.length}</span>`;
        navControls.appendChild(prevBtn);
        navControls.appendChild(counter);
        navControls.appendChild(nextBtn);
      }

      const nsaBody = document.createElement('div');
      nsaBody.className = 'nsa-tooltip-body';
      nsaBody.innerHTML = renderIssue(currentIndex);

      const updateNav = () => {
        try {
          nsaBody.innerHTML = renderIssue(currentIndex);

          // Update counter
          const currentElem = navControls.querySelector('.nsa-node-current');
          if (currentElem) {
            currentElem.textContent = (currentIndex + 1).toString();
          }

          // Update button states
          prevBtn.disabled = currentIndex === 0;
          nextBtn.disabled = currentIndex === sortedIssues.length - 1;

          // Store the updated index in relevant places
          if (tooltipIcon.parentElement) {
            this.issueIndexMap.set(tooltipIcon.parentElement, currentIndex);
            tooltipIcon.parentElement.setAttribute('data-nsa-current-issue-index', currentIndex.toString());
          }

          tooltipIcon.setAttribute('data-current-issue-index', currentIndex.toString());
        } catch (error) {
          console.error('Error updating tooltip navigation:', error);
        }
      };

      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex > 0) {
          currentIndex--;
          updateNav();
        }
      });

      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex < sortedIssues.length - 1) {
          currentIndex++;
          updateNav();
        }
      });

      contentWrapper.appendChild(navControls);
      contentWrapper.appendChild(nsaBody);
      shadowRoot.appendChild(contentWrapper);
      updateNav();

      // Add event listeners for AI solution buttons in the tooltip
      shadowRoot.addEventListener('click', (e) => {
        const target = e.target as Element;
        const aiSolutionButton = target.closest('.nsa-ai-solution-button');
        if (aiSolutionButton) {
          e.stopPropagation();
          const issueIndex = parseInt(aiSolutionButton.getAttribute('data-issue-index') || '0', 10);
          const issueItem = aiSolutionButton.closest('.nsa-tooltip-issue');
          if (!issueItem) return;

          // Extract issue details
          const issueTitle = issueItem.querySelector('.nsa-issue-title')?.textContent || '';
          const issueDescription = issueItem.querySelector('.nsa-issue-message-container')?.textContent || '';
          const issueCode = issueItem.querySelector('.nsa-issue-code')?.textContent || '';
          const issueContext = issueItem.querySelector('.nsa-code-content')?.textContent || '';
          const selector = aiSolutionButton.getAttribute('data-selector') || '';
          const tags = issueItem.querySelector('.nsa-issue-tags')?.innerHTML || '';

          // Create issue data object
          const issueData = {
            title: issueTitle,
            message: issueDescription,
            code: issueCode,
            context: issueContext,
            selector: selector,
            index: issueIndex,
            currentLanguage: this.languageDropdown?.value || 'en',
            tags: tags
          };

          // Use the AI solution manager to show the modal and handle the request
          this.aiSolutionManager.showAiSolutionModal(issueData);
          this.handleLanguageChange();
        }
      });

      const tippyInstance = tippy(tooltipIcon, {
        content: tooltipContainer,
        allowHTML: true,
        interactive: true,
        // Smart placement: try top first, then bottom, right, left
        placement: 'top',
        popperOptions: {
          modifiers: [
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['bottom', 'right', 'left', 'top'],
                padding: 8,
              },
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 8,
                altAxis: true,
                tether: false, // Allow tooltip to break free if needed
              },
            },
            {
              name: 'offset',
              options: {
                offset: [0, 12], // Increased spacing for better visibility
              },
            },
            {
              name: 'computeStyles',
              options: {
                adaptive: true, // Adapt to scroll containers
                roundOffsets: ({ x, y }: any) => ({
                  x: Math.round(x),
                  y: Math.round(y),
                }),
              },
            },
          ],
          strategy: 'fixed', // Fixed positioning for consistent behavior across resize
        },
        theme: 'nsa-audit',
        // Only click to open - no accidental hover triggers
        trigger: 'click',
        // Hide when clicking outside
        hideOnClick: true,
        // Animation for smooth UX
        animation: 'shift-toward-subtle',
        duration: [200, 150],
        zIndex: 9999999999,
        maxWidth: 480,
        // Always append to document.body for most reliable positioning
        appendTo: () => document.body,
        // SINGLETON: Close other tooltips when opening this one
        onCreate: (instance) => {
          instance.popper.addEventListener('click', (e) => {
            e.stopPropagation();
          });
        },
        onShow: (instance) => {
          // Close all other tooltips first (singleton behavior)
          this.tippyMap.forEach((otherInstance, element) => {
            if (otherInstance !== instance && otherInstance.state.isVisible) {
              otherInstance.hide();
            }
          });
          
          // Force position update when showing
          setTimeout(() => {
            instance.popperInstance?.update();
          }, 10);
          
          try {
            if (tooltipIcon.parentElement) {
              const storedIndex = this.issueIndexMap.get(tooltipIcon.parentElement);
              if (typeof storedIndex === 'number') {
                if (storedIndex !== currentIndex) {
                  currentIndex = storedIndex;
                  updateNav();
                }
              }

              // Check for a forced target index (from highlight button click)
              const targetIndex = tooltipIcon.parentElement.getAttribute('data-nsa-target-issue-index');
              if (targetIndex !== null) {
                const targetIndexNum = parseInt(targetIndex, 10);
                // Use the target index if valid
                if (!isNaN(targetIndexNum) && targetIndexNum >= 0 && targetIndexNum < sortedIssues.length) {
                  currentIndex = targetIndexNum;
                  updateNav();
                  // Clear it to avoid reusing
                  tooltipIcon.parentElement.removeAttribute('data-nsa-target-issue-index');
                }
              }
            }
          } catch (error) {
            console.error('Error in onShow callback:', error);
          }
        },
        onShown: (instance) => {
          // Final position update after shown
          instance.popperInstance?.update();
        },
        onHide: () => {
          // Ensure the currentIndex is saved when tooltip is hidden
          try {
            if (tooltipIcon.parentElement) {
              this.issueIndexMap.set(tooltipIcon.parentElement, currentIndex);
              tooltipIcon.parentElement.setAttribute('data-nsa-current-issue-index', currentIndex.toString());
            }
            tooltipIcon.setAttribute('data-current-issue-index', currentIndex.toString());
          } catch (error) {
            console.error('Error in onHide callback:', error);
          }
        }
      });

      // Return the first tippy instance
      if (Array.isArray(tippyInstance) && tippyInstance.length > 0) {
        return tippyInstance[0];
      } else if (!Array.isArray(tippyInstance)) {
        return tippyInstance;
      } else {
        console.error('Failed to create tippy instance');
        throw new Error('Failed to create tippy instance');
      }
    } catch (error) {
      console.error('Error in nsaSetupTooltipTippy:', error);
      throw error;
    }
  }

  private updateTooltipIcon(tooltipIcon: HTMLElement, issue: AccessibilityIssue): void {
    tooltipIcon.className = `${this.nsaTooltipIconClass} nsa-impact-${issue.impact}`;
    let iconSvg = '';
    const title = issue.category;
    const categoryIconMap: Record<string, string> = {
      'text-alternatives': textAlternativesIcon,
      'color': colorIcon,
      'keyboard': keyboardIcon,
      'form': formsIcon,
      'structure': structureIcon,
      'aria': areaIcon,
      'name-role-value': nameRoleValueIcon,
      'semantics': semanticsIcon,
      'sensory-and-visual-cues': sensoryIcon,
      'time-and-media': errorIcon,
      'tables': errorIcon,
      'language': errorIcon,
      'parsing': errorIcon
    };

    iconSvg = categoryIconMap[title] || errorIcon;

    const iconContainer = tooltipIcon.querySelector('div');
    if (iconContainer) {
      iconContainer.innerHTML = iconSvg;
    }
  }

  public nsaFocusTooltipForSelector(selector: string): void {
    const targetEl = document.querySelector(selector) as HTMLElement;
    if (!targetEl) return;

    // Use the consistent list for void elements
    const isVoidElement = this.voidAndWrappedElements.includes(targetEl.tagName);

    // For void elements, look for sibling tooltip
    let tooltipIcon: HTMLElement | null = null;
    if (isVoidElement) {
      // Check for sibling tooltip by target element ID
      const targetId = targetEl.id || targetEl.getAttribute('data-nsa-element-id');
      if (targetId) {
        tooltipIcon = document.querySelector(`.${this.nsaTooltipIconClass}[data-target-element-id="${targetId}"]`) as HTMLElement;
      }

      // If not found, look for subsequent sibling
      if (!tooltipIcon && targetEl.nextElementSibling &&
          targetEl.nextElementSibling.classList.contains(this.nsaTooltipIconClass)) {
        tooltipIcon = targetEl.nextElementSibling as HTMLElement;
      }

      // If still not found, try all siblings
      if (!tooltipIcon && targetEl.parentElement) {
        const siblings = Array.from(targetEl.parentElement.children);
        for (const sibling of siblings) {
          if (sibling !== targetEl &&
              sibling.classList.contains(this.nsaTooltipIconClass) &&
              (sibling as HTMLElement).getAttribute('data-original-element')?.toLowerCase() === targetEl.tagName.toLowerCase()) {
            tooltipIcon = sibling as HTMLElement;
            break;
          }
        }
      }
    } else {
      // For non-void elements, tooltip is a child
      tooltipIcon = targetEl.querySelector(`.${this.nsaTooltipIconClass}`) as HTMLElement;
    }

    if (!tooltipIcon) return;

    this.issueIndexMap.set(targetEl, 0);
    tooltipIcon.focus();
    tooltipIcon.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const tippyInstance = this.tippyMap.get(targetEl);
    if (tippyInstance) {
      this.updateTooltipContent(targetEl);
      tippyInstance.show();
    }
  }

  public nsaFocusTooltipWithIssueIndex(selector: string, issueIndex: number, forceExactIndex: boolean = false): void {
    try {
      // Find elements matching selector
      const elements = this.findElementsBySelector(selector);
      if (elements.length === 0) {
        return;
      }

      // Get the first matching element
      const element = elements[0];
      if (!element) return;

      // Generate a unique ID for this element if it doesn't have one
      const elementId = element.getAttribute('data-nsa-element-id') || `target-${selector.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
      element.setAttribute('data-nsa-element-id', elementId);
      element.setAttribute('data-nsa-debug-id', elementId);

      // Clean up any existing tooltips to avoid duplicates
      this.removeTooltipFromElement(element);

      // Get issues for this element before trying to find/create tooltip
      let issues = this.getIssuesForElement(element);
      if (!issues || issues.length === 0) {
        // Fallback to use any issues for this selector
        const issuesForSelector = this.issues.filter(issue => issue.selector === selector);
        if (issuesForSelector.length === 0) {
          return;
        }
        issues = issuesForSelector;
      }

      // Filter issues to only include those with valid impacts (not passed or null)
      issues = issues.filter(issue =>
        issue.impact &&
        issue.impact !== 'passed' &&
        ['critical', 'serious', 'moderate', 'minor'].includes(issue.impact)
      );

      // If no valid issues remain after filtering, exit
      if (issues.length === 0) return;

      // Store the original global issue index for reference
      const globalIssueIndex = issueIndex;
      element.setAttribute('data-nsa-global-issue-index', globalIssueIndex.toString());

      // Sort issues by impact priority to ensure consistent ordering
      const sortedIssues = [...issues].sort((a, b) =>
        this.impactPriority.indexOf(a.impact) - this.impactPriority.indexOf(b.impact)
      );

      let localIssueIndex = 0; // Default to first issue

      // When forceExactIndex is true, we need to find the corresponding local index
      if (forceExactIndex) {
        // Get all issues (globally) sorted by the same criteria as our local issues
        const allIssuesSorted = this.issues
          .filter(issue =>
            issue.impact &&
            issue.impact !== 'passed' &&
            ['critical', 'serious', 'moderate', 'minor'].includes(issue.impact)
          )
          .sort((a, b) => this.impactPriority.indexOf(a.impact) - this.impactPriority.indexOf(b.impact));

        // Try to find the global issue
        const globalIssue = allIssuesSorted[globalIssueIndex];

        if (globalIssue) {
          // Look for the exact same issue in our local sorted issues
          const exactMatchIndex = sortedIssues.findIndex(issue =>
            issue.selector === globalIssue.selector &&
            issue.title === globalIssue.title &&
            issue.message === globalIssue.message &&
            issue.code === globalIssue.code
          );

          if (exactMatchIndex !== -1) {
            // Found an exact match in the local issues
            localIssueIndex = exactMatchIndex;
          } else {
            // If no exact match, try matching just by selector and title
            const selectorTitleMatchIndex = sortedIssues.findIndex(issue =>
              issue.selector === globalIssue.selector &&
              issue.title === globalIssue.title
            );

            if (selectorTitleMatchIndex !== -1) {
              localIssueIndex = selectorTitleMatchIndex;
            }
          }
        }
      } else {
        // When not forcing exact index, just validate the provided index
        if (issueIndex >= 0 && issueIndex < sortedIssues.length) {
          localIssueIndex = issueIndex;
        }
      }

      // Store the issue index for this element
      this.issueIndexMap.set(element, localIssueIndex);
      element.setAttribute('data-nsa-issue-index', localIssueIndex.toString());

      // Also store the mapping between global and local indices for future reference
      element.setAttribute('data-nsa-index-mapping',
                           JSON.stringify({global: globalIssueIndex, local: localIssueIndex}));

      // Store the target issue index so it can be picked up in the tooltip setup
      element.setAttribute('data-nsa-target-issue-index', globalIssueIndex.toString());

      // Create tooltip for the element
      this.nsaAttachTooltip(element, sortedIssues);

      // Find the newly created tooltip icon - handling both void and non-void elements
      const isVoidElement = this.voidAndWrappedElements.includes(element.tagName);

      let tooltipIcon: HTMLElement | null = null;
      if (isVoidElement) {
        // Check for sibling tooltip by target element ID
        const targetId = element.id || element.getAttribute('data-nsa-element-id');
        if (targetId) {
          tooltipIcon = document.querySelector(`.${this.nsaTooltipIconClass}[data-target-element-id="${targetId}"]`) as HTMLElement;
        }

        // If not found, look for subsequent sibling
        if (!tooltipIcon && element.nextElementSibling &&
            element.nextElementSibling.classList.contains(this.nsaTooltipIconClass)) {
          tooltipIcon = element.nextElementSibling as HTMLElement;
        }

        // If still not found, check all siblings
        if (!tooltipIcon && element.parentElement) {
          const siblings = Array.from(element.parentElement.children);
          for (const sibling of siblings) {
            if (sibling !== element &&
                sibling.classList.contains(this.nsaTooltipIconClass) &&
                (sibling as HTMLElement).getAttribute('data-original-element')?.toLowerCase() === element.tagName.toLowerCase()) {
              tooltipIcon = sibling as HTMLElement;
              break;
            }
          }
        }

        // Legacy: Also check wrapper (for backward compatibility)
        if (!tooltipIcon) {
          const wrapper = element.closest('.nsa-tooltip-wrapper');
          if (wrapper) {
            tooltipIcon = wrapper.querySelector(`.${this.nsaTooltipIconClass}`) as HTMLElement;
          }
        }
      } else {
        tooltipIcon = element.querySelector(`.${this.nsaTooltipIconClass}`) as HTMLElement;
      }

      if (!tooltipIcon) {
        console.error('Failed to find or create tooltip icon');
        return;
      }

      // Add indicator of global issue index for debugging
      tooltipIcon.setAttribute('data-global-issue-index', globalIssueIndex.toString());
      tooltipIcon.setAttribute('data-local-issue-index', localIssueIndex.toString());

      // Make element visible
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Focus the tooltip
      tooltipIcon.focus();

      // Get the tippy instance
      const tippyInstance = this.tippyMap.get(element);
      if (!tippyInstance) {
        console.error('Failed to get tippy instance');
        return;
      }

      // Ensure the correct index is set before showing the tooltip
      if (tooltipIcon.parentElement) {
        this.issueIndexMap.set(tooltipIcon.parentElement, localIssueIndex);
      }

      // Show the tooltip immediately
      tippyInstance.show();

      // Force update the issue content with the specific index
      setTimeout(() => {
        try {
          if (tippyInstance && tippyInstance.popper) {
            // Force update current index in case it's still not correct
            const popperWrapper = tippyInstance.popper.querySelector('.nsa-tooltip-content-wrapper');
            if (popperWrapper) {
              const nsaBody = popperWrapper.querySelector('.nsa-tooltip-body');
              const navControls = popperWrapper.querySelector('.nsa-tooltip-nav');
              if (nsaBody && navControls) {
                // Get the rendering function for the current issue
                const renderCurrentIssue = () => {
                  if (localIssueIndex < 0 || localIssueIndex >= sortedIssues.length) {
                    console.error(`Invalid issue index: ${localIssueIndex}, using 0 instead`);
                    localIssueIndex = 0;
                  }

                  const issue = sortedIssues[localIssueIndex];
                  if (!issue) {
                    console.error(`No issue found at index ${localIssueIndex}`);
                    return;
                  }

                  // Update the tooltip icon to match current issue
                  this.updateTooltipIcon(tooltipIcon, issue);

                  // Generate HTML for current issue
                  // Set dropdown to FALSE so details are visible immediately
                  const issueHTML = renderIssueDetails(
                    issue,
                    localIssueIndex,
                    {
                      helpIcon: helpIcon,
                      aiSolutionIcon: aiSolutionIcon,
                      chevronDownIcon: chevronDownIcon,
                      chevronUpIcon: chevronUpIcon,
                      showButtons: true,
                      dropdown: false  // FALSE = show details immediately
                    }
                  );

                  // Update the content
                  nsaBody.innerHTML = issueHTML;

                  // Update navigation buttons
                  const prevBtn = navControls.querySelector('.nsa-tooltip-prev') as HTMLButtonElement;
                  const nextBtn = navControls.querySelector('.nsa-tooltip-next') as HTMLButtonElement;
                  if (prevBtn) prevBtn.disabled = localIssueIndex === 0;
                  if (nextBtn) nextBtn.disabled = localIssueIndex === sortedIssues.length - 1;

                  // Update counter
                  const currentElem = navControls.querySelector('.nsa-node-current');
                  if (currentElem) {
                    currentElem.textContent = (localIssueIndex + 1).toString();
                  }

                  // Update total counter
                  const totalElem = navControls.querySelector('.nsa-node-total');
                  if (totalElem) {
                    totalElem.textContent = sortedIssues.length.toString();
                  }
                };

                // Render the current issue
                renderCurrentIssue();

                // Also update event listeners to ensure navigation works
                const prevBtn = navControls.querySelector('.nsa-tooltip-prev');
                const nextBtn = navControls.querySelector('.nsa-tooltip-next');

                if (prevBtn) {
                  prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (localIssueIndex > 0) {
                      localIssueIndex--;
                      renderCurrentIssue();
                      this.issueIndexMap.set(element, localIssueIndex);
                      element.setAttribute('data-nsa-issue-index', localIssueIndex.toString());
                    }
                  });
                }

                if (nextBtn) {
                  nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (localIssueIndex < sortedIssues.length - 1) {
                      localIssueIndex++;
                      renderCurrentIssue();
                      this.issueIndexMap.set(element, localIssueIndex);
                      element.setAttribute('data-nsa-issue-index', localIssueIndex.toString());
                    }
                  });
                }
              }
            }

            // Make sure navigation is visible for multiple issues
            if (sortedIssues.length > 1) {
              const navControls = tippyInstance.popper.querySelector('.nsa-tooltip-nav');
              if (navControls) {
                navControls.classList.remove('nsa-hidden');
                navControls.classList.add('nsa-tooltip-nav--visible');
              }
            }
          }
        } catch (error) {
          console.error('Error updating tooltip navigation:', error);
        }
      }, 50);
    } catch (error) {
      console.error('Error in nsaFocusTooltipWithIssueIndex:', error);
    }
  }

  // Make this method public so it can be called from outside
  public removeTooltipFromElement(element: Element): void {
    try {
      // Use the consistent list for void elements
      const isVoidElement = this.voidAndWrappedElements.includes(element.tagName);

      if (isVoidElement) {
        // Check for sibling tooltip
        const elementId = element.id || element.getAttribute('data-nsa-element-id');
        let tooltipIcon: Element | null = null;

        if (elementId) {
          // Find by target element ID
          tooltipIcon = document.querySelector(`.${this.nsaTooltipIconClass}[data-target-element-id="${elementId}"]`);
        }

        // If not found but it's the next sibling
        if (!tooltipIcon && element.nextElementSibling &&
            element.nextElementSibling.classList.contains(this.nsaTooltipIconClass)) {
          tooltipIcon = element.nextElementSibling;
        }

        // If still not found, check all siblings
        if (!tooltipIcon && element.parentElement) {
          const siblings = Array.from(element.parentElement.children);
          for (const sibling of siblings) {
            if (sibling !== element &&
                sibling.classList.contains(this.nsaTooltipIconClass) &&
                (sibling as HTMLElement).getAttribute('data-original-element')?.toLowerCase() === element.tagName.toLowerCase()) {
              tooltipIcon = sibling;
              break;
            }
          }
        }

        // Legacy: also check for a wrapper (for backward compatibility)
        if (!tooltipIcon) {
          const wrapper = element.closest('.nsa-tooltip-wrapper');
          if (wrapper) {
            tooltipIcon = wrapper.querySelector(`.${this.nsaTooltipIconClass}`);
          }
        }

        if (tooltipIcon) {
          // If tippy instance exists, destroy it
          const tippyInstance = this.tippyMap.get(element);
          if (tippyInstance) {
            tippyInstance.destroy();
            this.tippyMap.delete(element);
          }
          tooltipIcon.remove();
        }
      } else {
        // For non-void elements, tooltip is directly on the element
        const tooltipIcon = element.querySelector(`.${this.nsaTooltipIconClass}`);
        if (tooltipIcon) {
          // If tippy instance exists, destroy it
          const tippyInstance = this.tippyMap.get(element);
          if (tippyInstance) {
            tippyInstance.destroy();
            this.tippyMap.delete(element);
          }
          tooltipIcon.remove();
        }
      }

      // Mark element as not having a tooltip
      this.elementsWithTooltips.delete(element);
    } catch (error) {
      console.error('Error removing tooltip from element:', error);
    }
  }

  public updateTooltipContent(element: Element): void {
    const tippyInstance = this.tippyMap.get(element);
    if (tippyInstance) {
      const issues = this.issues.filter(issue => issue.selector === element.getAttribute('data-nsa-selector'));
      tippyInstance.setContent(this.nsaCreateTooltipIcon(issues));
      this.nsaSetupHighlightButtons();
    }
  }

  public nsaDestroyTooltips(): void {
    document.querySelectorAll(`.${this.nsaTooltipIconClass}`).forEach(icon => icon.remove());
    this.tippyMap.forEach(instance => instance?.destroy());
    this.tippyMap.clear();
  }

  public nsaCreateCodeEditor(content: string): string {
    // Use shared createCodeEditor function
    return createCodeEditor(content);
  }

  private findElementsBySelector(selector: string): Element[] {
    try {
      if (this.isHiddenElementSelector(selector)) {
        return [];
      }

      // Skip selectors that target sidebar elements (extension's own UI)
      if (this.isSidebarElementSelector(selector)) {
        return [];
      }

      // Validate that this is a proper accessibility issue selector
      if (!this.isValidAccessibilitySelector(selector)) {
        return [];
      }

      // Skip if already failed multiple times
      if (this.failedSelectors.has(selector)) {
        return [];
      }

      // 🚀 PERFORMANCE: Try local querySelector FIRST
      try {
        const localElements = Array.from(document.querySelectorAll(selector));
        
        if (localElements.length > 0) {
          // Filter out extension UI elements
          const validElements = localElements.filter(el => 
            !el.closest('#nsaAuditWidget') && 
            !el.classList.contains('nsa-audit-tooltip-icon')
          );
          
          if (validElements.length > 0) {
            return validElements;
          }
        }
      } catch (localError) {
        // Silently fail and try content script
      }

      // Only delegate to content script if not already pending
      if (!this.contentScriptPending.has(selector)) {
        this.contentScriptPending.add(selector);
        this.findElementsInActiveTab(selector).finally(() => {
          this.contentScriptPending.delete(selector);
        });
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if a selector targets sidebar elements (extension's own UI)
   */
  private isSidebarElementSelector(selector: string): boolean {
    if (!selector) return false;

    // List of selectors that target sidebar/extension elements
    const sidebarSelectors = [
      'data-nsalabel',      // Widget translation attribute
      'nsa-',              // NSA extension prefix
      'nsaTooltip',        // NSA tooltip class
      'nsa-audit',         // NSA audit classes
      'nsa-widget',        // NSA widget classes
      'nsa-sidebar',       // NSA sidebar classes
      'nsa-toggle',        // NSA toggle classes
      'nsa-button',        // NSA button classes
      'nsa-icon',          // NSA icon classes
      'nsa-content',       // NSA content classes
      'nsa-panel',         // NSA panel classes
      'nsa-modal',         // NSA modal classes
      'nsa-tooltip',       // NSA tooltip classes
      'nsa-highlight',     // NSA highlight classes
      'nsa-error',         // NSA error classes
      'nsa-warning',       // NSA warning classes
      'nsa-success',       // NSA success classes
      'nsa-info'           // NSA info classes
    ];

    const selectorLower = selector.toLowerCase();
    
    // Check if selector contains any sidebar-specific patterns
    return sidebarSelectors.some(pattern => selectorLower.includes(pattern.toLowerCase()));
  }

  /**
   * Check if a selector is a valid accessibility issue selector
   * This ensures we only process actual website element selectors, not widget attributes
   */
  private isValidAccessibilitySelector(selector: string): boolean {
    if (!selector) return false;

    // Skip if it's a sidebar element selector
    if (this.isSidebarElementSelector(selector)) {
      return false;
    }

    // Skip if it's just an attribute selector without element context
    // Like [data-nsalabel] without any element prefix
    if (selector.match(/^\[[^\]]+\]$/)) {
      console.log('⚠️ Tooltip Manager: Skipping attribute-only selector:', selector);
      return false;
    }

    // Skip if it contains widget-specific attributes
    const widgetAttributes = [
      'data-nsalabel',
      'data-nsa-',
      'data-tooltip',
      'data-widget'
    ];

    const selectorLower = selector.toLowerCase();
    if (widgetAttributes.some(attr => selectorLower.includes(attr))) {
      console.log('⚠️ Tooltip Manager: Skipping widget attribute selector:', selector);
      return false;
    }

    // Valid selectors should target actual HTML elements
    return true;
  }


  /**
   * Send message to content script to find elements in the active tab
   */
  private async findElementsInActiveTab(selector: string): Promise<void> {
    try {
      // Get the current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab?.id) {
        this.failedSelectors.add(selector);
        return;
      }

      // Find issues for this selector
      const issues = this.issues.filter(issue => issue.selector === selector);
      
      if (issues.length === 0) {
        this.failedSelectors.add(selector);
        return;
      }

      // Check if content script is loaded
      let contentScriptReady = false;
      try {
        await chrome.tabs.sendMessage(activeTab.id, { action: 'ping' });
        contentScriptReady = true;
      } catch {
        // Try to inject content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js']
          });
          
          // Wait for initialization
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify it's ready
          try {
            await chrome.tabs.sendMessage(activeTab.id, { action: 'ping' });
            contentScriptReady = true;
          } catch {
            this.failedSelectors.add(selector);
            return;
          }
        } catch {
          this.failedSelectors.add(selector);
          return;
        }
      }

      if (!contentScriptReady) {
        this.failedSelectors.add(selector);
        return;
      }

      // Send message to find elements
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        action: 'findElementsAndAttachTooltips',
        selector: selector,
        issues: issues
      });

      if (!response?.success) {
        this.failedSelectors.add(selector);
      }

    } catch (error) {
      this.failedSelectors.add(selector);
    }
  }

  // Add a public method to allow external access to the enhanced element finder
  public nsaFindElementsBySelector(selector: string): Element[] {
    return this.findElementsBySelector(selector);
  }

  // Helper to identify selectors targeting hidden elements
  private isHiddenElementSelector(selector: string): boolean {
    if (!selector) return false;

    // List of hidden/metadata elements - these are the only ones we want in the hidden section
    const hiddenElements = ['meta', 'link', 'script', 'style', 'head', 'title', 'base', 'noscript'];

    try {
      // Use a more accurate way to determine if a selector targets a hidden element
      // First, check if it's a simple selector for one of our hidden elements
      for (const element of hiddenElements) {
        // Check only for exact matches of element selectors to avoid false positives
        if (selector === element ||
            selector.match(new RegExp(`^${element}(\\[[^\\]]*\\])*$`)) || // Element with attributes
            selector.match(new RegExp(`^${element}\\.[^\\s]*$`)) ||  // Element with class
            selector.match(new RegExp(`^${element}#[^\\s]*$`)) ||   // Element with ID
            selector.match(new RegExp(`^html\\s+${element}$`)) ||   // Direct child of html
            selector.match(new RegExp(`^body\\s+${element}$`)) ||   // Direct child of body
            selector.match(new RegExp(`^head\\s+${element}$`)) ||   // Direct child of head
            selector.match(new RegExp(`^${element}:not\\([^)]*\\)$`))) // Element with negation
        {
          return true;
        }
      }

      // For more complex selectors, check first element in the selector chain
      const firstElementMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
      if (firstElementMatch && hiddenElements.includes(firstElementMatch[1])) {
        return true;
      }

      // Handle child selectors where the last element is hidden
      const parts = selector.split(/\s+|>/);
      const lastPart = parts[parts.length - 1];
      for (const element of hiddenElements) {
        if (lastPart === element ||
            lastPart.startsWith(`${element}.`) ||
            lastPart.startsWith(`${element}#`) ||
            lastPart.startsWith(`${element}[`)) {
          return true;
        }
      }
    } catch (e) {
      console.error(`Error checking if selector targets hidden element: ${selector}`, e);
    }

    return false;
  }

  private getIssuesForElement(element: Element): AccessibilityIssue[] {
    return this.issues.filter(issue => {
      try {
        const issueElements = this.findElementsBySelector(issue.selector);
        return issueElements.includes(element);
      } catch (error) {
        return false;
      }
    });
  }

  private handleLanguageChange(): void {
    const labels: Record<string, Record<string, string>> = {
      en: {
        nsaAiSolutionModalTitle: 'AI Solution Suggestion',
        nsaAiSolutionModalIssue: 'Issue:',
        nsaAiSolutionModalDetails: 'Details:',
        nsaAiSolutionModalTarget: 'Target:',
        nsaAiSolutionModalTags: 'Tags:',
        nsaAiSolutionModalGeneratingSolution: 'Generating solution...',
        nsaAiSolutionModalClose: 'Close',
        nsaAiSolutionModalError: 'Error',
        nsaAiSolutionModalErrorMessage: 'Failed to generate AI solution. Please try again later.',
      },
      de: {
        nsaAiSolutionModalTitle: 'AI Lösungsvorschlag',
        nsaAiSolutionModalIssue: 'Problem:',
        nsaAiSolutionModalDetails: 'Details:',
        nsaAiSolutionModalTarget: 'Ziel:',
        nsaAiSolutionModalTags: 'Tags:',
        nsaAiSolutionModalGeneratingSolution: 'Lösung wird generiert...',
        nsaAiSolutionModalClose: 'Schließen',
        nsaAiSolutionModalError: 'Fehler',
        nsaAiSolutionModalErrorMessage: 'Fehler beim Generieren der AI-Lösung. Bitte versuchen Sie es später erneut.',
      }
    };

    const currentLanguage = this.languageDropdown?.value || 'en';
    const currentLabels = labels[currentLanguage] || labels.en;
    const elements = this.queryShadowSelectorAll('[data-nsalabel]');
    const tooltipElements = this.nsaFindElementsBySelector('[data-nsalabel]');

    // Update labels in the main widget
    elements.forEach(element => {
      const labelKey = element.getAttribute('data-nsalabel');
      const newText = currentLabels[labelKey as keyof typeof currentLabels];

      if (labelKey && newText && element.textContent?.trim() !== newText) {
        element.innerHTML = newText;
      }
    });

    // Update labels in tooltips
    tooltipElements.forEach(element => {
      const labelKey = element.getAttribute('data-nsalabel');
      const newText = currentLabels[labelKey as keyof typeof currentLabels];

      if (labelKey && newText && element.textContent?.trim() !== newText) {
        element.innerHTML = newText;
      }
    });
  }
}

export default NsaTooltipManager;
