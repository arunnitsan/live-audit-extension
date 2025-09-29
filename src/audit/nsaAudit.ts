import { nsaAuditResultStorage, nsaAuditSettingsStorage } from './nsaStorageHelper';
import NsaBaseAccesstive from './nsaBasePlugin';
import NsaTooltipManager from './nsaAuditTooltip';
import NsaAiSolutionManager from './nsaAiSolution';
import errorIcon from '../assets/icons/error.svg?raw';
import warningIcon from '../assets/icons/warning.svg?raw';
import checkIcon from '../assets/icons/check.svg?raw';
import helpIcon from '../assets/icons/help.svg?raw';
import highlightIcon from '../assets/icons/highlight.svg?raw';
import aiSolutionIcon from '../assets/icons/ai-solution.svg?raw';
import prevIcon from '../assets/icons/prev.svg?raw';
import nextIcon from '../assets/icons/next.svg?raw';
import chevronDownIcon from '../assets/icons/chevron-down.svg?raw';
import chevronUpIcon from '../assets/icons/chevron-up.svg?raw';
import {
  formatHtmlTags,
  renderIssueItem,
  renderIssueContext,
  renderIssueTags,
  renderIssueCode,
  renderNavigationControls,
  renderHighlightButton,
  renderAiSolutionButton,
  impactLabels,
  createCodeEditor,
  jsonDecode
} from './nsaTemplates';
import NsaPdfGenerator from './nsaPdfGenerator';

interface WCAGReference {
  criterion: string;
  description: string;
  level: string;
  url: string;
}

export interface AccessibilityIssue {
  title: string;
  message: string;
  description: string;
  code: string;
  selector: string;
  context: string;
  category: string;
  type: 'error' | 'warning' | 'notice';
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | 'passed';
  level: 'error' | 'warning' | 'notice';
  tags?: string[];
  helpUrl?: string;
  guidelines?: string;
  whyMatters?: string;
  fix?: string;
  disabilitiesAffected?: string[];
  algorithmSimple?: string;
  wcagReferences?: string[];
  nodeCount?: number;
}

export interface GroupedData {
  errors?: AccessibilityIssue[];
  warnings?: AccessibilityIssue[];
  notices?: AccessibilityIssue[];
}

export interface AuditData {
  standard: string;
  grouped: Record<string, GroupedData>;
  statistics?: {
    totalIssues: number;
    criticalIssues: number;
    seriousIssues: number;
    moderateIssues: number;
    minorIssues: number;
    scorePercentage: number;
  };
  url?: string;
}

export interface AuditSettings {
  selectedStandard?: string;
  showBestPractice?: boolean;
  impactFilters?: Record<'critical' | 'serious' | 'moderate' | 'minor' | 'passed', boolean>;
  language?: string;
  selectedDisability?: string;
}

export interface IssueCountsByImpact {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  passed: number;
  total: number;
  [key: string]: number;
}

export interface IssueCountsByType {
  errors: number;
  warnings: number;
  notices: number;
  total: number;
}

export interface IssueCountsResult {
  byImpact: IssueCountsByImpact;
  byType: IssueCountsByType;
  bestPractice: {
    total: number;
    byImpact: IssueCountsByImpact;
    byType: IssueCountsByType;
  };
}

const TEMPLATE_CACHE = new Map<string, string>();

type ImpactType = 'critical' | 'serious' | 'moderate' | 'minor' | 'passed';

export class IssueCounter {
  private static createEmptyImpactCounts(): IssueCountsByImpact {
    return {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      passed: 0,
      total: 0
    };
  }

  private static createEmptyTypeCounts(): IssueCountsByType {
    return {
      errors: 0,
      warnings: 0,
      notices: 0,
      total: 0
    };
  }

  public static countIssues(
    data: AuditData[],
    settings: AuditSettings,
    selectedStandard: string = 'tags',
    issueAffectsDisability?: (issue: AccessibilityIssue, selectedDisability: string) => boolean
  ): IssueCountsResult {
    const counts: IssueCountsResult = {
      byImpact: this.createEmptyImpactCounts(),
      byType: this.createEmptyTypeCounts(),
      bestPractice: {
        total: 0,
        byImpact: this.createEmptyImpactCounts(),
        byType: this.createEmptyTypeCounts()
      }
    };

    const impactFiltersEnabled = Object.values(settings.impactFilters || {}).some(Boolean);

    data.forEach(data => {
      Object.entries(data.grouped).forEach(([, categoryData]) => {
        ['errors', 'warnings', 'notices'].forEach((type) => {
          const issues = categoryData[type as keyof GroupedData] || [];

          issues.forEach(issue => {
            if (selectedStandard !== 'tags' && !issue.tags?.includes(selectedStandard)) {
              return;
            }

            if (impactFiltersEnabled && !settings.impactFilters?.[issue.impact]) {
              return;
            }

            // Filter by disability if selected and function provided
            if (settings.selectedDisability && issueAffectsDisability && !issueAffectsDisability(issue, settings.selectedDisability)) {
              return;
            }

            const isBestPractice = issue.tags?.includes('best-practice');

            if (isBestPractice) {
              if (settings.showBestPractice) {
                counts.bestPractice.total++;
                counts.bestPractice.byImpact[issue.impact]++;
                if (type === 'errors') {
                  counts.bestPractice.byType.errors++;
                } else if (type === 'warnings') {
                  counts.bestPractice.byType.warnings++;
                } else {
                  counts.bestPractice.byType.notices++;
                }
              }
            } else {
              if (type === 'errors') {
                counts.byType.errors++;
              } else if (type === 'warnings') {
                counts.byType.warnings++;
              } else {
                counts.byType.notices++;
              }

              counts.byImpact[issue.impact]++;
              counts.byImpact.total++;
            }
          });
        });
      });
    });

    counts.byType.total = counts.byType.errors + counts.byType.warnings + counts.byType.notices;
    counts.bestPractice.byType.total = counts.bestPractice.byType.errors + counts.bestPractice.byType.warnings + counts.bestPractice.byType.notices;

    return counts;
  }
}

export class NsaAuditAccesstive extends NsaBaseAccesstive {
  private readonly apiUrl: string;
  private dropdown: HTMLSelectElement | null = null;
  private resultContainer: HTMLElement | null = null;
  private scanButton: HTMLElement | null = null;
  private bestPracticeFilter: HTMLInputElement | null = null;
  private languageDropdown: HTMLSelectElement | null = null;
  private disabilityDropdown: HTMLSelectElement | null = null;
  private disabilityIcon: HTMLElement | null = null;
  private loader: HTMLElement | null = null;
  private fetchedData: AuditData[] | null = null;
  private readonly tooltipManager: NsaTooltipManager;
  private readonly aiSolutionManager: NsaAiSolutionManager;
  private readonly impactPriority = [
    'critical',
    'serious',
    'moderate',
    'minor',
    'passed',
  ] as const;
  private isExpanded: boolean = false;

  private impactFilters: Record<ImpactType, HTMLInputElement | null> = {
    critical: null,
    serious: null,
    moderate: null,
    minor: null,
    passed: null,
  };

  private activeNodes: Map<string, number> = new Map();
  private filteredDataCache: Map<string, Record<string, GroupedData>> = new Map();
  private htmlCache: Map<string, string> = new Map();

  private mutationObserver: MutationObserver | null = null;

  private readonly wcagLevelMap: Record<string, string[]> = (() => {
    const generateRange = (prefix: string, start: number, end: number): string[] =>
      Array.from({ length: end - start + 1 }, (_, i) => `${prefix}${start + i}`);

    // Base WCAG 2.0 levels
    const wcag2a = ['wcag111', 'wcag121', 'wcag122', 'wcag131', 'wcag141', 'wcag211', 'wcag221', 'wcag241', 'wcag341'];
    const wcag2aa = ['wcag143', 'wcag246', 'wcag251', 'wcag253', ...generateRange('wcag41', 1, 33)];
    const wcag2aaa = ['wcag246', 'wcag253', ...generateRange('wcag32', 2, 9), ...generateRange('wcag33', 0, 9), ...generateRange('wcag34', 0, 6)];

    // WCAG 2.1 additions
    const wcag21aExtra = [
      'wcag2111', 'wcag2112', 'wcag2113', 'wcag2114', 'wcag2115', 'wcag2116', 'wcag2117', 'wcag2118', 'wcag2119', 'wcag2120',
      'wcag2121', 'wcag2122', 'wcag2123', 'wcag2124', 'wcag2125', 'wcag2126', 'wcag2127', 'wcag2128', 'wcag2129', 'wcag2130',
      'wcag2131', 'wcag2132', 'wcag2133', 'wcag2134', 'wcag2135', 'wcag2136'
    ];
    const wcag21aaExtra = ['wcag2137', 'wcag2138', 'wcag2139', 'wcag2140'];
    const wcag21aaaExtra = ['wcag326', 'wcag327', 'wcag328', 'wcag329', 'wcag3210', 'wcag3211', 'wcag3212', 'wcag3213'];

    // WCAG 2.2 additions
    const wcag22aExtra = ['wcag2411', 'wcag2414', ...generateRange('wcag24', 15, 100).filter(n => parseInt(n.slice(-2)) % 2 === 0), ...generateRange('wcag24', 15, 99).filter(n => parseInt(n.slice(-2)) % 2 === 1)];
    const wcag22aaExtra = ['wcag2412', 'wcag2413', 'wcag257'];
    const wcag22aaaExtra = ['wcag2415', 'wcag2416', 'wcag2417', 'wcag2418', 'wcag2419', 'wcag2420', 'wcag2421', 'wcag2422', 'wcag2423', 'wcag2424', 'wcag2425', 'wcag2426', 'wcag2427', 'wcag2428', 'wcag2429', 'wcag2430'];

    // Build complete WCAG 2.0 levels
    const wcag2aaComplete = [...wcag2a, ...wcag2aa];
    const wcag2aaaComplete = [...wcag2aaComplete, ...wcag2aaa];

    // Build complete WCAG 2.1 levels
    const wcag21aComplete = [...wcag2a, ...wcag21aExtra];  // WCAG 2.0 A + WCAG 2.1 A
    const wcag21aaComplete = [...wcag2aaComplete, ...wcag21aExtra, ...wcag21aaExtra];  // WCAG 2.0 AA + WCAG 2.1 A/AA
    const wcag21aaaComplete = [...wcag2aaaComplete, ...wcag21aExtra, ...wcag21aaExtra, ...wcag21aaaExtra];  // WCAG 2.0 AAA + WCAG 2.1 A/AA/AAA

    // Build complete WCAG 2.2 levels
    const wcag22aComplete = [...wcag21aComplete, ...wcag22aExtra];  // WCAG 2.1 A + WCAG 2.2 A
    const wcag22aaComplete = [...wcag21aaComplete, ...wcag22aExtra, ...wcag22aaExtra];  // WCAG 2.1 AA + WCAG 2.2 A/AA
    const wcag22aaaComplete = [...wcag21aaaComplete, ...wcag22aExtra, ...wcag22aaExtra, ...wcag22aaaExtra];  // WCAG 2.1 AAA + WCAG 2.2 A/AA/AAA

    return {
      'wcag2a': wcag2a,
      'wcag2aa': wcag2aaComplete,
      'wcag2aaa': wcag2aaaComplete,
      'wcag21a': wcag21aComplete,
      'wcag21aa': wcag21aaComplete,
      'wcag21aaa': wcag21aaaComplete,
      'wcag22a': wcag22aComplete,
      'wcag22aa': wcag22aaComplete,
      'wcag22aaa': wcag22aaaComplete
    };
  })();


  constructor(apiUrl: string) {
    super();
    this.apiUrl = apiUrl;
    this.tooltipManager = new NsaTooltipManager();
    this.aiSolutionManager = new NsaAiSolutionManager();

    this.initialize();
    this.setupLinkClickHandler();
  }

  private initialize(): void {
    this.cacheElements();
    this.loadSettings();
    this.setupEventListeners();
    this.setupMutationObserver();

    // Set language dropdown based on document's lang attribute
    if (this.languageDropdown) {
      const docLang = this.getDocumentLanguage();
      // Only set if the language exists in the dropdown options
      if (Array.from(this.languageDropdown.options).some(option => option.value === docLang)) {
        this.languageDropdown.value = docLang;
        // Store the language in settings
        const settings = this.getCurrentSettings();
        settings.language = docLang;
        nsaAuditSettingsStorage.saveSettings(settings);
      }
    }

    const settings = this.getCurrentSettings();
    this.filterAndDisplayResults(settings.selectedStandard || 'tags');

    // Initialize disability icon
    if (this.disabilityDropdown) {
      this.updateDisabilityIcon(this.disabilityDropdown.value);
    }
  }

  private setupMutationObserver(): void {
    if (this.resultContainer) {
      this.mutationObserver = new MutationObserver(() => {
        this.tooltipManager.nsaDestroyTooltips();
        this.tooltipManager.nsaAttachTooltips();
      });
      this.mutationObserver.observe(this.resultContainer, {
        childList: true,
        subtree: true,
      });
    }
  }

  private cacheElements(): void {
    this.dropdown = this.queryShadowSelector('#nsaStandardDropdown') as HTMLSelectElement;
    this.resultContainer = this.queryShadowSelector('#nsaResults') as HTMLElement;
    this.scanButton = this.queryShadowSelector('#nsaScanBtn') as HTMLElement;
    this.bestPracticeFilter = this.queryShadowSelector('#nsaBestPracticeFilter') as HTMLInputElement;
    this.loader = this.queryShadowSelector('#nsaLoader') as HTMLElement;
    this.languageDropdown = this.queryShadowSelector('#nsaLanguageDropdown') as HTMLSelectElement;
    this.disabilityDropdown = this.queryShadowSelector('#nsaDisabilityDropdown') as HTMLSelectElement;
    this.disabilityIcon = this.queryShadowSelector('#nsaDisabilityIcon') as HTMLElement;
    this.impactPriority.forEach((impact) => {
      this.impactFilters[impact] = this.queryShadowSelector(
        `#nsaImpact${impact.charAt(0).toUpperCase() + impact.slice(1)}Filter`
      ) as HTMLInputElement;
    });
  }

  private setupEventListeners(): void {
    if (this.shadowRoot) {
      this.shadowRoot.addEventListener('change', (e) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        
        const target = e.target;

        if (target.classList.contains('nsa-impact-filter__checkbox')) {
          this.showLoader();
          this.handleFilterChange();

          try {
            const parentSwitch = target.closest('.nsa-switch');
            if (parentSwitch) {
              parentSwitch.classList.toggle('nsa--active',(target as HTMLInputElement).checked);
            }
          } catch (error) {
            console.warn('Error in filter change handler:', error);
          }
          return;
        }

        const isFilterInput = target === this.dropdown || target === this.bestPracticeFilter || target === this.disabilityDropdown;
        if (isFilterInput) {
          this.showLoader();
          this.handleFilterChange();

          // Update disability icon classes when dropdown changes
          if (target === this.disabilityDropdown) {
            this.updateDisabilityIcon((target as HTMLSelectElement).value);
          }

          if (target !== this.dropdown) {
            try {
              const parentSwitch = target.closest('.nsa-switch');
              if (parentSwitch) {
                parentSwitch.classList.toggle(
                  'nsa--active',
                  (target as HTMLInputElement).checked
                );
              }
            } catch (error) {
              console.warn('Error in filter switch handler:', error);
            }
          }
        }

        if (target === this.languageDropdown) {
          this.showLoader();
          this.fetchAccessibilityReport();
        }
      });

      this.shadowRoot.addEventListener('nsaBestPracticeFilterChanged', (e: Event) => {
        const customEvent = e as CustomEvent;
        this.showLoader();

        if (this.bestPracticeFilter) {
          this.bestPracticeFilter.checked = !!customEvent.detail?.showBestPractice;

          const parentSwitch = this.bestPracticeFilter.closest('.nsa-switch');
          if (parentSwitch) {
            parentSwitch.classList.toggle('nsa--active', this.bestPracticeFilter.checked);
          }
        }

        this.handleFilterChange();
      });

      this.shadowRoot.addEventListener('click', (e) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        
        const target = e.target;

        try {
          const button = target.closest(
            '.nsa-issue-header, .nsa-node-navigation__button, .nsa-node-prev, .nsa-node-next, .nsa-highlight-button, .nsa-ai-solution-button, .nsa-category-toggle, .nsa-expand-toggle-btn');

          if (!button) return;

          e.preventDefault();

        if (button.classList.contains('nsa-issue-header')) {
          this.handleToggleClick(button);
        } else if (button.classList.contains('nsa-category-toggle')) {
          this.handleToggleClick(button);
        } else if (button.classList.contains('nsa-highlight-button')) {
          this.handleHighlightClick(button);
        } else if (button.classList.contains('nsa-ai-solution-button')) {
          this.handleAiSolutionClick(button);
          this.handleLanguageChange();
        } else if (button.classList.contains('nsa-node-prev')) {
          this.handleNodeNavigation(button, 'prev');
        } else if (button.classList.contains('nsa-node-next')) {
          this.handleNodeNavigation(button, 'next');
        } else if (button.classList.contains('nsa-expand-toggle-btn')) {
          this.handleExpandToggleClick();
        }
        } catch (error) {
          console.warn('Error in click handler:', error);
        }
      });

      if (this.scanButton) {
        this.scanButton.addEventListener('click', () => {
          this.showLoader();
          this.fetchAccessibilityReport();
        });
      }

      // Add PDF button event listener
      const pdfButton = this.queryShadowSelector('#nsaPdfBtn');
      if (pdfButton) {
        pdfButton.addEventListener('click', () => {
          this.generatePdfReport();
          this.handleLanguageChange();
        });
      }

      const shareButton = this.queryShadowSelector('#nsaShareBtn');
      if (shareButton) {
        shareButton.addEventListener('click', async () => {
          const url = window.location.href;
          try {
            if (navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(url);
            } else {
              const textArea = document.createElement('textarea');
              textArea.value = url;
              textArea.style.position = 'fixed';
              textArea.style.left = '-999999px';
              textArea.style.top = '-999999px';
              this.shadowRoot?.appendChild(textArea);
              textArea.focus();
              textArea.select();

              try {
                document.execCommand('copy');
              } catch (err) {
                console.error('Failed to copy text: ', err);
                shareButton.textContent = 'Failed to copy';
                return;
              }

              this.shadowRoot?.removeChild(textArea);
            }
            shareButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g fill="currentColor"><path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm4.1 4.7-4.9 4.9-.4.4c-.1.1-.3.1-.4 0l-.4-.3-2.1-2.1c-.1-.1-.1-.3 0-.4l.3-.4c.1-.1.3-.1.4 0l2 2L11.3 5c.1-.1.3-.1.4 0l.4.3c.1.1.1.3 0 .4z"/></g></svg>';
            setTimeout(() => {
              shareButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="currentColor"><path d="M6.585 2H3.51a.502.502 0 0 0-.51.494v12.012c0 .268.228.494.51.494h6.987-1.994c-.652 0-1.208-.42-1.416-1H4V3h1v.495c0 .291.22.505.491.505h5.018A.503.503 0 0 0 11 3.495V3h1v3h1V2.494A.505.505 0 0 0 12.49 2H9.415a1.5 1.5 0 0 0-2.83 0ZM8 3.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 4.253v5.994c0 .27.225.503.503.503h5.994c.27 0 .503-.225.503-.503V7.503A.508.508 0 0 0 14.497 7H8.503A.508.508 0 0 0 8 7.503ZM9 8h5v5H9V8Zm1 1h3v1h-3V9Zm0 2h3v1h-3v-1Z"></path></svg>';
            }, 1000);
          } catch (err) {
            console.error('Failed to copy text: ', err);
            shareButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24"><g fill="currentColor"><path d="M6.585 2H3.51a.502.502 0 0 0-.51.494v12.012c0 .268.228.494.51.494h3.577A1.489 1.489 0 0 1 7 14.497V14H4V3h1v.495c0 .291.22.505.491.505h5.018A.503.503 0 0 0 11 3.495V3h1v3h1V2.494A.505.505 0 0 0 12.49 2H9.415a1.5 1.5 0 0 0-2.83 0ZM8 3.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm7.2 5.95L13.4 11l1.8 1.8c.2.2.2.5 0 .7l-.7.7c-.2.2-.5.2-.7 0L12 12.4l-1.8 1.8c-.2.2-.5.2-.7 0l-.7-.7c-.2-.2-.2-.5 0-.7l1.8-1.8-1.8-1.8c-.2-.2-.2-.5 0-.7l.7-.7c.2-.2.5-.2.7 0L12 9.6l1.8-1.8c.2-.2.5-.2.7 0l.7.7c.2.2.2.5 0 .7Z"/></g></svg>';
            setTimeout(() => {
              shareButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="currentColor"><path d="M6.585 2H3.51a.502.502 0 0 0-.51.494v12.012c0 .268.228.494.51.494h6.987-1.994c-.652 0-1.208-.42-1.416-1H4V3h1v.495c0 .291.22.505.491.505h5.018A.503.503 0 0 0 11 3.495V3h1v3h1V2.494A.505.505 0 0 0 12.49 2H9.415a1.5 1.5 0 0 0-2.83 0ZM8 3.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 4.253v5.994c0 .27.225.503.503.503h5.994c.27 0 .503-.225.503-.503V7.503A.508.508 0 0 0 14.497 7H8.503A.508.508 0 0 0 8 7.503ZM9 8h5v5H9V8Zm1 1h3v1h-3V9Zm0 2h3v1h-3v-1Z"></path></svg>';
            }, 2000);
          }
        });
      }
    }
  }

  private handleLanguageChange(): void {
    const labels: Record<string, Record<string, string>> = {
      en: {
        nsaScanBtn: 'Re-Scan',
        nsaAuditCountLabel: 'Issues found',
        nsaPoweredLink: 'Powered by Accesstive',
        nsaW3cLink: 'W3C HTML Check',
        nsaScanning: 'Scanning page...',
        nsaStandardAll: 'All Standards',
        nsaAuditDescription: 'Panel for reviewing and fixing Accesstive issues on this page',
        nsaAuditTitle: 'Accesstive - Live Audit',
        nsaAuditErrorLabel: 'Audit Error',
        nsaAuditWarningLabel: 'Needs Review',
        nsaAuditPassedLabel: 'Passed Check',
        nsaHiddenElementsLabel: 'Issues in Non-Visible Elements',
        nsaHiddenElementsTitle: 'Hidden Elements',
        nsaCategoryNamerolevalue: 'Name role value',
        nsaCategoryColor: 'Color',
        nsaCategorySemantics: 'Semantics',
        nsaCategorySensoryandvisualcues: 'Sensory and visual cues',
        nsaCategoryKeyboard: 'Keyboard',
        nsaCategoryTextalternatives: 'Text alternatives',
        nsaCategoryAria: 'Aria',
        nsaCategoryStructure: 'Structure',
        nsaCategoryParsing: 'Parsing',
        nsaCategoryForms: 'Forms',
        nsaCategoryLanguage: 'Language',
        nsaCategoryTimeandmedia: 'Time and media',
        nsaCategoryTables: 'Tables',
        nsaWcagReferencesLabel: 'WCAG References',
        nsaWcagReferenceLabel: 'Reference',
        nsaTagsLabel: 'Tags',
        nsaImagesHaveInsufficientAlternativeText: 'Images have insufficient alternative text',
        nsaPdfModalTitle: 'Download PDF Report',
        nsaPdfModalNameLabel: 'Name <span class="nsa-required">*</span>',
        nsaPdfModalEmailLabel: 'E-Mail <span class="nsa-required">*</span>',
        nsaPdfModalDownloadBtn: 'Download PDF',
        nsaOtpModalTitle: 'Verify Email',
        nsaOtpModalMessage: 'Please enter the OTP sent to your email address.',
        nsaOtpModalOtpLabel: 'OTP <span class="nsa-required">*</span>',
        nsaNoIssuesMessage: 'Data not found',
        nsaNoIssuesMessage2: 'Please select the proper impact checkboxes or scan the page again.',
        nsaNoIssuesDisabilityMessage: 'No issues found for the selected disability',
        nsaNoIssuesDisabilityMessage2: 'Try selecting a different disability or "All Disabilities" to see all issues.',
        nsaOtpModalVerifyBtn: 'Verify OTP',
        nsaExpandAllBtn: 'Expand All',
        nsaCollapseAllBtn: 'Collapse All',
        nsaImpactCriticalLabel: 'Critical',
        nsaImpactSeriousLabel: 'Serious',
        nsaImpactModerateLabel: 'Moderate',
        nsaImpactMinorLabel: 'Minor',
        nsaImpactPassedLabel: 'Passed',
        nsaImpactBestPracticeLabel: 'Best Practice',
        nsaDisabilityAll: 'All Disabilities',
        nsaDisabilityAttentionDeficit: 'Attention Deficit',
        nsaDisabilityBlind: 'Blind',
        nsaDisabilityDeafblind: 'Deafblind',
        nsaDisabilityMobility: 'Mobility',
        nsaDisabilityLowVision: 'Low Vision',
        nsaDisabilityColorblindness: 'Colorblindness',
        nsaDisabilityKeyboard: 'Sighted Keyboard Users',
        nsaDisabilityDeaf: 'Deaf',
        nsaDisabilityCognitive: 'Cognitive',
      },
      de: {
        nsaScanBtn: 'Neu scannen',
        nsaAuditCountLabel: 'Fehler gefunden',
        nsaPoweredLink: 'Mit Accesstive betrieben',
        nsaW3cLink: 'W3C HTML Check',
        nsaScanning: 'Seite wird gescannt...',
        nsaStandardAll: 'Alle Standards',
        nsaAuditDescription: 'Panel für das Überprüfen und Beheben von Accesstive-Problemen auf dieser Seite',
        nsaAuditTitle: 'Accesstive - Live Audit',
        nsaAuditErrorLabel: 'Prüfungsfehler',
        nsaAuditWarningLabel: 'Muss überprüft werden',
        nsaAuditPassedLabel: 'Bestanden',
        nsaHiddenElementsLabel: 'Probleme in nicht sichtbaren Elementen',
        nsaHiddenElementsTitle: 'Versteckte Elemente',
        nsaCategoryNamerolevalue: 'Name Role Wert',
        nsaCategoryColor: 'Farbe',
        nsaCategorySemantics: 'Semantik',
        nsaCategorySensoryandvisualcues: 'Sensorische und visuelle Hinweise',
        nsaCategoryKeyboard: 'Tastatur',
        nsaCategoryTextalternatives: 'Textalternative',
        nsaCategoryAria: 'Aria',
        nsaCategoryStructure: 'Struktur',
        nsaCategoryParsing: 'Parsing',
        nsaCategoryForms: 'Formulare',
        nsaCategoryLanguage: 'Sprache',
        nsaCategoryTimeandmedia: 'Zeit und Medien',
        nsaCategoryTables: 'Tabellen',
        nsaWcagReferencesLabel: 'WCAG Referenzen',
        nsaWcagReferenceLabel: 'Referenz',
        nsaTagsLabel: 'Tags',
        nsaImagesHaveInsufficientAlternativeText: 'Bilder haben nicht ausreichende alternative Texte',
        nsaPdfModalTitle: 'PDF-Bericht herunterladen',
        nsaPdfModalNameLabel: 'Name <span class="nsa-required">*</span>',
        nsaPdfModalEmailLabel: 'E-Mail <span class="nsa-required">*</span>',
        nsaPdfModalDownloadBtn: 'PDF herunterladen',
        nsaOtpModalTitle: 'E-Mail bestätigen',
        nsaOtpModalMessage: 'Bitte geben Sie den OTP ein, der an Ihre E-Mail-Adresse gesendet wurde.',
        nsaOtpModalOtpLabel: 'OTP <span class="nsa-required">*</span>',
        nsaNoIssuesMessage: 'Daten nicht gefunden',
        nsaNoIssuesMessage2: 'Bitte wählen Sie die richtigen Einfluss-Checkboxen oder scannen Sie die Seite erneut.',
        nsaNoIssuesDisabilityMessage: 'Keine Probleme für die ausgewählte Behinderung gefunden',
        nsaNoIssuesDisabilityMessage2: 'Versuchen Sie, eine andere Behinderung oder "Alle Behinderungen" zu wählen, um alle Probleme zu sehen.',
        nsaOtpModalVerifyBtn: 'OTP bestätigen',
        nsaExpandAllBtn: 'Alle erweitern',
        nsaCollapseAllBtn: 'Alle reduzieren',
        nsaImpactCriticalLabel: 'Kritisch',
        nsaImpactSeriousLabel: 'Schwerwiegend',
        nsaImpactModerateLabel: 'Moderat',
        nsaImpactMinorLabel: 'Gering',
        nsaImpactPassedLabel: 'Bestanden',
        nsaImpactBestPracticeLabel: 'Best Practice',
        nsaDisabilityAll: 'Alle Behinderungen',
        nsaDisabilityAttentionDeficit: 'Aufmerksamkeitsdefizit',
        nsaDisabilityBlind: 'Blind',
        nsaDisabilityDeafblind: 'Taubblind',
        nsaDisabilityMobility: 'Mobilität',
        nsaDisabilityLowVision: 'Sehbehinderung',
        nsaDisabilityColorblindness: 'Farbenblindheit',
        nsaDisabilityKeyboard: 'Sehende Tastaturbenutzer',
        nsaDisabilityDeaf: 'Taub',
        nsaDisabilityCognitive: 'Kognitiv',
      }
    };

    const currentLanguage = this.languageDropdown?.value || 'en';
    const currentLabels = labels[currentLanguage] || labels.en;
    const elements = this.queryShadowSelectorAll('[data-nsalabel]');
    const tooltipElements = this.tooltipManager.nsaFindElementsBySelector('[data-nsalabel]');

    elements.forEach(element => {
      const labelKey = element.getAttribute('data-nsalabel');
      const newText = currentLabels[labelKey as keyof typeof currentLabels];

      if (labelKey && newText && element.textContent?.trim() !== newText) {
        element.innerHTML = newText;
        element.setAttribute('title', newText);
      }
    });

    tooltipElements.forEach(element => {
      const labelKey = element.getAttribute('data-nsalabel');
      const newText = currentLabels[labelKey as keyof typeof currentLabels];

      if (labelKey && newText && element.textContent?.trim() !== newText) {
        element.innerHTML = newText;
        element.setAttribute('title', newText);
      }
    });

    // Update expand toggle button text based on current state
    this.updateExpandToggleButton();
  }

  private getValidationMessage(key: string, fallback: string = ''): string {
    const currentLanguage = this.languageDropdown?.value || 'en';
    const labels: Record<string, Record<string, string>> = {
      en: {
        nsaValidationNameRequired: 'Name is required',
        nsaValidationNameInvalid: 'Please enter a valid name (minimum 2 characters, letters only)',
        nsaValidationEmailRequired: 'Email is required',
        nsaValidationEmailInvalid: 'Please enter a valid email address',
        nsaValidationOtpRequired: 'Please enter a valid 4-digit OTP',
        nsaValidationOtpInvalid: 'Invalid OTP. Please try again.',
        nsaValidationOtpSendFailed: 'Failed to send OTP. Please try again.',
      },
      de: {
        nsaValidationNameRequired: 'Name ist erforderlich',
        nsaValidationNameInvalid: 'Bitte geben Sie einen gültigen Namen ein (mindestens 2 Zeichen, nur Buchstaben)',
        nsaValidationEmailRequired: 'E-Mail ist erforderlich',
        nsaValidationEmailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
        nsaValidationOtpRequired: 'Bitte geben Sie einen gültigen 4-stelligen OTP ein',
        nsaValidationOtpInvalid: 'Ungültiger OTP. Bitte versuchen Sie es erneut.',
        nsaValidationOtpSendFailed: 'Fehler beim Senden des OTP. Bitte versuchen Sie es erneut.',
      }
    };

    const languageLabels = labels[currentLanguage] || labels.en;
    return languageLabels[key] || fallback;
  }

  private showError(message: string, errorDetails?: any): void {
    if (!this.resultContainer) return;

    let displayMessage = message;
    let errorType = 'general';

    // Always use the API's message if present
    if (errorDetails?.message) {
      displayMessage = errorDetails.message;
    } else if (errorDetails?.error) {
      errorType = errorDetails.error;
      // Fallback/translation logic only if message is not present
      switch (errorDetails.error) {
        case 'CSP_BLOCKED':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Content Security Policy (CSP) hat den Accessibility-Test blockiert. Die Website hat Sicherheitsbeschränkungen, die unsere Testtools am Laufen hindern.'
            : 'Content Security Policy (CSP) blocked the accessibility test. The website has security restrictions that prevent our testing tools from running.';
          break;
        case 'NETWORK_ERROR':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Netzwerkfehler beim Laden der Website. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'
            : 'Network error while loading the website. Please check your internet connection and try again.';
          break;
        case 'TIMEOUT':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Die Website hat zu lange zum Laden gebraucht. Bitte versuchen Sie es erneut.'
            : 'The website took too long to load. Please try again.';
          break;
        case 'INVALID_URL':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Die angegebene URL ist ungültig. Bitte überprüfen Sie die URL und versuchen Sie es erneut.'
            : 'The provided URL is invalid. Please check the URL and try again.';
          break;
        case 'UNAUTHORIZED':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Zugriff verweigert. Bitte überprüfen Sie Ihre API-Schlüssel und Berechtigungen.'
            : 'Access denied. Please check your API keys and permissions.';
          break;
        case 'RATE_LIMITED':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.'
            : 'Too many requests. Please wait a moment and try again.';
          break;
        case 'SITE_UNREACHABLE':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Die Website ist nicht erreichbar. Bitte überprüfen Sie die URL und versuchen Sie es erneut.'
            : 'The website is unreachable. Please check the URL and try again.';
          break;
        case 'INVALID_DOMAIN':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Ungültige Domain. Bitte überprüfen Sie die URL und versuchen Sie es erneut.'
            : 'Invalid domain. Please check the URL and try again.';
          break;
        case 'BLOCKED_BY_ROBOTS':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Die Website blockiert automatische Tests durch robots.txt. Bitte kontaktieren Sie den Website-Administrator.'
            : 'The website blocks automated testing via robots.txt. Please contact the website administrator.';
          break;
        case 'SSL_ERROR':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'SSL-Zertifikatsfehler. Die Website hat ein ungültiges oder abgelaufenes SSL-Zertifikat.'
            : 'SSL certificate error. The website has an invalid or expired SSL certificate.';
          break;
        case 'MAINTENANCE_MODE':
          displayMessage = this.languageDropdown?.value === 'de'
            ? 'Die Website befindet sich im Wartungsmodus. Bitte versuchen Sie es später erneut.'
            : 'The website is in maintenance mode. Please try again later.';
          break;
        default:
          displayMessage = message;
      }
    }

    const cacheKey = `error-${errorType}-${displayMessage}`;
    if (this.htmlCache.has(cacheKey)) {
      this.resultContainer.innerHTML = this.htmlCache.get(cacheKey)!;
      return;
    }


    const html = `
      <div class="nsa-error-message">
        <div class="nsa-error-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
          </svg>
        </div>
        <div class="nsa-error-content">
          <h3 class="nsa-error-title">
            ${this.languageDropdown?.value === 'de' ? 'Scan nicht verfügbar' : 'Scan Unavailable'}
          </h3>
          <p class="nsa-error-description">${displayMessage}</p>
          ${errorDetails?.details ? `<p class="nsa-error-details">${errorDetails.details}</p>` : ''}
        </div>
      </div>
    `;

    this.htmlCache.set(cacheKey, html);
    this.resultContainer.innerHTML = html;

    // Add event listener for retry button if it exists
    const retryBtn = this.resultContainer.querySelector('[data-nsa-retry-btn]');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (this.scanButton) {
          this.scanButton.click();
        }
      });
    }
  }

  private showNoResults(isDisabilityFilter: boolean = false): void {
    if (!this.resultContainer) return;

    const cacheKey = `no-results-${isDisabilityFilter ? 'disability' : 'general'}`;
    if (this.htmlCache.has(cacheKey)) {
      this.resultContainer.innerHTML = this.htmlCache.get(cacheKey)!;
      return;
    }

    let html: string;
    if (isDisabilityFilter) {
      html = `
        <div class="nsa-no-issues">
          <p data-nsalabel="nsaNoIssuesDisabilityMessage">No issues found for the selected disability</p>
          <p data-nsalabel="nsaNoIssuesDisabilityMessage2">Try selecting a different disability or "All Disabilities" to see all issues.</p>
        </div>
      `;
    } else {
      html = `
        <div class="nsa-no-issues">
          <p data-nsalabel="nsaNoIssuesMessage">Data not found</p>
          <p data-nsalabel="nsaNoIssuesMessage2">Please select the proper impact checkboxes or scan the page again.</p>
        </div>
      `;
    }

    this.htmlCache.set(cacheKey, html);
    this.resultContainer.innerHTML = html;
  }

  private updateCountersDisplay(): void {
    const updateElement = (id: string, value: number) => {
      const element = this.queryShadowSelector(`#${id}`);
      if (!element) return;

      // Always show the main audit count and toggle count
      if (id === 'nsaAuditCount' || id === 'nsaAuditToggleCount') {
        element.classList.remove('nsa-hidden');
      } else {
        // For other counters, hide only if value is 0
        element.classList.toggle('nsa-hidden', value === 0);
      }
      element.textContent = value.toString();
    };

    if (!this.fetchedData) return;

    const settings = this.getCurrentSettings();
    const selectedStandard = settings.selectedStandard || 'tags';
    const counts = IssueCounter.countIssues(this.fetchedData, settings, selectedStandard, this.issueAffectsDisability.bind(this));

    // Calculate total count excluding passed issues
    const totalCount = (counts.byImpact.critical + counts.byImpact.serious + counts.byImpact.moderate + counts.byImpact.minor)
      + (settings.showBestPractice ? (counts.bestPractice.byImpact.critical + counts.bestPractice.byImpact.serious + counts.bestPractice.byImpact.moderate + counts.bestPractice.byImpact.minor) : 0);

    // Update main counters first
    updateElement('nsaAuditCount', totalCount);
    updateElement('nsaAuditToggleCount', totalCount);

    // Update impact-specific counters
    Object.entries(counts.byImpact).forEach(([impact, count]) => {
      if (impact !== 'total') {
        const bestPracticeCount = settings.showBestPractice ? counts.bestPractice.byImpact[impact] : 0;
        const totalCount = count + bestPracticeCount;
        updateElement(`nsaImpact${impact.charAt(0).toUpperCase() + impact.slice(1)}Count`, totalCount);
      }
    });

    // Update best practice counter
    updateElement('nsaBestPracticeCount', settings.showBestPractice ? counts.bestPractice.total : 0);
  }

  private handleToggleClick(toggle: Element): void {
    const content = toggle.nextElementSibling as HTMLElement;
    if (!content) return;

    const isHidden = content.classList.contains('nsa-hidden');
    content.classList.toggle('nsa-hidden', !isHidden);
    toggle.setAttribute('aria-expanded', String(isHidden));

    // Update dropdown arrow for category toggles
    const dropdownArrow = toggle.querySelector('.nsa-dropdown-arrow');
    if (dropdownArrow) {
      if (isHidden) {
        // Content will be shown, so show up arrow
        dropdownArrow.innerHTML = chevronUpIcon;
      } else {
        // Content will be hidden, so show down arrow
        dropdownArrow.innerHTML = chevronDownIcon;
      }
    }
  }

  private handleExpandToggleClick(): void {
    if (!this.resultContainer) return;

    this.isExpanded = !this.isExpanded;

    const categoryToggles = this.resultContainer.querySelectorAll('.nsa-category-toggle');
    const issueHeaders = this.resultContainer.querySelectorAll('.nsa-issue-header');

    if (this.isExpanded) {
      // Expand all
      categoryToggles.forEach((toggle) => {
        const content = toggle.nextElementSibling as HTMLElement;
        if (content && content.classList.contains('nsa-hidden')) {
          content.classList.remove('nsa-hidden');
          toggle.setAttribute('aria-expanded', 'true');

          // Update dropdown arrow to show up arrow
          const dropdownArrow = toggle.querySelector('.nsa-dropdown-arrow');
          if (dropdownArrow) {
            dropdownArrow.innerHTML = chevronUpIcon;
          }
        }
      });

      issueHeaders.forEach((header) => {
        const content = header.nextElementSibling as HTMLElement;
        if (content && content.classList.contains('nsa-hidden')) {
          content.classList.remove('nsa-hidden');
          header.setAttribute('aria-expanded', 'true');
        }
      });
    } else {
      // Collapse all
      categoryToggles.forEach((toggle) => {
        const content = toggle.nextElementSibling as HTMLElement;
        if (content && !content.classList.contains('nsa-hidden')) {
          content.classList.add('nsa-hidden');
          toggle.setAttribute('aria-expanded', 'false');

          // Update dropdown arrow to show down arrow
          const dropdownArrow = toggle.querySelector('.nsa-dropdown-arrow');
          if (dropdownArrow) {
            dropdownArrow.innerHTML = chevronDownIcon;
          }
        }
      });

      issueHeaders.forEach((header) => {
        const content = header.nextElementSibling as HTMLElement;
        if (content && !content.classList.contains('nsa-hidden')) {
          content.classList.add('nsa-hidden');
          header.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Update button text and icon
    this.updateExpandToggleButton();
  }

  private updateExpandToggleButton(): void {
    const toggleButton = this.queryShadowSelector('#nsaExpandToggleBtn');
    if (!toggleButton) return;

    const iconElement = toggleButton.querySelector('.nsa-expand-toggle-icon') as SVGElement;
    const textElement = toggleButton.querySelector('.nsa-expand-toggle-text') as HTMLElement;

    if (this.isExpanded) {
      // Show collapse icon and text
      if (iconElement) {
        iconElement.innerHTML = '<path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>';
      }
      if (textElement) {
        textElement.setAttribute('data-nsalabel', 'nsaCollapseAllBtn');
        textElement.textContent = this.languageDropdown?.value === 'de' ? 'Alle reduzieren' : 'Collapse All';
      }
      toggleButton.setAttribute('title', 'Collapse All Categories');
      toggleButton.setAttribute('aria-label', 'Collapse All Categories');
    } else {
      // Show expand icon and text
      if (iconElement) {
        iconElement.innerHTML = '<path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>';
      }
      if (textElement) {
        textElement.setAttribute('data-nsalabel', 'nsaExpandAllBtn');
        textElement.textContent = this.languageDropdown?.value === 'de' ? 'Alle erweitern' : 'Expand All';
      }
      toggleButton.setAttribute('title', 'Expand All Categories');
      toggleButton.setAttribute('aria-label', 'Expand All Categories');
    }
  }

  private resetExpandState(): void {
    if (!this.resultContainer) return;

    // Reset the expanded state
    this.isExpanded = false;

    // Collapse all category toggles
    const categoryToggles = this.resultContainer.querySelectorAll('.nsa-category-toggle');
    categoryToggles.forEach((toggle) => {
      const content = toggle.nextElementSibling as HTMLElement;
      if (content && !content.classList.contains('nsa-hidden')) {
        content.classList.add('nsa-hidden');
        toggle.setAttribute('aria-expanded', 'false');

        // Reset dropdown arrow to show down arrow
        const dropdownArrow = toggle.querySelector('.nsa-dropdown-arrow');
        if (dropdownArrow) {
          dropdownArrow.innerHTML = chevronDownIcon;
        }
      }
    });

    // Collapse all issue headers
    const issueHeaders = this.resultContainer.querySelectorAll('.nsa-issue-header');
    issueHeaders.forEach((header) => {
      const content = header.nextElementSibling as HTMLElement;
      if (content && !content.classList.contains('nsa-hidden')) {
        content.classList.add('nsa-hidden');
        header.setAttribute('aria-expanded', 'false');
      }
    });

    // Update the toggle button to show expand state
    this.updateExpandToggleButton();
  }

  private handleHighlightClick(button: Element): void {
    try {
      const rawSelector = button.getAttribute('data-selector');
      const issueIndex = parseInt(
        button.getAttribute('data-issue-index') || '0',
        10
      );
      const issueTitle = button.getAttribute('data-issue-title') || '';

      if (!rawSelector) {
        console.error('No selector found on highlight button');
        return;
      }

      // Use the new jsonDecode function to safely decode the selector
      const selector = jsonDecode(rawSelector);

      // Store button reference for debugging
      const buttonId = `highlight-btn-${selector.replace(/[^a-zA-Z0-9]/g, '')}-${issueIndex}`;
      button.setAttribute('data-nsa-button-id', buttonId);

      // Try to find the target element using the enhanced selector finder
      let targetElement: Element | null = null;
      try {
        // Use the tooltipManager's enhanced element finder with decoded selector
        const foundElements = this.tooltipManager.nsaFindElementsBySelector(selector);
        if (foundElements.length > 0) {
          targetElement = foundElements[0];
        }
      } catch (error) {
        console.error(`Error finding element with selector ${selector}:`, error);
      }

      if (!targetElement) {
        console.error(`Target element not found for selector: ${selector}`);
        console.error(`Cannot find element: ${issueTitle}`);
        return;
      }

      // Assign a unique ID to the element for tracking
      const elementId = `element-${selector.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
      targetElement.setAttribute('data-nsa-element-id', elementId);

      // IMPORTANT: Remove any existing tooltips from this element
      // to prevent duplicates when clicking highlight multiple times
      this.tooltipManager.removeTooltipFromElement(targetElement);

      // Store the issue index that we want to display
      targetElement.setAttribute('data-nsa-target-issue-index', issueIndex.toString());

      // Remove any existing highlights first
      this.removeHighlights();

      // If the element is inside a wrapper, scroll to the wrapper for better visibility
      const wrapperElement = targetElement.closest('.nsa-tooltip-wrapper') || targetElement;

      // Calculate if element is in viewport
      const rect = wrapperElement.getBoundingClientRect();
      const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );

      // Only scroll if element is not in viewport
      if (!isInViewport) {
        // Scroll to element with smooth behavior
        wrapperElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }

      // Add highlight class to both element and wrapper (if it exists)
      targetElement.classList.add('nsa-audit-highlight');
      if (wrapperElement !== targetElement) {
        wrapperElement.classList.add('nsa-audit-highlight');
      }

      // Store specific info to find in tooltip
      if (button.closest('.nsa-issue-item')) {
        const issueItemTitle = button.closest('.nsa-issue-item')?.querySelector('.nsa-issue-title')?.textContent;
        if (issueItemTitle) {
          targetElement.setAttribute('data-nsa-issue-title', issueItemTitle);
        }
      }

      // Wait a bit for the scroll to complete before showing tooltip
      setTimeout(() => {
        try {
          // Use forceExactIndex=true to ensure we show the exact issue from the global list
          this.tooltipManager.nsaFocusTooltipWithIssueIndex(selector, issueIndex, true);

          // Remove highlight after delay
          setTimeout(() => {
            if (targetElement) {
              targetElement.classList.remove('nsa-audit-highlight');

              // Also remove from wrapper if applicable
              if (wrapperElement !== targetElement) {
                wrapperElement.classList.remove('nsa-audit-highlight');
              }
            }
          }, 3000);
        } catch (error) {
          console.error('Error focusing tooltip:', error);
          // If tooltip focus fails, still remove highlight eventually
          setTimeout(() => {
            if (targetElement) {
              targetElement.classList.remove('nsa-audit-highlight');

              // Also remove from wrapper if applicable
              if (wrapperElement !== targetElement) {
                wrapperElement.classList.remove('nsa-audit-highlight');
              }
            }
          }, 3000);
        }
      }, isInViewport ? 0 : 300); // Only delay if we needed to scroll
    } catch (error) {
      console.error('Error in handleHighlightClick:', error);
    }
  }

  private handleAiSolutionClick(button: Element): void {
    try {
      const issueIndex = parseInt(button.getAttribute('data-issue-index') || '0',10);
      const issueItem = button.closest('.nsa-issue-item') || button.closest('.nsa-tooltip-issue');
      if (!issueItem) return;

      // Extract issue details
      const issueTitle = issueItem.querySelector('.nsa-issue-title')?.textContent || '';
      const issueDescription = issueItem.querySelector('.nsa-issue-message-container > .nsa-audit-content')?.textContent || '';
      const issueCode = issueItem.querySelector('.nsa-issue-code')?.textContent || '';
      const issueContext = issueItem.querySelector('.nsa-code-content')?.textContent || '';
      const selector = button.getAttribute('data-selector') || '';
      const tags = issueItem.querySelector('.nsa-issue-tags')?.innerHTML || '';

      // Create issue data object
      const issueData = {
        title: issueTitle,
        message: issueDescription,
        code: issueCode,
        context: issueContext,
        selector: selector,
        index: issueIndex,
        currentLanguage: this.languageDropdown?.value || document.documentElement.lang || 'en',
        tags: tags
      };
      // Use the AI solution manager to show the modal and handle the request
      this.aiSolutionManager.showAiSolutionModal(issueData);
    } catch (error) {
      console.error('Error in handleAiSolutionClick:', error);
    }
  }

  private handleFilterChange(): void {
    // Show loader immediately
    this.showLoader();

    // Reset expand state to collapse all dropdowns
    this.resetExpandState();

    // Get settings and save them
    const settings = this.getCurrentSettings();
    nsaAuditSettingsStorage.saveSettings(settings);

    // Clear caches
    this.activeNodes.clear();
    this.htmlCache.clear();
    this.filteredDataCache.clear();
    if (this.fetchedData && this.fetchedData.length > 0) {
      // Use setTimeout with 0 delay to ensure loader is shown before heavy processing
      setTimeout(() => {
        this.filterAndDisplayResults(settings.selectedStandard || 'tags');
        this.updateCountersDisplay();

        this.tooltipManager.nsaDestroyTooltips();
        this.tooltipManager.nsaFetchAuditData();
        this.tooltipManager.nsaAttachTooltips();
        this.hideLoader();
      }, 0);
    } else {
      this.showNoResults();
      this.hideLoader();
    }
  }

  private getCurrentSettings(): AuditSettings {
    const impactFiltersState: Record<ImpactType, boolean> = {
      critical: true,
      serious: true,
      moderate: true,
      minor: true,
      passed: true,
    };

    this.impactPriority.forEach((impact) => {
      impactFiltersState[impact] = this.impactFilters[impact]?.checked ?? true;
    });

    return {
      selectedStandard: this.dropdown?.value || 'wcag21aa',
      showBestPractice: this.bestPracticeFilter?.checked ?? true,
      impactFilters: impactFiltersState,
      language: this.languageDropdown?.value || 'en',
      selectedDisability: this.disabilityDropdown?.value || 'all',
    };
  }

  private showLoader(): void {
    if (this.loader) {
      // Force immediate display of loader
      this.loader.classList.remove('nsa-hidden');
      this.loader.setAttribute('aria-busy', 'true');
      // Force a reflow to ensure the loader is visible
      this.loader.offsetHeight;
    }
  }

  private hideLoader(): void {
    if (this.loader) {
      // Add a small delay before hiding to ensure smooth transition
      setTimeout(() => {
        this.loader?.classList.add('nsa-hidden');
        this.loader?.setAttribute('aria-busy', 'false');
      }, 100);
    }
  }

  private loadSettings(): void {
    const settings = nsaAuditSettingsStorage.loadSettings() || {
      selectedStandard: 'wcag21aa',
      showBestPractice: true,
      impactFilters: {
        critical: true,
        serious: true,
        moderate: true,
        minor: true,
        passed: true,
      },
      language: this.getDocumentLanguage(),
      selectedDisability: 'all',
    };

    nsaAuditSettingsStorage.saveSettings(settings);

    if (this.dropdown) {
      this.dropdown.value = settings.selectedStandard || 'wcag21aa';
    }

    if (this.bestPracticeFilter) {
      this.bestPracticeFilter.checked = settings.showBestPractice ?? true;
    }

    if (this.languageDropdown && settings.language) {
      // Only set if the language exists in the dropdown options
      if (Array.from(this.languageDropdown.options).some(option => option.value === settings.language)) {
        this.languageDropdown.value = settings.language;
      }
    }

    if (this.disabilityDropdown && settings.selectedDisability) {
      // Only set if the disability exists in the dropdown options
      if (Array.from(this.disabilityDropdown.options).some(option => option.value === settings.selectedDisability)) {
        this.disabilityDropdown.value = settings.selectedDisability;
        this.updateDisabilityIcon(settings.selectedDisability);
      }
    }

    const impactFilters = settings.impactFilters || {
      critical: true,
      serious: true,
      moderate: true,
      minor: true,
      passed: true,
    };

    this.impactPriority.forEach((impact) => {
      if (this.impactFilters[impact]) {
        this.impactFilters[impact]!.checked = Boolean(impactFilters[impact]);
        const parentSwitch = this.impactFilters[impact]!.closest('.nsa-switch');
        if (parentSwitch && this.impactFilters[impact]!.checked) {
          parentSwitch.classList.add('nsa--active');
        }
      }
    });

    const storedData = nsaAuditResultStorage.loadSettings();
    if (storedData && Object.keys(storedData).length > 0) {
      this.fetchedData = Array.isArray(storedData) ? storedData : [storedData];
      // Update counters immediately after loading data
      this.updateCountersDisplay();
      // Then filter and display results
      this.filterAndDisplayResults(this.dropdown?.value || 'wcag21aa');
    }
  }

  public async fetchAccessibilityReport(): Promise<void> {
    console.log('Starting accessibility report fetch...');
    this.showLoader();
    this.handleLanguageChange();

    // Reset expand state to collapse all dropdowns
    this.resetExpandState();

    const urlParams = new URLSearchParams(window.location.search);
    const script = document.querySelector('script[data-tab-url]');
    let website = urlParams.get('website') || (script as HTMLScriptElement)?.dataset.tabUrl;
    if (!website || website === 'undefined') {
      website = '';
    }

    if (!website) {
      website = window.location.href || '';
    } else {
      try {
        website = decodeURIComponent(website);
      } catch (error) {
        throw new Error('Invalid website URL encoding');
      }
    }

    console.log('Website URL:', website);
    console.log('API URL:', this.apiUrl);

    try {
      const apiKey = import.meta.env.VITE_AUDIT_API_KEY || 'access_J8UhYb4xP9n2K7mTq5sZ3vL6w';
      const authToken = import.meta.env.VITE_AUDIT_TOKEN || '70GtFdcZaq3wE8vR4xH2jY9bK1sX6pM5';

      console.log('API Key present:', !!apiKey);
      console.log('Auth Token present:', !!authToken);

      if (!apiKey) {
        throw new Error('API key is required. Please check your environment configuration.');
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const requestBody = {
        url: website,
        highlight: false,
        screenshots: false,
        language: this.languageDropdown?.value || 'en',
        enableGroupSummaries: true,
      };

      console.log('Request body:', requestBody);
      console.log('Headers:', headers);

      // ✅ Clear old data from storage
      nsaAuditResultStorage.resetSettings();
      nsaAuditSettingsStorage.resetSettings();
      this.fetchedData = [];

      console.log('Making fetch request to:', this.apiUrl);
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      let data;
      if (!response.ok) {
        // Always try to parse the error JSON and show it
        let errorJson = null;
        try {
          errorJson = await response.json();
        } catch (e) {
          // If not JSON, fallback to text
          errorJson = { message: await response.text() };
        }
        this.showError('', errorJson);
        return;
      }

      data = await response.json();
      const transformedData = this.transformAxeData(data.results || data);
      this.fetchedData = Array.isArray(transformedData)
        ? transformedData.map(item => ({ ...item, language: requestBody.language }))
        : [{ ...transformedData, language: requestBody.language }];

      nsaAuditResultStorage.saveSettings(this.fetchedData);

      const settings = this.getCurrentSettings();
      nsaAuditSettingsStorage.saveSettings(settings);

      this.htmlCache.clear();
      this.activeNodes.clear();

      this.updateCountersDisplay();
      this.filterAndDisplayResults(settings.selectedStandard || 'wcag21aa');

      this.tooltipManager.nsaDestroyTooltips();
      this.tooltipManager.nsaFetchAuditData();
      this.tooltipManager.nsaAttachTooltips();

      const toggleButton = document.getElementById('nsaAuditToggle');
      if (toggleButton) {
        toggleButton.removeAttribute('disabled');
      }
      this.handleLanguageChange();
    } catch (error) {
      console.error('Fetch error:', error);
      // Fallback for unexpected errors
      if (error instanceof Error && error.message.includes('API key is required')) {
        this.showError('Configuration Error: API key is missing. Please check your environment configuration.');
      } else {
        this.showError(`Failed to fetch accessibility report: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      }
    } finally {
      this.hideLoader();
    }
  }

  private filterAndDisplayResults(standard: string): void {
    if (!this.fetchedData || !this.resultContainer) return;
    this.filteredDataCache.clear();
    const data = this.fetchedData.find((item) => item.standard === 'tags') ||
      this.fetchedData[0];
    if (!data) {
      this.showNoResults();
      return;
    }

    const cacheKey = `${standard}_${this.languageDropdown?.value || 'en'}`;

    let filteredData = this.filteredDataCache.get(cacheKey);
    if (!filteredData) {
      filteredData = this.filterDataByStandard(data, standard);
      this.filteredDataCache.set(cacheKey, filteredData);
    }

    this.displayResults({
      standard: standard,
      grouped: filteredData,
      url: data.url
    });
    this.handleLanguageChange();
  }

  private filterDataByStandard(
    data: AuditData,
    standard: string
  ): Record<string, GroupedData> {
    const filteredGrouped: Record<string, GroupedData> = {};
    const settings = this.getCurrentSettings();
    const impactFilters = settings.impactFilters || {
      critical: true,
      serious: true,
      moderate: true,
      minor: true,
      passed: true
    };
    const hasActiveFilters = Object.values(impactFilters).some(Boolean);
    const showBestPractice = settings.showBestPractice ?? true;

    const passesImpactFilter = (issue: AccessibilityIssue): boolean => {
      if (!hasActiveFilters) return false;
      return Boolean(impactFilters[issue.impact as ImpactType]);
    };

    const passesBestPracticeFilter = (issue: AccessibilityIssue): boolean => {
      if (!issue.tags?.includes('best-practice')) return true;
      return showBestPractice;
    };

    const passesStandardFilter = (issue: AccessibilityIssue): boolean => {
      if (standard === 'tags') return true;

      // Map WCAG tags to their levels
      const mappedTags = this.mapWcagTagsToLevels(issue.tags || []);

      // Check if the standard is in the mapped tags
      return mappedTags.includes(standard);
    };

    const passesDisabilityFilter = (issue: AccessibilityIssue): boolean => {
      if (!settings.selectedDisability) return true;
      return this.issueAffectsDisability(issue, settings.selectedDisability);
    };

    Object.entries(data.grouped).forEach(([category, categoryData]) => {
      const processIssues = (issues: AccessibilityIssue[] = []): AccessibilityIssue[] => {
        return issues.filter(issue => {
          if (!passesImpactFilter(issue)) return false;
          if (!passesBestPracticeFilter(issue)) return false;
          if (!passesStandardFilter(issue)) return false;
          if (!passesDisabilityFilter(issue)) return false;
          return true;
        });
      };

      const filteredErrors = processIssues(categoryData.errors);
      const filteredWarnings = processIssues(categoryData.warnings);
      const filteredNotices = processIssues(categoryData.notices);

      if (filteredErrors.length > 0 || filteredWarnings.length > 0 || filteredNotices.length > 0) {
        filteredGrouped[category] = {
          errors: filteredErrors,
          warnings: filteredWarnings,
          notices: filteredNotices
        };
      }
    });

    return filteredGrouped;
  }

  private getHighestImpact(issues: AccessibilityIssue[]): 'critical' | 'serious' | 'moderate' | 'minor' | 'passed' {
    const impactPriority = ['critical', 'serious', 'moderate', 'minor', 'passed'] as const;
    const impacts = issues.map(issue => issue.impact);

    for (const impact of impactPriority) {
      if (impacts.includes(impact)) {
        return impact;
      }
    }
    return 'passed';
  }

  private getCategoryPriority(issues: AccessibilityIssue[]): number {
    // Define priority weights: higher number = higher priority
    const priorityWeights = {
      'critical': 5,
      'serious': 4,
      'moderate': 3,
      'minor': 2,
      'passed': 1
    };

    // Get the highest impact from the issues
    const highestImpact = this.getHighestImpact(issues);
    return priorityWeights[highestImpact];
  }

  private hasOnlyPassedIssues(issues: AccessibilityIssue[]): boolean {
    return issues.every(issue => issue.impact === 'passed');
  }

  private displayResults(data: AuditData): void {
    if (!this.resultContainer || !data.grouped) {
        this.showNoResults();
        return;
    }

    const settings = this.getCurrentSettings();
    const impactFiltersEnabled = Object.values(settings.impactFilters || {}).some(Boolean);

    if (!impactFiltersEnabled) {
        this.showNoResults();
        return;
    }

    let startIndex = 0;
    let html = '<div class="nsa-accessibility-report">';
    html += '<div class="nsa-issues-by-category">';

    // Find issues for hidden elements first
    const hiddenElementIssues = this.extractHiddenElementIssues(data.grouped, settings);

    // If we have hidden element issues, create a special section for them
    if (hiddenElementIssues.length > 0) {
      const highestImpact = this.getHighestImpact(hiddenElementIssues);

      html += `
        <div class="nsa-issue-category nsa-impact-${highestImpact}">
          <button class="nsa-category-toggle" aria-expanded="false">
            <span data-nsalabel="nsaHiddenElementsTitle">Hidden Elements</span>
            <span class="nsa-category-count">${hiddenElementIssues.length}</span>
            <span class="nsa-dropdown-arrow">${chevronDownIcon}</span>
          </button>
          <div class="nsa-category-content nsa-hidden">
            <div class="nsa-issue-section">
              <h3 class="nsa-issue-section-title"><span data-nsalabel="nsaHiddenElementsLabel">Issues in Non-Visible Elements</span> <span class="nsa-issue-section-count">(${hiddenElementIssues.length})</span></h3>
              <div class="nsa-issue-list">
      `;

      // Use the global renderIssueItem for each hidden element issue
      hiddenElementIssues.forEach((issue, idx) => {
        const issueHtml = renderIssueItem(
          {
            ...issue,
            nodeCount: 1
          },
          startIndex + idx,
          {
            helpIcon,
            aiSolutionIcon,
            chevronDownIcon,
            chevronUpIcon,
          },
          true,
          true,
        );
        html += issueHtml;
      });

      html += `
              </div>
            </div>
          </div>
        </div>
      `;

      startIndex += hiddenElementIssues.length;
    }

    // Prepare categories for sorting
    const categoriesToDisplay: Array<{
        category: string;
        categoryData: GroupedData;
        filteredIssues: AccessibilityIssue[];
        priority: number;
        hasOnlyPassed: boolean;
    }> = [];

    Object.entries(data.grouped).forEach(([category, categoryData]) => {
        const categoryIssues = [
            ...(categoryData.errors || []),
            ...(categoryData.warnings || []),
            ...(categoryData.notices || [])
        ];

        const filteredIssues = this.filterIssues(categoryIssues, settings);

        if (filteredIssues.length > 0) {
            const priority = this.getCategoryPriority(filteredIssues);
            const hasOnlyPassed = this.hasOnlyPassedIssues(filteredIssues);

            categoriesToDisplay.push({
                category,
                categoryData,
                filteredIssues,
                priority,
                hasOnlyPassed
            });
        }
    });

    // Sort categories: non-passed first (by priority), then passed categories
    categoriesToDisplay.sort((a, b) => {
        // If one has only passed issues and the other doesn't, prioritize the non-passed one
        if (a.hasOnlyPassed && !b.hasOnlyPassed) return 1;
        if (!a.hasOnlyPassed && b.hasOnlyPassed) return -1;

        // If both have the same type (both passed or both non-passed), sort by priority
        if (a.hasOnlyPassed === b.hasOnlyPassed) {
            return b.priority - a.priority; // Higher priority first
        }

        return 0;
    });

    // Display sorted categories
    categoriesToDisplay.forEach(({ category, categoryData, filteredIssues }) => {
        const cleanCategory = category.replace('cat.', '');
        const highestImpact = this.getHighestImpact(filteredIssues);

        html += `
            <div class="nsa-issue-category nsa-impact-${highestImpact}">
                <button class="nsa-category-toggle" aria-expanded="false">
                    <span data-nsalabel="nsaCategory${this.formatCategoryName(cleanCategory).trim().replace(/\s+/g, '')}">${this.formatCategoryName(cleanCategory)}</span>
                    <span class="nsa-category-count">${filteredIssues.length}</span>
                    <span class="nsa-dropdown-arrow">${chevronDownIcon}</span>
                </button>
                <div class="nsa-category-content nsa-hidden">
                    ${['errors', 'warnings', 'notices']
                        .map((type) => {
                            const issues = categoryData[type as keyof GroupedData] || [];
                            const filteredTypeIssues = this.filterIssues(issues, settings);

                            if (filteredTypeIssues.length === 0) return '';

                            const sectionHtml = this.generateIssueSection(
                                type.charAt(0).toUpperCase() + type.slice(1),
                                filteredTypeIssues,
                                startIndex
                            );
                            startIndex += filteredTypeIssues.length;
                            return sectionHtml;
                        })
                        .join('')}
                </div>
            </div>
        `;
    });

    // Check if no results were found
    if (hiddenElementIssues.length === 0 && categoriesToDisplay.length === 0) {
      // Check if it's due to a disability filter
      const isDisabilityFilter = Boolean(settings.selectedDisability && settings.selectedDisability !== 'all');
      this.showNoResults(isDisabilityFilter);
      return;
    }

    html += '</div></div>';
    this.resultContainer.innerHTML = html;

    this.tooltipManager.nsaDestroyTooltips();
    this.tooltipManager.nsaFetchAuditData();
    this.tooltipManager.nsaAttachTooltips();
  }

  private generateIssueSection(
    title: string,
    issues?: AccessibilityIssue[],
    startIndex: number = 0
  ): string {
    if (!issues || issues.length === 0) return '';

    const cacheKey = `issue-section-${title}-${issues.length}-${startIndex}-${this.languageDropdown?.value || 'en'}`;
    if (TEMPLATE_CACHE.has(cacheKey)) {
      return TEMPLATE_CACHE.get(cacheKey)!;
    }

    const sectionLabels = {
      errors: `${errorIcon} <span data-nsalabel="nsaAuditErrorLabel">Audit Error</span>`,
      warnings: `${warningIcon} <span data-nsalabel="nsaAuditWarningLabel">Needs Review</span>`,
      notices: `${checkIcon} <span data-nsalabel="nsaAuditPassedLabel">Passed Check</span>`,
    };

    const displayTitle = sectionLabels[title.toLowerCase() as keyof typeof sectionLabels] || title;

    const groupedIssues = issues.reduce(
      (acc: Record<string, AccessibilityIssue[]>, issue) => {
        const key = `${issue.title}-${issue.impact}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(issue);
        return acc;
      },
      {}
    );

    let html = `
      <div class="nsa-issue-section">
        <h3 class="nsa-issue-section-title">${displayTitle} <span class="nsa-issue-section-count">(${issues.length})</span></h3>
        <div class="nsa-issue-list">
    `;

    Object.entries(groupedIssues).forEach(
      ([, groupIssues], groupIndex) => {
        const uniqueGroupId = `issue-group-${title.toLowerCase()}-${groupIndex}-${Date.now()}`;
        const firstIssue = groupIssues[0];

        html += this.generateIssueGroup(
          groupIssues,
          startIndex,
          uniqueGroupId,
          firstIssue.impact === 'passed'
        );
      }
    );

    html += `
        </div>
      </div>
    `;

    TEMPLATE_CACHE.set(cacheKey, html);
    return html;
  }

  private generateIssueGroup(
    issues: AccessibilityIssue[],
    startIndex: number,
    groupId: string,
    _isPassed: boolean
  ): string {
    if (issues.length === 0) return '';

    const firstIssue = issues[0];
    const { title, impact } = firstIssue;

    const displayImpact = impactLabels[impact] || impact;

    let html = `
      <div class="nsa-issue-item nsa-impact-${impact} nsa-issue-node-group" data-group-id="${groupId}">
        <button type="button" class="nsa-issue-header nsa-issue-node-group__header" aria-label="${title}">
          <div class="nsa-issue-header-content">
            <div class="nsa-issue-title">${title}</div>
            <span class="nsa-audit-stat nsa-impact-${impact}">
              ${displayImpact}
              ${impact === 'passed' ? `<span class="nsa-issue-node-count">(${firstIssue.nodeCount || 1})</span>` : ''}
            </span>
          </div>
          <span class="nsa-dropdown-arrow">${chevronDownIcon}</span>
        </button>
        <div class="nsa-issue-node-group__content nsa-hidden">
    `;

    // If impact is passed, only show the first node's details
    const issuesToShow = impact === 'passed' ? [issues[0]] : issues;

    issuesToShow.forEach((issue, index) => {
      const isActive = index === 0;
      const issueIndex = startIndex + index;

      html += `
        <div class="nsa-node-content ${isActive ? 'active' : ''}" data-issue-index="${issueIndex}">
          ${issue.impact !== 'passed' ? `
          <div class="nsa-issue-actions">
            ${issue.selector ? renderHighlightButton(issue.selector, issueIndex, highlightIcon) : ''}
            ${/* renderHelpLink(issue.helpUrl, helpIcon) */ ''}
            ${renderAiSolutionButton(issueIndex, issue.selector || '', aiSolutionIcon)}
          </div>` : ''}
          ${renderIssueCode(issue.code)}
          ${renderIssueContext(issue.context, issue.selector)}
          ${issue.description ? `<div class="nsa-issue-message-container">${issue.description}</div>` : ''}
          ${issue.fix ? `<div class="nsa-issue-fix-container">${issue.fix.replace(/<pre>\s*<code\s+class="(?:nsa-code\s*)?(?:html|xml|css)">([\s\S]*?)<\/code>\s*<\/pre>/g,(_, code) => createCodeEditor(code.trim()))}</div>` : ''}

          ${issue.disabilitiesAffected ? `<div class="nsa-issue-compliance-container">${issue.disabilitiesAffected}</div>` : ''}
          ${issue.wcagReferences?.length ? `
            <div class="nsa-issue-wcag-container">
              <span class="nsa-issue-label" data-nsalabel="nsaWcagReferencesLabel">WCAG References:</span>
              ${issue.wcagReferences.map((ref) => {
                if (typeof ref === 'string') {
                  return `<ul class="nsa-issue-wcag"><li><span data-nsalabel="nsaWcagReferenceLabel">Reference:</span> ${ref}</li></ul>`;
                }
                const wcagRef = ref as WCAGReference;
                return `
                  <ul class="nsa-issue-wcag">
                    <li><span data-nsalabel="nsaWcagCriterionLabel">Criterion:</span> ${wcagRef.criterion || ''}</li>
                    <li><span data-nsalabel="nsaWcagDescriptionLabel">Description:</span> ${wcagRef.description || ''}</li>
                    <li><span data-nsalabel="nsaWcagLevelLabel">Level:</span> ${wcagRef.level || ''}</li>
                    <li><span data-nsalabel="nsaWcagUrlLabel">URL:</span> <a href="${wcagRef.url || '#'}" target="_blank" data-nsalabel="nsaWcagUrlText">WCAG Url</a></li>
                  </ul>
                `;
              }).join('')}
            </div>
          ` : ''}
          <div class="nsa-issue-tags-container">
            <span class="nsa-issue-label" data-nsalabel="nsaTagsLabel">Tags:</span>
            ${renderIssueTags(issue.tags)}
          </div>
        </div>
      `;
    });

    // Only show navigation controls if there are multiple nodes and impact is not passed
    if (issues.length > 1 && impact !== 'passed') {
      html += renderNavigationControls(issues.length, 0, prevIcon, nextIcon)
        .replace('nsa-tooltip-nav', 'nsa-node-navigation')
        .replace('nsa-tooltip-prev', 'nsa-node-navigation__button nsa-node-prev')
        .replace('nsa-tooltip-next', 'nsa-node-navigation__button nsa-node-next');
    }

    html += `</div></div>`;
    return html;
  }

  private filterIssues(issues: AccessibilityIssue[], settings: AuditSettings): AccessibilityIssue[] {
    return issues.filter(issue => {
      // Skip hidden element issues since we've already displayed them
      if (this.isHiddenElementSelector(issue.selector)) return false;

      if (settings.selectedStandard !== 'tags' && issue.tags && !issue.tags.includes(settings.selectedStandard || '')) {
        return false;
      }

      const isBestPractice = issue.tags?.includes('best-practice');
      if (isBestPractice && !settings.showBestPractice) {
        return false;
      }

      if (!settings.impactFilters?.[issue.impact]) {
        return false;
      }

      // Filter by disability if selected
      if (settings.selectedDisability && !this.issueAffectsDisability(issue, settings.selectedDisability)) {
        return false;
      }

      return true;
    });
  }

  private formatCategoryName(category: string): string {
    return (
      category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ')
    );
  }

  private removeHighlights(): void {
    document.querySelectorAll('.nsa-audit-highlight').forEach((element) => {
      element.classList.remove('nsa-audit-highlight');
    });
  }

  public destroy(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.tooltipManager.nsaDestroyTooltips();
    this.removeHighlights();
  }

  private handleNodeNavigation(
    button: Element,
    direction: 'prev' | 'next'
  ): void {
    const nodeGroup = button.closest('.nsa-issue-node-group');
    if (!nodeGroup) return;

    const groupId = nodeGroup.getAttribute('data-group-id');
    if (!groupId) return;

    const nodeContents = Array.from(
      nodeGroup.querySelectorAll('.nsa-node-content')
    );
    if (nodeContents.length <= 1) return;

    let currentIndex = this.activeNodes.get(groupId) || 0;

    if (direction === 'prev') {
      currentIndex = (currentIndex - 1 + nodeContents.length) % nodeContents.length;
    } else {
      currentIndex = (currentIndex + 1) % nodeContents.length;
    }

    this.activeNodes.set(groupId, currentIndex);

    nodeContents?.forEach((node, index) => {
      node.classList.toggle('active', index === currentIndex);
      if (index === currentIndex) {
        const highlightButton = node.querySelector('.nsa-highlight-button');
        if (highlightButton && highlightButton instanceof HTMLElement) {
          setTimeout(() => {
            highlightButton.click();
          }, 10);
        }
      }
    });

    const counter = nodeGroup.querySelector('.nsa-node-current');
    if (counter) {
      counter.textContent = (currentIndex + 1).toString();
    }

    const activeNode = nodeContents[currentIndex];
    if (activeNode) {
      const selector = activeNode.getAttribute('data-selector');
      const issueIndex = parseInt(
        activeNode.getAttribute('data-issue-index') || '0',
        10
      );

      if (selector) {
        // Use the enhanced element finder to find the target element
        const elements = this.tooltipManager.nsaFindElementsBySelector(selector);
        const targetElement = elements.length > 0 ? elements[0] : null;

        if (targetElement) {
          // If the element is inside a wrapper, scroll to the wrapper for better visibility
          const wrapperElement = targetElement.closest('.nsa-tooltip-wrapper') || targetElement;

          // Scroll to the element or its wrapper
          wrapperElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // Add highlight to both the element and its wrapper
          targetElement.classList.add('nsa-audit-highlight');
          if (wrapperElement !== targetElement) {
            wrapperElement.classList.add('nsa-audit-highlight');
          }

          setTimeout(() => {
            targetElement.classList.remove('nsa-audit-highlight');
            if (wrapperElement !== targetElement) {
              wrapperElement.classList.remove('nsa-audit-highlight');
            }
          }, 3000);

          this.tooltipManager.nsaFocusTooltipWithIssueIndex(
            selector,
            issueIndex
          );
        }
      }
    }
  }

  private mapWcagTagsToLevels(tags: string[]): string[] {
    // Create a new array with all existing tags
    const newTags = [...tags];

    // Find all WCAG success criteria tags (2.0, 2.1, and 2.2)
    const wcagTags = tags.filter(tag =>
      tag.startsWith('wcag') &&
      (tag.length === 5 || // WCAG 2.0 (e.g., wcag111)
       tag.length === 6 || // WCAG 2.1 (e.g., wcag2111)
       tag.length === 7)   // WCAG 2.2 (e.g., wcag2211)
    );

    // For each WCAG tag, check which level it belongs to
    wcagTags.forEach(wcagTag => {
      // Check each level in order (A, AA, AAA)
      Object.entries(this.wcagLevelMap).forEach(([level, criteria]) => {
        if (criteria.includes(wcagTag) && !newTags.includes(level)) {
          newTags.push(level);
        }
      });
    });

    return newTags;
  }

  private extractHiddenElementIssues(grouped: Record<string, GroupedData>, settings: AuditSettings): AccessibilityIssue[] {
    const hiddenIssues: AccessibilityIssue[] = [];

    Object.values(grouped).forEach(categoryData => {
      ['errors', 'warnings', 'notices'].forEach(type => {
        const issues = categoryData[type as keyof GroupedData] || [];

        issues.forEach(issue => {
          // Filter by settings first
          if (settings.selectedStandard !== 'tags' && issue.tags && !issue.tags.includes(settings.selectedStandard || '')) {
            return;
          }

          const isBestPractice = issue.tags?.includes('best-practice');
          if (isBestPractice && !settings.showBestPractice) {
            return;
          }

          if (!settings.impactFilters?.[issue.impact]) {
            return;
          }

          // Filter by disability if selected
          if (settings.selectedDisability && !this.issueAffectsDisability(issue, settings.selectedDisability)) {
            return;
          }

          // Now check if it's a hidden element
          if (this.isHiddenElementSelector(issue.selector)) {
            hiddenIssues.push(issue);
          }
        });
      });
    });

    // Sort by impact priority
    return hiddenIssues.sort((a, b) =>
      this.impactPriority.indexOf(a.impact) - this.impactPriority.indexOf(b.impact)
    );
  }

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

  private setupLinkClickHandler(): void {
    // First, let's mark links that have external event listeners
    document.querySelectorAll('a')?.forEach(link => {
      // Check if the link has any click event listeners
      const hasClickListeners = (link as any).__clickListeners ||
                              (link as any).onclick ||
                              link.hasAttribute('onclick') ||
                              link.getAttribute('data-nsa-ignore') === 'true';

      if (hasClickListeners) {
        link.setAttribute('data-nsa-ignore', 'true');
      } else {
        link.removeAttribute('data-nsa-ignore');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target || !(e.target instanceof HTMLElement)) return;
      
      const target = e.target;
      try {
        const link = target.closest('a');

      if (link && link.target !== '_blank' && !link.hasAttribute('data-nsa-ignore') && !this.isExcluded(link)) {
        const href = link.getAttribute('href');

        // Skip if it's a javascript: link or has onclick attribute
        if (href?.startsWith('javascript:') || link.hasAttribute('onclick')) {
          return;
        }

        e.preventDefault();
        if (href) {
          try {
            // Get base URL from website parameter
            const urlParams = new URLSearchParams(window.location.search);
            const websiteParam = urlParams.get('website');
            if (!websiteParam) return;

            // Handle both absolute and relative URLs
            let fullUrl: string;
            if (href.startsWith('http://') || href.startsWith('https://')) {
              fullUrl = href;
            } else {
              // For relative URLs, combine with the website parameter
              const baseUrl = new URL(websiteParam).origin;
              fullUrl = new URL(href, baseUrl).toString();
            }

            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('website', fullUrl);
            window.location.href = currentUrl.toString();
          } catch (error) {
            console.error('Error processing URL:', error);
          }
        }
      }
      } catch (error) {
        console.warn('Error in document click handler:', error);
      }
    });
  }

  private async generatePdfReport(): Promise<void> {
    try {
      // Check if we already have verified user info
      const storedUserInfo = localStorage.getItem('nsaVerifiedUser');
      if (storedUserInfo) {
        const userInfo = JSON.parse(storedUserInfo);
        await this.generatePdfWithUserInfo(userInfo);
        return;
      }

      // Create and show modal for user info
      const modalHtml = `
        <div class="nsa-modal">
          <div class="nsa-modal-content">
            <div class="nsa-modal-header">
              <h3 class="nsa-modal-title" data-nsalabel="nsaPdfModalTitle">Download PDF Report</h3>
              <button type="button" class="nsa-modal-close">&times;</button>
            </div>
            <div class="nsa-modal-body">
              <form id="nsaPdfForm" novalidate>
                <div class="nsa-form-group">
                  <label for="nsaUserName" class="nsa-form-label" data-nsalabel="nsaPdfModalNameLabel">Name <span class="nsa-required">*</span></label>
                  <input type="text" id="nsaUserName" name="name" required="" pattern="[A-Za-z ]{2,}" title="Please enter a valid name (minimum 2 characters, letters only)" class="nsa-form-control">
                  <div class="nsa-error-message" id="nsaNameError"></div>
                </div>
                <div class="nsa-form-group">
                  <label for="nsaUserEmail" class="nsa-form-label" data-nsalabel="nsaPdfModalEmailLabel">Email <span class="nsa-required">*</span></label>
                  <input type="email" id="nsaUserEmail" name="email" required title="Please enter a valid email address" class="nsa-form-control">
                  <div class="nsa-error-message" id="nsaEmailError"></div>
                </div>
                <div class="nsa-form-actions">
                  <button type="submit" class="nsa-btn--primary-light nsa-btn-pdf-download" id="nsaPdfSubmitBtn">
                    <span class="nsa-btn-text" data-nsalabel="nsaPdfModalDownloadBtn">Download PDF</span>
                    <span class="nsa-btn-loader nsa-hidden"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24"><g fill="currentColor"><path d="M8 15c-3.86 0-7-3.141-7-7 0-3.86 3.14-7 7-7 3.859 0 7 3.14 7 7 0 3.859-3.141 7-7 7zM8 3C5.243 3 3 5.243 3 8s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" opacity=".3"/><path d="M14 9a1 1 0 0 1-1-1c0-2.757-2.243-5-5-5a1 1 0 0 1 0-2c3.859 0 7 3.14 7 7a1 1 0 0 1-1 1z"/></g></svg></span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      // Add modal to document
      const template = document.createElement('template');
      template.innerHTML = modalHtml;
      this.shadowRoot?.appendChild(template.content);

      const modal = this.shadowRoot?.querySelector('.nsa-modal');
      // Add dark mode class if theme is dark
      if (this.widgetContainer?.classList.contains('nsa-audit-body--dark')) {
        modal?.classList.add('nsa-modal--dark');
      }

      const nsaForm = this.shadowRoot?.getElementById('nsaPdfForm') as HTMLFormElement;
      const closeBtn = modal?.querySelector('.nsa-modal-close');
      const submitBtn = this.shadowRoot?.getElementById('nsaPdfSubmitBtn');
      const nameInput = this.shadowRoot?.getElementById('nsaUserName') as HTMLInputElement;
      const emailInput = this.shadowRoot?.getElementById('nsaUserEmail') as HTMLInputElement;
      const nameError = this.shadowRoot?.getElementById('nsaNameError');
      const emailError = this.shadowRoot?.getElementById('nsaEmailError');

      // Show modal
      if (modal) {
        modal.setAttribute('style', 'display: block;');
        (modal?.querySelector('.nsa-modal-close') as HTMLElement)?.focus();
      }

      // Real-time validation
      const validateName = () => {
        const name = nameInput.value.trim();
        if (!name) {
          nameError!.textContent = this.getValidationMessage('nsaValidationNameRequired', 'Name is required');
          return false;
        }
        if (!/^[A-Za-z ]{2,}$/.test(name)) {
          nameError!.textContent = this.getValidationMessage('nsaValidationNameInvalid', 'Please enter a valid name (minimum 2 characters, letters only)');
          return false;
        }
        nameError!.textContent = '';
        return true;
      };

      const validateEmail = () => {
        const email = emailInput.value.trim();
        if (!email) {
          emailError!.textContent = this.getValidationMessage('nsaValidationEmailRequired', 'Email is required');
          return false;
        }
        if (!/^[a-z0-9._%+-]+@[a-z0-9\.-]+\.[a-z]{2,}$/.test(email)) {
          emailError!.textContent = this.getValidationMessage('nsaValidationEmailInvalid', 'Please enter a valid email address');
          return false;
        }
        emailError!.textContent = '';
        return true;
      };

      // Add input event listeners for real-time validation
      nameInput?.addEventListener('input', validateName);
      emailInput?.addEventListener('input', validateEmail);

      // Update validation messages when language changes
      const updateValidationMessages = () => {
        // Re-validate current values to update messages
        if (nameInput && nameError) {
          validateName();
        }
        if (emailInput && emailError) {
          validateEmail();
        }
      };

      // Listen for language changes
      this.languageDropdown?.addEventListener('change', updateValidationMessages);

      // Handle form submission
      nsaForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate all fields
        const isNameValid = validateName();
        const isEmailValid = validateEmail();

        if (!isNameValid || !isEmailValid) {
          return;
        }

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        try {
          // Show loading state
          submitBtn?.setAttribute('disabled', 'true');
          submitBtn?.querySelector('.nsa-btn-loader')?.classList.remove('nsa-hidden');
          const urlParams = new URLSearchParams(window.location.search);
          const website = urlParams.get('website') || window.location.href;
          const domain = new URL(website).hostname;

          // Check if user is already verified for this domain
          const storedData = localStorage.getItem('nsaVerifiedUsers');
          const verifiedUsers = storedData ? JSON.parse(storedData) : {};

          if (verifiedUsers[domain] && verifiedUsers[domain].email === email) {
            // User already verified for this domain, proceed with PDF generation
            await this.generatePdfWithUserInfo(verifiedUsers[domain]);
            modal?.remove();
            return;
          }

          // Request OTP
          const otpResponse = await fetch(import.meta.env.VITE_AUDIT_REPORT_URL || '', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': import.meta.env.VITE_AUDIT_REPORT_API_KEY || ''
            },
            body: JSON.stringify({ email, name, domain: website })
          });

          if (!otpResponse.ok) {
            throw new Error('Failed to send OTP');
          }

          // Show OTP verification modal
          const otpModalHtml = `
            <div class="nsa-modal">
              <div class="nsa-modal-content">
                <div class="nsa-modal-header">
                  <h3 class="nsa-modal-title" data-nsalabel="nsaOtpModalTitle">Verify Email</h3>
                  <button type="button" class="nsa-modal-close">&times;</button>
                </div>
                <div class="nsa-modal-body">
                  <p data-nsalabel="nsaOtpModalMessage">Please enter the OTP sent to your email address.</p>
                  <form id="nsaOtpForm" novalidate>
                    <div class="nsa-form-group">
                      <label for="nsaOtpInput" class="nsa-form-label" data-nsalabel="nsaOtpModalOtpLabel">OTP <span class="nsa-required">*</span></label>
                      <input type="text" id="nsaOtpInput" name="otp" required pattern="[0-9]{4}" title="Please enter the 4-digit OTP" class="nsa-form-control" maxlength="4">
                      <div class="nsa-error-message" id="nsaOtpError"></div>
                    </div>
                    <div class="nsa-form-actions">
                      <button type="submit" class="nsa-btn--primary-light nsa-btn-otp-verify" id="nsaOtpSubmitBtn">
                        <span class="nsa-btn-text" data-nsalabel="nsaOtpModalVerifyBtn">Verify OTP</span>
                        <span class="nsa-btn-loader nsa-hidden"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24"><g fill="currentColor"><path d="M8 15c-3.86 0-7-3.141-7-7 0-3.86 3.14-7 7-7 3.859 0 7 3.14 7 7 0 3.859-3.141 7-7 7zM8 3C5.243 3 3 5.243 3 8s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z" opacity=".3"/><path d="M14 9a1 1 0 0 1-1-1c0-2.757-2.243-5-5-5a1 1 0 0 1 0-2c3.859 0 7 3.14 7 7a1 1 0 0 1-1 1z"/></g></svg></span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          `;
          // Remove the first modal
          modal?.remove();

          // Add OTP modal to Shadow DOM
          const otpTemplate = document.createElement('template');
          otpTemplate.innerHTML = otpModalHtml;
          this.shadowRoot?.appendChild(otpTemplate.content);

          const otpModal = this.shadowRoot?.querySelector('.nsa-modal');
          // Add dark mode class if theme is dark
          if (this.widgetContainer?.classList.contains('nsa-audit-body--dark')) {
            otpModal?.classList.add('nsa-modal--dark');
          }

          const otpForm = this.shadowRoot?.getElementById('nsaOtpForm') as HTMLFormElement;
          const otpCloseBtn = otpModal?.querySelector('.nsa-modal-close');
          const otpSubmitBtn = this.shadowRoot?.getElementById('nsaOtpSubmitBtn');
          const otpInput = this.shadowRoot?.getElementById('nsaOtpInput') as HTMLInputElement;
          const otpError = this.shadowRoot?.getElementById('nsaOtpError');
          this.handleLanguageChange();
          // Show OTP modal
          if (otpModal) {
            otpModal.setAttribute('style', 'display: block;');
            (otpModal?.querySelector('.nsa-modal-close') as HTMLElement)?.focus();
          }

          // Handle OTP form submission
          otpForm?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const otp = otpInput.value.trim();
            if (!otp || !/^[0-9]{4}$/.test(otp)) {
              otpError!.textContent = this.getValidationMessage('nsaValidationOtpRequired', 'Please enter a valid 4-digit OTP');
              return;
            }

            try {
              // Show loading state
              otpSubmitBtn?.setAttribute('disabled', 'true');
              otpSubmitBtn?.querySelector('.nsa-btn-loader')?.classList.remove('nsa-hidden');

              // Verify OTP
              const verifyResponse = await fetch(import.meta.env.VITE_AUDIT_EMAIL_VALIDATE_URL || '', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': import.meta.env.VITE_AUDIT_EMAIL_VALIDATE_API_KEY || ''
                },
                body: JSON.stringify({ name, email, domain: website, otp })
              });

              const responseData = await verifyResponse.json();

              if (!verifyResponse.ok || !responseData.success) {
                throw new Error(responseData.error?.message || 'Invalid OTP');
              }

              // Only proceed if verification was successful
              if (responseData.success) {
                // Store verified user info per domain
                const userInfo = { name, email };
                verifiedUsers[domain] = userInfo;
                localStorage.setItem('nsaVerifiedUsers', JSON.stringify(verifiedUsers));

                // Generate PDF with user info
                await this.generatePdfWithUserInfo(userInfo);

                // Close OTP modal
                otpModal?.remove();
              }
            } catch (error) {
              console.error('Error verifying OTP:', error);
              otpError!.textContent = this.getValidationMessage('nsaValidationOtpInvalid', 'Invalid OTP. Please try again.');
            } finally {
              // Reset button state
              otpSubmitBtn?.removeAttribute('disabled');
              otpSubmitBtn?.querySelector('.nsa-btn-loader')?.classList.add('nsa-hidden');
            }
          });

          // Handle OTP modal close
          const closeOtpModal = () => {
            otpModal?.remove();
          };

          otpCloseBtn?.addEventListener('click', closeOtpModal);
          document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOtpModal(); });

          // Close OTP modal when clicking outside
          otpModal?.addEventListener('click', (e) => {
            if (e.target === otpModal) {
              closeOtpModal();
            }
          });

        } catch (error) {
          console.error('Error requesting OTP:', error);
          emailError!.textContent = this.getValidationMessage('nsaValidationOtpSendFailed', 'Failed to send OTP. Please try again.');
        } finally {
          // Reset button state
          submitBtn?.removeAttribute('disabled');
          submitBtn?.querySelector('.nsa-btn-loader')?.classList.add('nsa-hidden');
        }
      });

      // Handle modal close
      const closeModal = () => {
        // Remove language change listener
        this.languageDropdown?.removeEventListener('change', updateValidationMessages);
        modal?.remove();
      };

      closeBtn?.addEventListener('click', closeModal);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

      // Close modal when clicking outside
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal();
        }
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      this.showError('Failed to generate PDF report. Please try again.');
    }
  }

  private async generatePdfWithUserInfo(userInfo: { name: string; email: string }): Promise<void> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const website = urlParams.get('website') || window.location.href;

      const pdfGenerator = new NsaPdfGenerator({
        title: 'Accesstive - Live Audit',
        url: website,
        date: new Date().toLocaleDateString(),
        language: this.languageDropdown?.value || 'en',
        userInfo: userInfo
      });
      pdfGenerator.save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.showError('Failed to generate PDF report. Please try again.');
    }
  }

  private transformAxeData(data: any): AuditData {
    const groupedData: Record<string, GroupedData> = {};

    const processAxeItem = (item: any, level: 'error' | 'warning' | 'notice'): AccessibilityIssue[] => {
      const category = item.category || item.tags?.[0]?.replace('cat.', '') || 'other';

      if (!groupedData[category]) {
        groupedData[category] = { errors: [], warnings: [], notices: [] };
      }

      let impact: 'critical' | 'serious' | 'moderate' | 'minor' | 'passed' = 'passed';

      if (level === 'notice') {
        impact = 'passed';
      } else if (level === 'error') {
        impact = item.impact || 'serious';
      } else {
        impact = item.impact || 'moderate';
      }

      // Map WCAG tags to their levels before creating the issue
      const mappedTags = this.mapWcagTagsToLevels(item.tags || []);
      const createIssue = (node: any = null): AccessibilityIssue => ({
        title: formatHtmlTags(item?.title || item.id || ''),
        message: node?.failureSummary || item.help || '',
        description: item.description || '',
        code: item.id || item.actRuleId || '',
        selector: node?.target?.join(', ') || '',
        context: node?.html || '',
        category: item.category || item.tags?.[0]?.replace('cat.', '') || 'other',
        type: level,
        impact,
        level,
        tags: mappedTags,
        helpUrl: `https://accesstive.com/rules/${item.id}` || '',
        guidelines: item.guidelines || '',
        whyMatters: item.whyImportant || '',
        fix: item.howToFix || '',
        disabilitiesAffected: Array.isArray(item.disabilityTypesAffected) ? item.disabilityTypesAffected : item.disabilityTypesAffected ? [item.disabilityTypesAffected] : [],
        algorithmSimple: item.algorithm || '',
        wcagReferences: item.wcagReferences || [],
        nodeCount: item.nodes?.length || 0,
      });

      // If there are nodes, create an issue for each one
      if (item.nodes?.length) {
        return item.nodes.map(createIssue);
      }

      // Otherwise create a single issue
      return [createIssue()];
    };

    const processAxeItems = (items: any[], level: 'error' | 'warning' | 'notice') => {
      items.forEach((item) => {
        const issues = processAxeItem(item, level);
        const category = item.category || item.tags?.[0]?.replace('cat.', '') || 'other';
        groupedData[category][`${level}s`]?.push(...issues);
      });
    };

    if (data.violations) processAxeItems(data.violations, 'error');
    if (data.incomplete) processAxeItems(data.incomplete, 'warning');
    if (data.passes) processAxeItems(data.passes, 'notice');
    if (data.inapplicable) processAxeItems(data.inapplicable, 'notice');

    // Extract statistics from the API response
    const statistics = data.statistics ? {
      totalIssues: data.statistics.totalIssues || 0,
      criticalIssues: data.statistics.criticalIssues || 0,
      seriousIssues: data.statistics.seriousIssues || 0,
      moderateIssues: data.statistics.moderateIssues || 0,
      minorIssues: data.statistics.minorIssues || 0,
      scorePercentage: data.statistics.scorePercentage || 0,
      totalApplicable: data.statistics.totalApplicable || 0,
      passed: data.statistics.passed || 0,
      violations: data.statistics.violations || 0,
      incomplete: data.statistics.incomplete || 0
    } : undefined;

    return {
      standard: 'tags',
      grouped: groupedData,
      url: data.url,
      statistics: statistics
    };
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

    // Get current language for language-aware keyword matching
    const currentLanguage = this.languageDropdown?.value || 'en';

    // Map disability values to common disability types (language-aware)
    const disabilityMap: Record<string, Record<string, string[]>> = {
      en: {
        'attention-deficit': ['attention', 'adhd', 'focus'],
        'blind': ['blind', 'blindness'],
        'deafblind': ['deafblind', 'deaf-blind'],
        'mobility': ['mobility', 'motor', 'physical'],
        'low-vision': ['low-vision', 'vision'],
        'colorblindness': ['colorblind', 'color-blind'],
        'keyboard': ['keyboard', 'keyboard-only'],
        'deaf': ['deaf', 'hearing'],
        'cognitive': ['cognitive', 'learning']
      },
      de: {
        'attention-deficit': ['aufmerksamkeit', 'adhs', 'fokus', 'aufmerksamkeitsdefizit'],
        'blind': ['blind', 'blindheit'],
        'deafblind': ['taubblind', 'taub-blind'],
        'mobility': ['mobilität', 'motor', 'körperlich', 'bewegung'],
        'low-vision': ['sehbehinderung', 'sehschwäche', 'vision'],
        'colorblindness': ['farbenblind', 'farb-blind', 'farbenblindheit'],
        'keyboard': ['tastatur', 'tastatur-nur', 'tastaturbenutzer'],
        'deaf': ['taub', 'hörbehinderung', 'gehörlos'],
        'cognitive': ['kognitiv', 'lernen', 'wahrnehmung']
      }
    };

    // Check if any of the disability names match the selected disability
    const keywords = disabilityMap[currentLanguage]?.[selectedDisability] || disabilityMap.en[selectedDisability] || [];
    return disabilityNames.some(disabilityName =>
      keywords.some(keyword => disabilityName.includes(keyword))
    );
  }

  private updateDisabilityIcon(disability: string): void {
    if (!this.disabilityIcon) return;

    // Update CSS classes to match the selected disability
    const disabilityClasses = ['all', 'blind', 'deafblind', 'mobility', 'low-vision', 'colorblindness', 'keyboard', 'deaf', 'cognitive', 'attention-deficit'];

    // Remove all disability classes
    disabilityClasses.forEach(cls => {
      this.disabilityIcon?.classList.remove(cls);
    });

    // Add classes based on selection
    this.disabilityIcon?.classList.add(disability);
  }

  private getDocumentLanguage(): string {
    // Get language from document's lang attribute
    const docLang = document.documentElement.lang;
    // If no lang attribute, try to get from html tag
    const htmlLang = document.querySelector('html')?.getAttribute('lang');
    // If still no language found, default to 'en'
    return docLang || htmlLang || 'en';
  }
}
export default NsaAuditAccesstive;

