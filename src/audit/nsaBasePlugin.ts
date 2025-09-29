import styles from '../assets/scss/style-audit.scss?inline';


type ExcludeConfig = {
  tags: string[];
  classes: string[];
  ids: string[];
  parentTags: string[];
  parentClasses: string[];
  parentIDs: string[];
};

class NsaBaseAccesstive {
  public excludeRules: ExcludeConfig;
  private keyMappings: { [key: string]: Function };
  protected shadowRoot: ShadowRoot | null = null;
  protected widgetContainer: HTMLElement | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.excludeRules = globalExcludeConfig;
    this.keyMappings = {};
    this.initializationPromise = this.initializeShadowDOM();
  }

  // Initialize Shadow DOM
  protected async initializeShadowDOM(): Promise<void> {
    return new Promise((resolve, reject) => {
      const initShadowDOM = () => {
        this.widgetContainer = document.getElementById('nsaAuditWidgetContainer');
        if (!this.widgetContainer) {
          setTimeout(initShadowDOM, 100);
          return;
        }

        if (!this.widgetContainer.shadowRoot) {
          try {
            this.shadowRoot = this.widgetContainer.attachShadow({ mode: 'open' });

            // Add default styles
            const style = document.createElement('style');
            style.textContent = styles;
            this.shadowRoot.appendChild(style);

            // Move the widget content into Shadow DOM
            const widgetContent = this.widgetContainer.innerHTML;
            this.widgetContainer.innerHTML = '';
            // Create a template element to hold the widget content
            const template = document.createElement('template');
            template.innerHTML = widgetContent;
            this.shadowRoot.appendChild(template.content.cloneNode(true));
            resolve();
          } catch (error) {
            console.error('Failed to initialize Shadow DOM:', error);
            reject(error);
          }
        } else {
          this.shadowRoot = this.widgetContainer.shadowRoot;
          resolve();
        }
      };

      initShadowDOM();
    });
  }

  // Method to wait for Shadow DOM initialization
  protected async waitForShadowDOM(): Promise<void> {
    if (!this.initializationPromise) {
      throw new Error('Shadow DOM initialization not started');
    }
    return this.initializationPromise;
  }

  // Method to append elements to Shadow DOM
  protected appendToShadowDOM(element: HTMLElement): void {
    if (this.shadowRoot) {
      this.shadowRoot.appendChild(element);
    }
  }

  // Method to query elements within Shadow DOM
  protected queryShadowSelector(selector: string): Element | null {
    return this.shadowRoot?.querySelector(selector) || null;
  }

  // Method to query all elements within Shadow DOM
  protected queryShadowSelectorAll(selector: string): NodeListOf<Element> {
    return this.shadowRoot?.querySelectorAll(selector) || document.querySelectorAll(':empty');
  }

  // Method to add selectors to the exclusion rules
  addExclude(type: keyof ExcludeConfig, selectors: string, isParent: boolean = false): void {
    const key = isParent ? `parent${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof ExcludeConfig : type;
    const values = selectors.split(',').map(s => s.trim());

    values.forEach((value) => {
      if (!this.excludeRules[key].includes(value)) {
        this.excludeRules[key].push(value);
      }
    });
  }

  // Method to configure keyboard shortcuts
  configureKeyboardShortcuts(shortcuts: { [key: string]: Function }): void {
    Object.keys(shortcuts).forEach((keyCode) => {
      this.keyMappings[keyCode] = shortcuts[keyCode];
    });
  }

  // Method to bind keyboard shortcuts to events
  bindKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      const { ctrlKey, altKey, code } = event;
      if (ctrlKey && altKey && this.keyMappings[code]) {
        this.keyMappings[code]();
        event.preventDefault();
      }
    });
  }

  // Method to check if an element is excluded from accessibility
  isExcluded(element: HTMLElement): boolean {
    if (
      this.isExcludedTag(element) ||
      this.hasExcludedClass(element) ||
      this.hasExcludedID(element)
    ) {
      return true;
    }
    return this.isExcludedInParents(element);
  }

  // Check if the element's tag is excluded
  isExcludedTag(element: HTMLElement): boolean {
    return this.excludeRules.tags.includes(element.tagName.toLowerCase());
  }

  // Check if the element's class is excluded
  hasExcludedClass(element: HTMLElement): boolean {
    return this.excludeRules.classes.some(className => element.classList.contains(className));
  }

  // Check if the element's ID is excluded
  hasExcludedID(element: HTMLElement): boolean {
    return this.excludeRules.ids.includes(element.id);
  }

  // Check if any parent element is excluded
  isExcludedInParents(element: HTMLElement): boolean {
    let parentElement: HTMLElement | null = element.parentElement;

    while (parentElement !== null) {
      if (
        this.excludeRules.parentTags.includes(parentElement.tagName.toLowerCase()) ||
        (parentElement.classList && this.excludeRules.parentClasses.some((cls) => parentElement!.classList.contains(cls))) ||
        this.excludeRules.parentIDs.includes(parentElement.id)
      ) {
        return true;
      }
      parentElement = parentElement.parentElement;
    }

    return false;
  }
}

// Global exclude configuration, typed
const globalExcludeConfig: ExcludeConfig = {
  tags: ['head', 'script', 'html', 'meta', 'link', 'style', 'div', 'section', 'br', 'svg', 'pre'],
  classes: ['accessibility-controls', 'nsa-accesstive-btn-trigger-wrap', 'nsa-tooltip'],
  ids: ['nsaAuditWidget', 'nsaAccesstive', 'nsaBlueFilterEffect', 'nsaTooltip', 'nsaAccesstiveBtnTrigger', 'nsaAsPanelWrap', 'nsaColorDisability', 'nsa_AccesstiveFilter'],

  parentTags: ['head', 'style', 'svg'],
  parentClasses: ['nsaAccesstive', 'accessibility-controls', 'nsa-accesstive-btn-trigger-wrap', 'nsa-tooltip'],
  parentIDs: ['nsaAuditWidget', 'no-accessibility', 'nsa_AccesstiveFilter', 'nsaAsPanelWrap', 'tabsContainer', 'contentContainer'],
};

export default NsaBaseAccesstive;
