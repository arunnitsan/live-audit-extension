import { nsaAuditResultStorage } from './nsaStorageHelper';
import NsaBaseAccesstive from './nsaBasePlugin';

export class NsaWidgetToggle extends NsaBaseAccesstive {
  private nsaToggleButton: HTMLElement | null = null;
  private nsaAuditThemeBtn: HTMLButtonElement | null = null;
  private nsaScanButton: HTMLButtonElement | null = null;
  private nsaPanel: HTMLElement | null = null;
  private nsaAuditWidget: HTMLElement | null = null;
  private nsaIsOpen: boolean = false;
  private nsaIsDark: boolean = true;
  private nsaW3cLink: HTMLAnchorElement | null = null;

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Wait for Shadow DOM to be ready
      await this.waitForShadowDOM();

      // Initialize elements
      this.initializeElements();

      // Initialize widget
      this.nsaInit();
    } catch (error) {
      console.error('Failed to initialize widget toggle:', error);
    }
  }

  private initializeElements(): void {
    if (!this.shadowRoot) {
      throw new Error('Shadow DOM not initialized');
    }

    // Initialize all elements
    this.nsaToggleButton = this.queryShadowSelector('#nsaAuditToggle') as HTMLElement;
    this.nsaPanel = this.queryShadowSelector('#nsaAuditPanel') as HTMLElement;
    this.nsaAuditWidget = this.queryShadowSelector('#nsaAuditWidget') as HTMLElement;
    this.nsaAuditThemeBtn = this.queryShadowSelector('#nsaAuditThemeBtn') as HTMLButtonElement;
    this.nsaScanButton = this.queryShadowSelector('#nsaScanBtn') as HTMLButtonElement;
    this.nsaW3cLink = this.queryShadowSelector('#nsaW3cLink') as HTMLAnchorElement;

    // Apply initial theme
    if (this.nsaPanel) {
      this.nsaPanel.classList.toggle('nsa-audit-panel--dark', this.nsaIsDark);
    }
    if (this.shadowRoot) {
      this.shadowRoot.host.classList.toggle('nsa-audit-body--dark', this.nsaIsDark);
      document.body.classList.toggle('nsa-audit-body--dark', this.nsaIsDark);
    }
  }

  protected nsaInit(): void {
    this.nsaSetupToggleHandlers();
    this.nsaSetupKeyboardShortcuts();

    // Open widget by default after page load
    setTimeout(() => {
      this.nsaTogglePanel();
      // Enable the button
      if (this.nsaToggleButton) {
        this.nsaToggleButton.removeAttribute('disabled');
      }
    }, 100);
  }

  private nsaSetupToggleHandlers(): void {
    if (this.shadowRoot) {
      this.nsaToggleButton?.addEventListener('click', () => this.nsaTogglePanel());
      this.nsaAuditThemeBtn?.addEventListener('click', () => this.nsaToggleTheme());
    }
  }


  private nsaTogglePanel(): void {
    this.nsaIsOpen = !this.nsaIsOpen;
    
    // Update ARIA attributes
    this.nsaToggleButton?.setAttribute('aria-expanded', String(this.nsaIsOpen));
    const urlParams = new URLSearchParams(window.location.search);
    let website = urlParams.get('website');
    if (!website) {
      website = window.location.href;
    } else {
      try {
        website = decodeURIComponent(website);
      } catch (error) {
        throw new Error('Invalid website URL encoding');
      }
    }
    if (this.nsaW3cLink) {
      this.nsaW3cLink.href = `http://validator.w3.org/check?uri=${website}`;
    }

    // Toggle panel visibility
    if (this.nsaPanel) {
      this.nsaPanel.classList.toggle('nsa-audit-panel--visible', this.nsaIsOpen);
    }
    
    // Dispatch event to notify tooltip manager about sidebar toggle
    if (this.shadowRoot) {
      const event = new CustomEvent('nsaSidebarToggled', {
        detail: { isOpen: this.nsaIsOpen },
        bubbles: true,
        composed: true
      });
      this.shadowRoot.dispatchEvent(event);
    }

    // Check if we have stored audit results
    const settings = nsaAuditResultStorage.loadSettings();
    if ((!settings || Object.keys(settings).length === 0) && this.nsaScanButton && this.nsaIsOpen) {
      // No stored data, trigger a scan
      this.nsaScanButton.click();
    }

    // Disable the button when clicked
    if (this.nsaToggleButton && !settings && this.nsaScanButton) {
      this.nsaToggleButton.setAttribute('disabled', 'true');
    }
  }

  private nsaToggleTheme(): void {
    this.nsaIsDark = !this.nsaIsDark;

    // Toggle panel visibility
    if (this.nsaAuditWidget) {
      this.nsaAuditWidget.classList.toggle('nsa-audit-widget--dark', this.nsaIsDark);
    }
    if (this.shadowRoot) {
      this.shadowRoot.host.classList.toggle('nsa-audit-body--dark', this.nsaIsDark);
      document.body.classList.toggle('nsa-audit-body--dark', this.nsaIsDark);
    }
  }

  private nsaSetupKeyboardShortcuts(): void {
    // Attach keyboard shortcuts to document instead of shadowRoot
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      // Removed Escape to close - widget stays open
      
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        this.nsaTogglePanel();
      }
    });
  }

  public nsaOpenPanel(): void {
    if (!this.nsaIsOpen) this.nsaTogglePanel();
  }

  public nsaEnableToggleButton(): void {
    if (this.nsaToggleButton) {
      this.nsaToggleButton.removeAttribute('disabled');
    }
  }
}

export default NsaWidgetToggle;
