import { formatHtmlTags, createCodeEditor } from './nsaTemplates';
import NsaBaseAccesstive from './nsaBasePlugin';

// Data structure for the issue sent to the AI API
export interface IssueData {
  selector?: string;
  context?: string;
  title?: string;
  message?: string;
  code?: string;
  index?: number;
  tags?: string;
  url?: string;
  currentDomain?: string;
  currentLanguage?: string;
}

// Data structure for the AI API request
interface AiRequestData {
  selector: string;
  context: string;
  title: string;
  message: string;
  code: string;
  tags: string;
  url: string;
  currentDomain: string;
  currentLanguage: string;
}

// Data structure for the AI API response
interface AiSolution {
  description: string;
  html: string;
  explanation: string;
  title: string | null | undefined;
}

interface AiResponse {
  error: any;
  status: string;
  data: {
    solution: AiSolution;
    remaining_tokens: number;
    cached: boolean;
  };
}

class NsaAiSolutionManager extends NsaBaseAccesstive {
  private modal: HTMLElement | null = null;
  private apiUrl: string;
  private apiKey: string;
  private websiteUrl: string;
  private currentDomain: string;

  constructor(
    apiUrl: string = import.meta.env.VITE_AI_AUDIT_API_URL || 'https://dashboard.accesstive.com/api/v2/ai-solution',
    apiKey: string = import.meta.env.VITE_AI_AUDIT_API_KEY || 'QWlTb2x1dGlvbk1pZGRsZXdhcmU',
    currentDomain: string = window.location.hostname || '',
    websiteUrl: string = NsaAiSolutionManager.getWebsiteUrlFromQuery() || window.location.href
  ) {
    super();
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.websiteUrl = websiteUrl;
    this.currentDomain = currentDomain;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Wait for Shadow DOM to be ready
      await this.waitForShadowDOM();

      // Listen for language changes to update translations
      this.setupLanguageChangeListener();
    } catch (error) {
      console.error('Failed to initialize AI solution manager:', error);
    }
  }

  /**
   * Setup listener for language changes
   */
  private setupLanguageChangeListener(): void {
    const languageDropdown = this.queryShadowSelector('#nsaLanguageDropdown') as HTMLSelectElement;
    if (languageDropdown) {
      languageDropdown.addEventListener('change', () => {
        if (this.modal) {
          this.triggerTranslations();
        }
      });
    }
  }

  // Try to get ?website=... from the URL
  private static getWebsiteUrlFromQuery(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('website');
  }

  /**
   * Create the modal dialog in the Shadow DOM if it doesn't exist
   */
  private createModal(issueData: IssueData): void {
    if (!this.shadowRoot) {
      console.error('Shadow DOM not initialized');
      return;
    }

    this.modal = this.shadowRoot.querySelector('#nsaAiSolutionModal');
    if (this.modal) return;

    this.modal = document.createElement('div');
    this.modal.id = 'nsaAiSolutionModal';
    this.modal.className = 'nsa-modal';
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999999999;
      display: none;
    `;
    this.modal.innerHTML = `
      <div class="nsa-modal-content">
        <div class="nsa-modal-header">
          <p class="nsa-modal-title" data-nsalabel="nsaAiSolutionModalTitle">AI Solution</p>
          <button class="nsa-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="nsa-modal-body">
          <div class="nsa-ai-response nsa-hidden">
            <div class="nsa-ai-solution-content"></div>
          </div>
          <div class="nsa-ai-request">
            <div class="nsa-issue-summary">
              <p><strong data-nsalabel="nsaAiSolutionModalIssue">Issue:</strong> <span class="nsa-modal-ai-issue-title">${formatHtmlTags(issueData.title ?? '')}</span></p>
              <p><strong data-nsalabel="nsaAiSolutionModalDetails">Details:</strong> <span class="nsa-modal-ai-issue-message">${formatHtmlTags(issueData.message ?? '')}</span></p>
              <p><strong data-nsalabel="nsaAiSolutionModalTarget">Target:</strong> <code class="nsa-modal-ai-issue-code">${issueData.selector}</code></p>
              <p><strong data-nsalabel="nsaAiSolutionModalTags">Tags:</strong> <span class="nsa-modal-ai-issue-tags">${issueData.tags ?? ''}</span></p>
            </div>
            <div class="nsa-loading-spinner">
              <div class="nsa-spinner"></div>
              <p data-nsalabel="nsaAiSolutionModalGeneratingSolution">Generating solution...</p>
            </div>
          </div>
          <div class="nsa-ai-error nsa-hidden">
            <p class="nsa-modal-issue-title" data-nsalabel="nsaAiSolutionModalError">Error</p>
            <p class="nsa-ai-error-message" data-nsalabel="nsaAiSolutionModalErrorMessage">Failed to generate AI solution. Please try again later.</p>
          </div>
        </div>
        <div class="nsa-modal-footer">
          <button class="nsa-modal-close-btn" data-nsalabel="nsaAiSolutionModalClose">Close</button>
        </div>
      </div>
    `;
    this.shadowRoot.appendChild(this.modal);

    // Trigger translations for the initial modal content
    this.triggerTranslations();

    const closeModal = () => this.setModalVisibility(false);
    this.modal.querySelector('.nsa-modal-close')?.addEventListener('click', closeModal);
    this.modal.querySelector('.nsa-modal-close-btn')?.addEventListener('click', closeModal);
    this.modal.addEventListener('click', e => { if (e.target === this.modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  /**
   * Show the AI solution modal for a given issue
   */
  public showAiSolutionModal(issueData: IssueData): void {
    try {
      // Hide any active tippy tooltips
      const activeTooltips = document.querySelectorAll('[data-tippy-root]');
      activeTooltips.forEach(tooltip => {
        const tippyInstance = (tooltip as any)._tippy;
        if (tippyInstance) {
          tippyInstance.hide();
        }
      });

      this.createModal(issueData);
      if (!this.modal) return console.error('Failed to create modal');

      // Check theme from shadowRoot host
      const isDark = this.shadowRoot?.host.classList.contains('nsa-audit-body--dark');
      this.modal.classList.toggle('nsa-modal--dark', isDark);

      const title = formatHtmlTags(issueData.title ?? '');
      const message = formatHtmlTags(issueData.message ?? '');

      this.setModalContent(title, message);
      this.setModalVisibility(true);
      this.setLoadingState(true);

      // Trigger translations when modal is shown
      this.triggerTranslations();

      this.fetchAiSolution(issueData);
    } catch (error) {
      console.error('Error in showAiSolutionModal:', error);
      this.showError('An unexpected error occurred while processing the request.');
    }
  }

  /**
   * Set the modal's title and message
   */
  private setModalContent(title: string, message: string): void {
    const titleEl = this.modal?.querySelector('.nsa-modal-ai-issue-title');
    const messageEl = this.modal?.querySelector('.nsa-modal-ai-issue-message');
    if (titleEl) titleEl.innerHTML = title;
    if (messageEl) messageEl.innerHTML = message;
  }

  /**
   * Show or hide the modal
   */
  private setModalVisibility(visible: boolean): void {
    if (!this.modal) return;

    if (visible) {
      this.modal.style.display = 'block';
      (this.modal?.querySelector('.nsa-modal-close') as HTMLElement)?.focus();
    } else {
      this.modal.style.display = 'none';
      this.modal.remove();
      this.modal = null;
      document.removeEventListener('keydown', e => { if (e.key === 'Escape') this.modal?.remove(); });
    }
  }

  /**
   * Set loading, response, and error states in the modal
   */
  private setLoadingState(loading: boolean): void {
    this.toggleClass('.nsa-ai-request', !loading);
    this.toggleClass('.nsa-loading-spinner', !loading);
    this.toggleClass('.nsa-ai-response', loading);
    this.toggleClass('.nsa-ai-error', true);
  }

  /**
   * Toggle a class for show/hide
   */
  private toggleClass(selector: string, hide: boolean): void {
    this.modal?.querySelector(selector)?.classList.toggle('nsa-hidden', hide);
  }

  /**
   * Fetch the AI solution from the API
   */
  private async fetchAiSolution(issueData: IssueData): Promise<void> {
    if (!this.modal) return;
    try {
      const requestData: AiRequestData = {
        selector: issueData.selector || '',
        context: issueData.context || '',
        title: issueData.title || '',
        message: issueData.title || '',
        code: issueData.code || '',
        tags: issueData.tags || '',
        url: this.websiteUrl,
        currentDomain: this.currentDomain,
        currentLanguage: issueData.currentLanguage || 'en'
      };
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const responseData: AiResponse = await response.json();
        this.handleFailResponse({
          title: responseData.status.toUpperCase() || 'Error', description: responseData.error.message || 'Failed to connect to the AI service. Please try again later.',
          html: '',
          explanation: ''
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData: AiResponse = await response.json();
      if (responseData.status === 'success' && responseData.data.solution) {
        this.handleSuccessResponse(responseData.data.solution);
      } else if (responseData.status === 'fail' && responseData.data.solution) {
        this.handleFailResponse(responseData.data.solution);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching AI solution:', error);
      let errorMessage = 'Failed to connect to the AI service. Please try again later.';
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorMessage = 'Network error: Unable to connect to the AI service. Please check your internet connection.';
      } else if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      this.showError(errorMessage);
      this.setLoadingState(false);
    }
  }

  /**
   * Handle a successful AI response and display it in the modal
   */
  private handleSuccessResponse(solution: AiSolution): void {
    if (!this.modal) return;
    this.toggleClass('.nsa-loading-spinner', true);
    this.toggleClass('.nsa-ai-response', false);
    const container = this.modal.querySelector('.nsa-ai-solution-content');
    if (!container) return;
    const formattedSolution = `
      ${solution.description ? `
      <div class="nsa-ai-solution-item">
        <p class="nsa-ai-solution-item-title" role="heading" aria-level="3">Description</p>
        <p>${formatHtmlTags(solution.description)}</p>
      </div>
      ` : ''}
      ${solution.html ? `
      <div class="nsa-ai-solution-item">
        <p class="nsa-ai-solution-item-title" role="heading" aria-level="3">Solution</p>
        <div class="nsa-ai-solution-item-code">
          ${createCodeEditor(solution.html)}
          <button type="button" class="nsa-ai-solution-item-code-copy" id="nsaAiSolutionItemCodeCopy">Copy</button>
        </div>
      </div>
      ` : ''}
      ${solution.explanation ? `
      <div class="nsa-ai-solution-item">
        <p class="nsa-ai-solution-item-title" role="heading" aria-level="3">Explanation</p>
        <p>${formatHtmlTags(solution.explanation)}</p>
      </div>
      ` : ''}
    `;

    container.innerHTML = formattedSolution;
    const copyButton = container.querySelector('#nsaAiSolutionItemCodeCopy') as HTMLButtonElement;
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            // Use the Clipboard API if available and in a secure context
            await navigator.clipboard.writeText(solution.html);
          } else {
            // Fallback for older browsers or non-secure contexts
            const textArea = document.createElement('textarea');
            textArea.value = container.querySelector('.nsa-code-line')?.textContent || solution.html;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
              document.execCommand('copy');
            } catch (err) {
              console.error('Failed to copy text: ', err);
              copyButton.textContent = 'Failed to copy';
              return;
            }

            document.body.removeChild(textArea);
          }
          copyButton.textContent = 'Copied';
          setTimeout(() => {
            copyButton.textContent = 'Copy';
          }, 1000);
        } catch (err) {
          console.error('Failed to copy text: ', err);
          copyButton.textContent = 'Failed to copy';
          setTimeout(() => {
            copyButton.textContent = 'Copy';
          }, 2000);
        }
      });
    }
  }

  /**
   * Handle a failed AI response and display it in the modal
   */
  private handleFailResponse(solution: AiSolution): void {
    if (!this.modal) return;
    this.toggleClass('.nsa-loading-spinner', true);
    this.toggleClass('.nsa-ai-response', false);
    const container = this.modal.querySelector('.nsa-ai-solution-content');
    if (!container) return;
    container.classList.add('nsa-ai-solution-fail');
    const formattedSolution = `
      <div class="nsa-ai-solution-item">
        <h3 class="nsa-ai-solution-item-title" role="heading" aria-level="3">${formatHtmlTags(solution.title)}</h3>
        <p>${formatHtmlTags(solution.description)}</p>
        <div class="nsa-ai-solution-cta-buttons">
          <a href="https://accesstive.com/free-trial/" target="_blank" rel="noopener noreferrer" class="nsa-btn nsa-btn--primary" data-nsalabel="nsaAiSolutionModalStartTrial">Start Free Trial</a>
          <a href="https://calendly.com/accesstive/new-meeting" target="_blank" rel="noopener noreferrer" class="nsa-btn nsa-btn--primary-light" data-nsalabel="nsaAiSolutionModalScheduleDemo">Schedule Live Demo</a>
        </div>
      </div>
    `;
    container.innerHTML = formattedSolution;
    this.setLoadingState(false);

    // Trigger translations for the newly inserted content
    this.triggerTranslations();
  }

  /**
   * Show an error message in the modal
   */
  private showError(message: string): void {
    this.toggleClass('.nsa-loading-spinner', true);
    this.toggleClass('.nsa-ai-error', false);
    const errorMessage = this.modal?.querySelector('.nsa-ai-error-message');
    if (errorMessage) errorMessage.textContent = message;
  }

  /**
   * Trigger translations for elements with data-nsalabel attributes
   */
  private triggerTranslations(): void {
    if (!this.modal) return;

    // Get the current language from the main audit instance
    const languageDropdown = this.queryShadowSelector('#nsaLanguageDropdown') as HTMLSelectElement;
    const currentLanguage = languageDropdown?.value || 'en';

    console.log('AI Solution: Triggering translations for language:', currentLanguage);
    console.log('AI Solution: Language dropdown found:', !!languageDropdown);

    // Define the translation labels - include all modal labels
    const labels: Record<string, Record<string, string>> = {
      en: {
        nsaAiSolutionModalTitle: 'AI Solution',
        nsaAiSolutionModalIssue: 'Issue:',
        nsaAiSolutionModalDetails: 'Details:',
        nsaAiSolutionModalTarget: 'Target:',
        nsaAiSolutionModalTags: 'Tags:',
        nsaAiSolutionModalGeneratingSolution: 'Generating solution...',
        nsaAiSolutionModalError: 'Error',
        nsaAiSolutionModalErrorMessage: 'Failed to generate AI solution. Please try again later.',
        nsaAiSolutionModalClose: 'Close',
        nsaAiSolutionModalStartTrial: 'Start Free Trial',
        nsaAiSolutionModalScheduleDemo: 'Schedule Live Demo',
      },
      de: {
        nsaAiSolutionModalTitle: 'KI-Lösung',
        nsaAiSolutionModalIssue: 'Problem:',
        nsaAiSolutionModalDetails: 'Details:',
        nsaAiSolutionModalTarget: 'Ziel:',
        nsaAiSolutionModalTags: 'Tags:',
        nsaAiSolutionModalGeneratingSolution: 'Lösung wird generiert...',
        nsaAiSolutionModalError: 'Fehler',
        nsaAiSolutionModalErrorMessage: 'Fehler beim Generieren der KI-Lösung. Bitte versuchen Sie es später erneut.',
        nsaAiSolutionModalClose: 'Schließen',
        nsaAiSolutionModalStartTrial: 'Kostenlose Testversion starten',
        nsaAiSolutionModalScheduleDemo: 'Live-Demo planen',
      }
    };

    const currentLabels = labels[currentLanguage] || labels.en;
    const elements = this.modal.querySelectorAll('[data-nsalabel]');

    console.log('AI Solution: Found elements with data-nsalabel:', elements.length);
    console.log('AI Solution: Available labels for current language:', Object.keys(currentLabels));

    elements.forEach(element => {
      const labelKey = element.getAttribute('data-nsalabel');
      const newText = currentLabels[labelKey as keyof typeof currentLabels];

      console.log('AI Solution: Processing element with label:', labelKey, 'newText:', newText);

      if (labelKey && newText) {
        // For buttons and links, update text content, for other elements update innerHTML
        if (element.tagName === 'BUTTON' || element.tagName === 'A') {
          element.textContent = newText;
        } else {
          element.innerHTML = newText;
        }
        element.setAttribute('title', newText);
        console.log('AI Solution: Updated element text to:', newText);
      }
    });
  }
}

export default NsaAiSolutionManager;
