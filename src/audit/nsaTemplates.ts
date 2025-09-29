// Shared HTML templates to avoid duplication
// Used by nsaAuditTooltip.ts and nsaAudit.ts

/**
 * Escape HTML characters to prevent XSS
 */
export const escapeHtml = (unsafe: string): string => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Format HTML tags for display
 */
export const formatHtmlTags = (text: string | undefined | null): string => {
  if (!text) return '';
  return String(text).replace(/<([^>]+)>/g, '<code>&lt;$1&gt;</code>');
};

/**
 * Impact labels map
 */
export const impactLabels: Record<string, string> = {
  'critical': 'Critical',
  'serious': 'Serious',
  'moderate': 'Moderate',
  'minor': 'Minor',
  'passed': 'Passed'
};

/**
 * Generates HTML for issue tags
 */
export const renderIssueTags = (tags: string[] | undefined): string => {
  if (!tags?.length) return '';
  return `<div class="nsa-issue-tags">
    ${tags.map(tag => `<span class="nsa-tag">${escapeHtml(tag)}</span>`).join('')}
  </div>`;
};

/**
 * Generates HTML for issue code
 */
export const renderIssueCode = (code: string | undefined): string => {
  if (!code) return '';
  return `<strong class="nsa-issue-code nsa-issue-label">Source: ${escapeHtml(code)}</strong>`;
};

/**
 * Creates code editor HTML with syntax highlighting
 */
export const createCodeEditor = (content: string): string => {
  const lines = content.split('\n');
  const lineNumbers = lines.map((_, index) =>
    `<span class="nsa-code-line-number">${index + 1}</span>`
  ).join('\n');

  const highlightedContent = lines.map(line => {
    let highlighted = line.replace(/(&lt;\/?)([\w-]+)(.*?)(\/?&gt;)/g, (_, open, tag, attrs, close) => {
      const highlightedAttrs = attrs.replace(/([\s]*)([\w:-]+)(="[^"]*")/g, (_: any, space: any, attr: any, val: any) => {
        return `${space}<span class="nsa-code-attr">${attr}</span><span class="nsa-code-value">${val}</span>`;
      });
      return `${open}<span class="nsa-code-tag">${tag}</span>${highlightedAttrs}${close}`;
    });

    highlighted = highlighted.replace(/&([a-z]+);/g, '<span class="nsa-code-entity">&$1;</span>');
    highlighted = highlighted.replace(/&lt;!--(.*?)--&gt;/g, '<span class="nsa-code-comment">&lt;!--$1--&gt;</span>');

    return `<span class="nsa-code-line">${highlighted}</span>`;
  }).join('\n');

  return `
    <div class="nsa-code-editor">
      <div class="nsa-code-line-numbers">${lineNumbers}</div>
      <div class="nsa-code-content">${highlightedContent}</div>
    </div>
  `;
};

/**
 * Renders issue context (code preview)
 */
export const renderIssueContext = (context: string | undefined, selector: string | undefined): string => {
  if (!context && !selector) return '';
  const contentToRender = `<pre><code class="nsa-code html">${escapeHtml(context || selector || '')}</code></pre>`;
  return `<div class="nsa-issue-context">
    <div class="nsa-issue-code-preview">
    ${contentToRender.replace(/<pre>\s*<code\s+class="(?:nsa-code\s*)?(?:html|xml|css)">([\s\S]*?)<\/code>\s*<\/pre>/g,(_, code) => createCodeEditor(code.trim()))}</div>
  </div>`;
};

/**
 * Renders help link button HTML
 */
export const renderHelpLink = (helpUrl: string | undefined, helpIcon: string): string => {
  if (!helpUrl) return '';
  return `<a href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer"
    class="nsa-issue-button" aria-label="Learn more">${helpIcon}</a>`;
};

/**
 * Safely encodes a string for use in HTML attributes using JSON.stringify
 * Handles edge cases like null/undefined and ensures proper escaping
 */
export const jsonEncode = (input: string | undefined | null): string => {
  if (input == null) return '';
  try {
    // First JSON.stringify to handle any special characters
    // Then replace quotes with &quot; for HTML safety
    return JSON.stringify(input)
      .replace(/"/g, '&quot;')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  } catch (e) {
    console.warn('Failed to encode selector:', e);
    return '';
  }
};

/**
 * Safely decodes a string from HTML attributes
 * Handles edge cases and provides fallback behavior
 */
export const jsonDecode = (input: string | undefined | null): string => {
  if (!input) return '';
  try {
    // First replace HTML entities back to their characters
    const unescaped = input
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    // Then parse the JSON string
    return JSON.parse(unescaped);
  } catch (e) {
    console.warn('Failed to decode selector, using as-is:', e);
    return input;
  }
};

/**
 * Renders highlight button HTML
 */
export const renderHighlightButton = (
  selector: string | undefined,
  issueIndex: number,
  highlightIcon: string
): string => {
  if (!selector) return '';
  return `<button class="nsa-issue-button nsa-highlight-button"
    data-selector="${jsonEncode(selector)}"
    data-issue-index="${issueIndex}"
    data-issue-title="${issueIndex}"
    aria-label="Highlight">${highlightIcon}</button>`;
};

/**
 * Renders AI solution button HTML
 */
export const renderAiSolutionButton = (
  issueIndex: number,
  selector: string,
  aiSolutionIcon: string
): string => {
  return `<button class="nsa-issue-button nsa-ai-solution-button"
    data-selector="${jsonEncode(selector)}"
    data-issue-index="${issueIndex}"
    aria-label="Get AI solution">${aiSolutionIcon}</button>`;
};

export interface IssueData {
  nodeCount?: number;
  title: string;
  description: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | 'passed';
  message: string;
  tags?: string[];
  code?: string;
  context?: string;
  selector?: string;
  helpUrl?: string;
  guidelines?: string;
  whyMatters?: string;
  fix?: string;
  disabilitiesAffected?: string[];
  algorithmSimple?: string;
  wcagReferences?: (string | WCAGReference)[];
}

export interface WCAGReference {
  criterion: string;
  description: string;
  level: string;
  url: string;
}

export interface IconSet {
  helpIcon: string;
  highlightIcon?: string;
  aiSolutionIcon?: string;
  chevronDownIcon?: string;
  chevronUpIcon?: string;
  showButtons?: boolean;
  dropdown?: boolean;
}

interface IssueContentOptions {
  showButtons?: boolean;
  showTitle?: boolean;
  showImpact?: boolean;
  additionalClasses?: string;
  additionalHeaderContent?: string;
  dropdown?: boolean;
}


/**
 * Helper function to render optional list sections
 */
export const renderOptionalList = (items: string[] | undefined): string => {
  if (!items?.length) return '';
  return `<ul class="nsa-issue-list">
    ${items.map(item => `<li>${formatHtmlTags(item)}</li>`).join('')}
  </ul>`;
};


/**
 * Renders the base content for an issue
 */
const renderBaseIssueContent = (
  issue: IssueData,
  issueIndex: number,
  icons: IconSet,
  options: IssueContentOptions = {}
): string => {
  const {
    showButtons = true,
    showTitle = true,
    showImpact = true,
    additionalClasses = '',
    additionalHeaderContent = '',
    dropdown = false,
  } = options;

  const actionButtons = showButtons ? `
    <div class="nsa-issue-actions">
      ${icons.highlightIcon && issue.selector && issue.impact !== 'passed' ? renderHighlightButton(issue.selector, issueIndex, icons.highlightIcon) : ''}
      ${/* renderHelpLink(issue.helpUrl, icons.helpIcon) */ ''}
      ${icons.aiSolutionIcon && issue.impact !== 'passed' ? renderAiSolutionButton(issueIndex, issue.selector || '', icons.aiSolutionIcon) : ''}
    </div>` : '';

  const titleHtml = showTitle ? `<p class="nsa-issue-title">${issue.title}</p>` : '';
  const impact = issue.impact || 'passed';
  const nodeCount = issue.nodeCount || 1;
  const impactHtml = showImpact ? `<span class="nsa-audit-stat nsa-impact-${impact}">${impactLabels[impact] || impact}${impact === 'passed' ? `<span class="nsa-issue-node-count">(${nodeCount})</span>` : ''}</span>` : '';

  const headerAttrs = dropdown ? 'aria-expanded="false"' : '';
  const detailsClass = dropdown ? 'nsa-issue-details nsa-hidden' : 'nsa-issue-details';

  // Add dropdown arrow if dropdown is enabled and icons are available
  const dropdownArrow = dropdown && icons.chevronDownIcon ? `<span class="nsa-dropdown-arrow">${icons.chevronDownIcon}</span>` : '';

  return `
    <div class="nsa-tooltip-issue nsa-impact-${issue.impact} ${additionalClasses}">
      <button type="button" class="nsa-issue-header nsa-issue-node-group__header" ${headerAttrs} aria-label="${issue.title}">
        <div class="nsa-issue-header-content">
          ${titleHtml} ${impactHtml} ${additionalHeaderContent}
        </div>
        ${dropdownArrow}
      </button>
      <div class="${detailsClass}">
        ${actionButtons ? `
        <div class="nsa-issue-actions-container">
          ${actionButtons}
        </div>` : ''}
        ${renderIssueCode(issue.code)}
        ${renderIssueContext(issue.context, issue.selector)}
        ${issue.description ? `<div class="nsa-issue-message-container">${issue.description}</div>` : ''}
        ${issue.fix ? `<div class="nsa-issue-fix-container">${issue.fix.replace(/<pre>\s*<code\s+class="(?:nsa-code\s*)?(?:html|xml|css)">([\s\S]*?)<\/code>\s*<\/pre>/g,(_, code) => createCodeEditor(code.trim()))}</div>` : ''}
        ${issue.disabilitiesAffected ? `<div class="nsa-issue-compliance-container">${issue.disabilitiesAffected}</div>` : ''}
        ${issue.wcagReferences?.length ? `<div class="nsa-issue-wcag-container"><span class="nsa-issue-label" data-nsalabel="nsaWcagReferencesLabel">WCAG References:</span>${issue.wcagReferences.map((ref) => {if (typeof ref === 'string') {return `<ul class="nsa-issue-wcag"><li>Reference: ${ref}</li></ul>`;}
        const wcagRef = ref as WCAGReference;
        return `<ul class="nsa-issue-wcag"><li><span data-nsalabel="nsaWcagCriterionLabel">Criterion:</span> ${wcagRef.criterion || ''}</li><li><span data-nsalabel="nsaWcagDescriptionLabel">Description:</span> ${wcagRef.description || ''}</li><li><span data-nsalabel="nsaWcagLevelLabel">Level:</span> ${wcagRef.level || ''}</li><li><span data-nsalabel="nsaWcagUrlLabel">URL:</span> <a href="${wcagRef.url || '#'}" target="_blank">WCAG Url</a></li></ul>`;}).join('')}</div>` : ''}

        <div class="nsa-issue-tags-container">
          <span class="nsa-issue-label" data-nsalabel="nsaTagsLabel">Tags:</span>
          ${renderIssueTags(issue.tags)}
        </div>
      </div>
    </div>
  `;
};

/**
 * Renders navigation controls for multi-issue displays
 */
export const renderNavigationControls = (
  totalIssues: number,
  currentIndex: number,
  prevIcon: string,
  nextIcon: string
): string => {
  if (totalIssues <= 1) return '';

  return `
    <div class="nsa-tooltip-nav nsa-tooltip-nav--visible">
      <button type="button" aria-label="Previous issue" class="nsa-tooltip-prev">${prevIcon}</button>
      <div class="nsa-tooltip-counter">
        <span class="nsa-node-current">${currentIndex + 1}</span> /
        <span class="nsa-node-total">${totalIssues}</span>
      </div>
      <button type="button" aria-label="Next issue" class="nsa-tooltip-next">${nextIcon}</button>
    </div>
  `;
};

/**
 * Renders issue details for tooltips
 */
export const renderIssueDetails = (
  issue: IssueData,
  issueIndex: number,
  icons: IconSet,
  showButtons: boolean = true
): string => {
  return renderBaseIssueContent(issue, issueIndex, icons, {
    showButtons,
    additionalClasses: 'nsa-tooltip-issue'
  });
};

/**
 * Renders issue item for the main audit view
 */
export const renderIssueItem = (
  issue: IssueData,
  issueIndex: number,
  icons: IconSet,
  showButtons: boolean = true,
  dropdown: boolean = true,
): string => {
  return renderBaseIssueContent(issue, issueIndex, icons, {
    showButtons,
    dropdown,
  });
};
