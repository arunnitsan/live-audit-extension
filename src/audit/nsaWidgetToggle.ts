import { nsaAuditResultStorage } from './nsaStorageHelper';
import NsaBaseAccesstive from './nsaBasePlugin';

export class NsaWidgetToggle extends NsaBaseAccesstive {
  private nsaToggleButton: HTMLElement | null = null;
  private nsaCloseButton: HTMLButtonElement | null = null;
  private nsaAuditThemeBtn: HTMLButtonElement | null = null;
  private nsaScanButton: HTMLButtonElement | null = null;
  private nsaPanel: HTMLElement | null = null;
  private nsaAuditWidget: HTMLElement | null = null;
  private nsaIsOpen: boolean = false;
  private nsaIsDark: boolean = true;
  private nsaW3cLink: HTMLAnchorElement | null = null;
  private isResizing: boolean = false;
  private startX: number = 0;
  private startWidth: number = 0;

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
    this.nsaCloseButton = this.queryShadowSelector('#nsaCloseBtn') as HTMLButtonElement;
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
    this.nsaSetupResizeHandler();

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
      this.nsaCloseButton?.addEventListener('click', () => this.nsaTogglePanel());
      this.nsaAuditThemeBtn?.addEventListener('click', () => this.nsaToggleTheme());
    }
  }

  private nsaSetupResizeHandler(): void {
    if (!this.nsaPanel || !this.shadowRoot) return;
    this.startWidth = this.nsaPanel.offsetWidth;
    document.documentElement.style.setProperty('margin-right', `${this.startWidth}px`);

    const handleMouseDown = (e: MouseEvent) => {
      if (!this.nsaPanel) return;

      // Only start resize if clicking on the left edge (first 4px)
      if (e.offsetX > 6) return;

      this.isResizing = true;
      this.startX = e.clientX;
      this.startWidth = this.nsaPanel.offsetWidth;

      // Add a class to prevent text selection during resize
      this.shadowRoot?.host.classList.add('nsa-resizing');

      // Attach event listeners to document instead of shadowRoot
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // Prevent text selection during resize
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isResizing || !this.nsaPanel) return;

      // Calculate new width based on mouse movement
      const deltaX = e.clientX - this.startX;
      const newWidth = Math.min(Math.max(this.startWidth - deltaX, 400), 2000);

      // Apply the new width
      document.documentElement.style.setProperty('margin-right', `${newWidth}px`);
      this.nsaPanel.style.width = `${newWidth}px`;

      // Force a reflow to ensure smooth animation
      this.nsaPanel.offsetHeight;
    };

    const handleMouseUp = () => {
      this.isResizing = false;
      this.shadowRoot?.host.classList.remove('nsa-resizing');
      // Remove event listeners from document
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    this.nsaPanel.addEventListener('mousedown', handleMouseDown);
  }

  private nsaTogglePanel(): void {
    this.nsaIsOpen = !this.nsaIsOpen;
    if (this.nsaIsOpen) {
      document.documentElement.style.setProperty('margin-right', `${this.startWidth}px`);
    } else {
      document.documentElement.style.removeProperty('margin-right');
    }
    // Update ARIA attributes
    this.nsaToggleButton?.setAttribute('aria-expanded', String(this.nsaIsOpen));
    this.nsaCloseButton?.setAttribute('aria-expanded', String(this.nsaIsOpen));
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
      if (event.key === 'Escape' && this.nsaIsOpen) {
        this.nsaTogglePanel();
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        this.nsaTogglePanel();
      }
    });
  }

  public nsaOpenPanel(): void {
    if (!this.nsaIsOpen) this.nsaTogglePanel();
  }

  public nsaClosePanel(): void {
    if (this.nsaIsOpen) this.nsaTogglePanel();
  }

  public nsaEnableToggleButton(): void {
    if (this.nsaToggleButton) {
      this.nsaToggleButton.removeAttribute('disabled');
    }
  }
}

export default NsaWidgetToggle;
