/**
 * Accesstive - Live Audit Widget
 * Popup Script for Chrome Extension
 */

class AccesstiveWidget {
  constructor() {
    this.settings = {
      language: 'en',
      standard: 'wcag21aa',
      theme: 'dark'
    };
    this.auditData = {
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: []
    };
    this.filteredData = {
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: []
    };
    this.isExpanded = false;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    this.showWidget();
    
    // Automatically start scanning when widget opens
    this.startScan();
  }

  setupEventListeners() {
    // Close button
    const closeBtn = document.getElementById('nsaCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePanel());
    }

    // Theme toggle
    const themeBtn = document.getElementById('nsaAuditThemeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Language dropdown
    const languageSelect = document.getElementById('nsaLanguageDropdown');
    if (languageSelect) {
      languageSelect.addEventListener('change', (e) => this.changeLanguage(e.target.value));
    }

    // Standard dropdown
    const standardSelect = document.getElementById('nsaStandardDropdown');
    if (standardSelect) {
      standardSelect.addEventListener('change', (e) => this.changeStandard(e.target.value));
    }

    // Scan button
    const scanBtn = document.getElementById('nsaScanBtn');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => this.startScan());
    }

    // PDF button
    const pdfBtn = document.getElementById('nsaPdfBtn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => this.exportReport('pdf'));
    }

    // Share button
    const shareBtn = document.getElementById('nsaShareBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareReport());
    }

    // Impact filters
    const filterCheckboxes = document.querySelectorAll('.nsa-impact-filter__checkbox');
    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateFilterCounts();
        this.updateUI();
      });
    });

    // Expand toggle button
    const expandBtn = document.getElementById('nsaExpandToggleBtn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.toggleExpandAll());
    }

    // Disability dropdown
    const disabilitySelect = document.getElementById('nsaDisabilityDropdown');
    if (disabilitySelect) {
      disabilitySelect.addEventListener('change', (e) => this.changeDisabilityFilter(e.target.value));
    }

    // Keyboard navigation
    this.setupKeyboardNavigation();
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get();
      this.settings = {
        ...this.settings,
        ...settings
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  showWidget() {
    const widget = document.getElementById('nsaAuditWidget');
    
    if (widget) {
      widget.style.display = 'flex';
      
      // Force show the widget
      widget.style.visibility = 'visible';
      widget.style.opacity = '1';
    } else {
      console.error('Widget not found');
    }
  }

  closePanel() {
    // Close the extension popup
    window.close();
  }

  async startScan() {
    try {
      this.showLoader(true);

      // Get current tab
      if (!chrome.tabs || !chrome.tabs.query) {
        throw new Error('Chrome tabs API not available');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      // Start audit
      const response = await chrome.runtime.sendMessage({
        action: 'startAudit',
        options: {
          language: this.settings.language,
          standard: this.settings.standard
        }
      });

      if (response && response.success) {
        this.auditData = response.results || this.auditData;
        this.updateUI();
        
        // Get the results after a delay
        setTimeout(() => this.getAuditResults(tab.id), 2000);
      } else {
        const errorMessage = response && response.error ? response.error : 'Failed to start scan';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to start scan:', error);
      this.showError('Failed to start accessibility scan. Please try again.');
      this.showLoader(false);
    }
  }

  async getAuditResults(tabId) {
    try {
      // Get results from storage
      const result = await chrome.storage.local.get(`auditResults_${tabId}`);
      const auditData = result[`auditResults_${tabId}`];

      if (auditData) {
        this.auditData = auditData;
        this.updateUI();
        this.showLoader(false);
      } else {
        // Retry after a short delay
        setTimeout(() => this.getAuditResults(tabId), 1000);
      }
    } catch (error) {
      console.error('Failed to get audit results:', error);
      this.showLoader(false);
    }
  }

  updateUI() {
    this.applyFilters();
    this.updateErrorCount();
    this.updateFilterCounts();
    this.updateCategoryData();
    this.updateLanguageUI();
    this.updateStandardUI();
    this.applyTheme();
  }

  applyFilters() {
    const violations = this.auditData.violations || [];
    const passes = this.auditData.passes || [];
    
    // Apply impact filters
    const activeImpactFilters = this.getActiveImpactFilters();
    const filteredViolations = violations.filter(violation => 
      activeImpactFilters.includes(violation.impact)
    );
    
    // Apply standard filter
    const selectedStandard = this.settings.standard;
    const standardFilteredViolations = this.filterByStandard(filteredViolations, selectedStandard);
    const standardFilteredPasses = this.filterByStandard(passes, selectedStandard);
    
    this.filteredData = {
      violations: standardFilteredViolations,
      passes: standardFilteredPasses,
      incomplete: this.auditData.incomplete || [],
      inapplicable: this.auditData.inapplicable || []
    };
  }

  getActiveImpactFilters() {
    const activeFilters = [];
    const filterCheckboxes = document.querySelectorAll('.nsa-impact-filter__checkbox');
    
    filterCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        const filterItem = checkbox.closest('.nsa-impact-filter');
        if (filterItem) {
          const filterType = filterItem.classList[1].split('--')[1];
          if (filterType === 'best-practice') {
            return;
          }
          activeFilters.push(filterType);
        }
      }
    });
    
    return activeFilters;
  }

  filterByStandard(items, standard) {
    if (standard === 'tags') {
      return items;
    }
    
    const standardTags = {
      'wcag2a': ['wcag2a'],
      'wcag2aa': ['wcag2a', 'wcag2aa'],
      'wcag2aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa'],
      'wcag21a': ['wcag2a', 'wcag21a'],
      'wcag21aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      'wcag21aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
      'wcag22a': ['wcag2a', 'wcag21a', 'wcag22a'],
      'wcag22aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'],
      'wcag22aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa', 'wcag22a', 'wcag22aa', 'wcag22aaa'],
      'section508': ['section508'],
      'TTv5': ['TTv5'],
      'EN-301-549': ['EN-301-549']
    };
    
    const allowedTags = standardTags[standard] || [];
    
    return items.filter(item => {
      if (!item.tags || item.tags.length === 0) {
        return true;
      }
      
      return item.tags.some(tag => allowedTags.includes(tag));
    });
  }

  updateErrorCount() {
    const errorCount = this.filteredData.violations ? this.filteredData.violations.length : 0;
    const errorCountElement = document.getElementById('nsaAuditCount');
    
    if (errorCountElement) {
      errorCountElement.textContent = errorCount;
    }
  }

  updateFilterCounts() {
    const violations = this.auditData.violations || [];
    const passes = this.auditData.passes || [];

    const counts = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      passed: passes.length,
      bestPractice: 0
    };

    violations.forEach(violation => {
      switch (violation.impact) {
        case 'critical':
          counts.critical++;
          break;
        case 'serious':
          counts.serious++;
          break;
        case 'moderate':
          counts.moderate++;
          break;
        case 'minor':
          counts.minor++;
          break;
      }
    });

    this.updateCountElement('nsaImpactCriticalCount', counts.critical);
    this.updateCountElement('nsaImpactSeriousCount', counts.serious);
    this.updateCountElement('nsaImpactModerateCount', counts.moderate);
    this.updateCountElement('nsaImpactMinorCount', counts.minor);
    this.updateCountElement('nsaImpactPassedCount', counts.passed);
    this.updateCountElement('nsaBestPracticeCount', counts.bestPractice);
  }

  updateCountElement(elementId, count) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = count;
    }
  }

  updateCategoryData() {
    const resultsContainer = document.getElementById('nsaResults');
    if (!resultsContainer) return;

    const categoryGroups = this.groupViolationsByCategory();
    
    resultsContainer.innerHTML = '';

    if (Object.keys(categoryGroups).length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #888;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">No Issues Found!</div>
          <div style="font-size: 14px;">This page appears to be accessible.</div>
        </div>
      `;
      return;
    }

    // Create the wrapper structure
    const accessibilityReport = document.createElement('div');
    accessibilityReport.className = 'nsa-accessibility-report';

    const issuesByCategory = document.createElement('div');
    issuesByCategory.className = 'nsa-issues-by-category';

    Object.entries(categoryGroups).forEach(([categoryName, data]) => {
      const categoryItem = this.createCategoryItem(categoryName, data);
      issuesByCategory.appendChild(categoryItem);
    });

    accessibilityReport.appendChild(issuesByCategory);
    resultsContainer.appendChild(accessibilityReport);
  }

  groupViolationsByCategory() {
    const violations = this.filteredData.violations || [];
    const passes = this.filteredData.passes || [];
    const categories = {};

    violations.forEach(violation => {
      const category = violation.category || 'Other';
      if (!categories[category]) {
        categories[category] = {
          violations: [],
          passes: [],
          total: 0,
          type: 'warning'
        };
      }
      categories[category].violations.push(violation);
      categories[category].total++;
    });

    passes.forEach(pass => {
      const category = pass.category || 'Other';
      if (!categories[category]) {
        categories[category] = {
          violations: [],
          passes: [],
          total: 0,
          type: 'success'
        };
      }
      categories[category].passes.push(pass);
      if (categories[category].violations.length === 0) {
        categories[category].total++;
      }
    });

    Object.values(categories).forEach(category => {
      if (category.violations.length > 0) {
        category.type = 'warning';
      } else {
        category.type = 'success';
      }
    });

    return categories;
  }

  createCategoryItem(categoryName, data) {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'nsa-issue-category';
    
    // Add impact class based on the highest impact level
    const highestImpact = this.getHighestImpact(data);
    if (highestImpact) {
      categoryItem.classList.add(`nsa-impact-${highestImpact}`);
    }

    const categoryHeader = document.createElement('button');
    categoryHeader.className = 'nsa-category-toggle';
    categoryHeader.setAttribute('aria-expanded', 'false');
    categoryHeader.innerHTML = `
      <span data-nsalabel="nsaCategoryNamerolevalue" title="Name Role Wert">${categoryName}</span>
      <span class="nsa-category-count">${data.total}</span>
      <span class="nsa-dropdown-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24">
          <g fill="currentColor">
            <path d="m4.464 6.05-.707.707L8 11l4.243-4.243-.707-.707L8 9.586z"></path>
          </g>
        </svg>
      </span>
    `;

    const categoryContent = document.createElement('div');
    categoryContent.className = 'nsa-category-content nsa-hidden';

    // Create issue sections
    if (data.violations.length > 0) {
      const errorsSection = this.createIssueSection('errors', data.violations, 'Prüfungsfehler');
      categoryContent.appendChild(errorsSection);
    }

    if (data.passes.length > 0) {
      const passedSection = this.createIssueSection('passed', data.passes, 'Bestanden');
      categoryContent.appendChild(passedSection);
    }

    categoryItem.appendChild(categoryHeader);
    categoryItem.appendChild(categoryContent);

    categoryHeader.addEventListener('click', () => {
      this.toggleCategory(categoryItem);
    });

    return categoryItem;
  }

  getHighestImpact(data) {
    const impacts = ['critical', 'serious', 'moderate', 'minor'];
    for (const impact of impacts) {
      if (data.violations.some(v => v.impact === impact)) {
        return impact;
      }
    }
    return 'passed';
  }

  createIssueSection(type, items, title) {
    const section = document.createElement('div');
    section.className = 'nsa-issue-section';

    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'nsa-issue-section-title';
    
    const iconColor = type === 'errors' ? '#cc0000' : '#007a00';
    const iconPath = type === 'errors' 
      ? 'M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm-.448 3h.896a.5.5 0 0 1 .497.55L8.5 9h-1l-.445-4.45A.5.5 0 0 1 7.552 4zM8 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2z'
      : 'M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm4.1 4.7-4.9 4.9-.4.4c-.1.1-.3.1-.4 0l-.4-.3-2.1-2.1c-.1-.1-.1-.3 0-.4l.3-.4c.1-.1.3-.1.4 0l2 2L11.3 5c.1-.1.3-.1.4 0l.4.3c.1.1.1.3 0 .4z';

    sectionTitle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path fill="${iconColor}" d="${iconPath}"></path>
      </svg>
      <span data-nsalabel="nsaAudit${type === 'errors' ? 'Error' : 'Passed'}Label" title="${title}">${title}</span>
      <span class="nsa-issue-section-count">(${items.length})</span>
    `;

    const issueList = document.createElement('div');
    issueList.className = 'nsa-issue-list';

    // Group items by their rule/description
    const groupedItems = this.groupItemsByRule(items);
    
    Object.entries(groupedItems).forEach(([ruleKey, ruleItems]) => {
      const issueItem = this.createIssueNodeGroup(ruleKey, ruleItems, type);
      issueList.appendChild(issueItem);
    });

    section.appendChild(sectionTitle);
    section.appendChild(issueList);
    return section;
  }

  groupItemsByRule(items) {
    const groups = {};
    items.forEach((item, index) => {
      const ruleKey = item.id || item.description || `rule-${index}`;
      if (!groups[ruleKey]) {
        groups[ruleKey] = [];
      }
      groups[ruleKey].push(item);
    });
    return groups;
  }

  createIssueNodeGroup(ruleKey, items, type) {
    const group = document.createElement('div');
    group.className = `nsa-issue-item nsa-impact-${items[0].impact || 'passed'} nsa-issue-node-group`;
    group.setAttribute('data-group-id', `issue-group-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'nsa-issue-header nsa-issue-node-group__header';
    header.setAttribute('aria-label', items[0].description);
    header.setAttribute('aria-expanded', 'false');
    
    const impact = items[0].impact || 'passed';
    const impactText = impact === 'passed' ? 'Passed' : impact.charAt(0).toUpperCase() + impact.slice(1);
    
    header.innerHTML = `
      <div class="nsa-issue-header-content">
        <div class="nsa-issue-title">${items[0].description}</div>
        <span class="nsa-audit-stat nsa-impact-${impact}">
          ${impactText}
          ${items.length > 1 ? `<span class="nsa-issue-node-count">(${items.length})</span>` : ''}
        </span>
      </div>
      <span class="nsa-dropdown-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24">
          <g fill="currentColor">
            <path d="m4.464 6.05-.707.707L8 11l4.243-4.243-.707-.707L8 9.586z"></path>
          </g>
        </svg>
      </span>
    `;

    const content = document.createElement('div');
    content.className = 'nsa-issue-node-group__content nsa-hidden';

    // Create node content for each item
    items.forEach((item, index) => {
      const nodeContent = this.createNodeContent(item, index, type);
      content.appendChild(nodeContent);
    });

    // Add navigation if multiple items
    if (items.length > 1) {
      const navigation = this.createNodeNavigation(items.length);
      content.appendChild(navigation);
    }

    group.appendChild(header);
    group.appendChild(content);

    header.addEventListener('click', () => {
      this.toggleIssueNodeGroup(group);
    });

    return group;
  }

  createNodeContent(item, index, type) {
    const nodeContent = document.createElement('div');
    nodeContent.className = `nsa-node-content ${index === 0 ? 'active' : ''}`;
    nodeContent.setAttribute('data-issue-index', index);

    // Issue actions
    const actions = document.createElement('div');
    actions.className = 'nsa-issue-actions';
    
    if (type === 'errors') {
      actions.innerHTML = `
        <button class="nsa-issue-button nsa-highlight-button" data-selector="${item.selector || ''}" data-issue-index="${index}" data-issue-title="${index}" aria-label="Highlight">
          <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
            <path fill="currentColor" d="M11.5 2h-7a.5.5 0 0 0-.5.5V10a1 1 0 0 0 1 1h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 0 0 1-1V2.5a.5.5 0 0 0-.5-.5zM5 9V3h1v3h1V3h1v2h1V3h2v6H5z"></path>
          </svg>
        </button>
        <button class="nsa-issue-button nsa-ai-solution-button" data-selector="${item.selector || ''}" data-issue-index="${index}" aria-label="Get AI solution">
          <svg viewBox="0 0 28.01 24.66" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M24.41 10.01l-4.11.1c-3.87.1-7.34-2.36-8.54-6.03L10.48.17c-.09-.27-.48-.2-.48.08l.1 4.11c.1 3.87-2.36 7.34-6.03 8.54l-3.9 1.28c-.27.09-.2.48.08.48l4.11-.1c3.87-.1 7.34 2.36 8.54 6.03l1.27 3.91c.09.27.48.2.48-.08l-.1-4.11a8.752 8.752 0 016.03-8.54l3.91-1.27c.27-.09.2-.48-.08-.48z"></path>
            <path d="M22.42 22.66a4.088 4.088 0 014.46-2.02l.83.18c.27.06.42-.32.17-.45l-.75-.41a4.088 4.088 0 01-2.02-4.46l.18-.83c.06-.27-.32-.42-.45-.17l-.41.75a4.088 4.088 0 01-4.46 2.02l-.83-.18c-.27-.06-.42.32-.17.45l.75.41c1.59.88 2.41 2.69 2.02 4.46l-.18.83c-.06.27.32.42.45.17l.41-.75zM18.91 5.57c1.07-.7 2.47-.61 3.44.21.21.18.51-.08.36-.32-.7-1.07-.61-2.47.21-3.44.18-.21-.08-.51-.32-.36-1.07.7-2.47.61-3.44-.21-.21-.18-.51.08-.36.32.7 1.07.61 2.47-.21 3.44-.18.21.08.51.32.36z"></path>
          </svg>
        </button>
      `;
    }

    // Source code
    const sourceCode = document.createElement('strong');
    sourceCode.className = 'nsa-issue-code nsa-issue-label';
    sourceCode.textContent = `Source: ${item.id || 'unknown'}`;

    // Issue context (code preview)
    const context = document.createElement('div');
    context.className = 'nsa-issue-context';
    context.innerHTML = `
      <div class="nsa-issue-code-preview">
        <div class="nsa-code-editor">
          <div class="nsa-code-line-numbers"><span class="nsa-code-line-number">1</span></div>
          <div class="nsa-code-content">
            <span class="nsa-code-line">
              <span class="nsa-code-entity">&lt;</span>
              <span class="nsa-code-tag">${item.tag || 'element'}</span>
              ${item.attributes ? item.attributes.map(attr => ` ${attr.name}=<span class="nsa-code-entity">"</span>${attr.value}<span class="nsa-code-entity">"</span>`).join('') : ''}
              <span class="nsa-code-entity">&gt;</span>
            </span>
          </div>
        </div>
      </div>
    `;

    // Issue message container
    const messageContainer = document.createElement('div');
    messageContainer.className = 'nsa-issue-message-container';
    messageContainer.innerHTML = `
      <p role="heading" class="nsa-issue-label" aria-level="2">Regelbeschreibung:</p>
      <div class="nsa-audit-content">
        <p>${item.description}</p>
        ${item.help ? `<p>${item.help}</p>` : ''}
      </div>
    `;

    // Issue fix container
    const fixContainer = document.createElement('div');
    fixContainer.className = 'nsa-issue-fix-container';
    fixContainer.innerHTML = `
      <p role="heading" class="nsa-issue-label" aria-level="2">So beheben Sie das Problem:</p>
      <div class="nsa-audit-content">
        <p>${item.fix || 'Bitte implementieren Sie die entsprechenden Korrekturen basierend auf den WCAG-Richtlinien.'}</p>
      </div>
    `;

    // Compliance container
    const complianceContainer = document.createElement('div');
    complianceContainer.className = 'nsa-issue-compliance-container';
    complianceContainer.innerHTML = `
      <p role="heading" class="nsa-issue-label" aria-level="2">Betroffene Behinderungen:</p>
      <ul>
        <li><span class="nsa-icon blind" aria-hidden="true"></span>Blind</li>
        <li><span class="nsa-icon deafblind" aria-hidden="true"></span>Taubblind</li>
        ${item.impact === 'serious' ? '<li><span class="nsa-icon mobility" aria-hidden="true"></span>Mobilität</li>' : ''}
      </ul>
    `;

    // WCAG container
    const wcagContainer = document.createElement('div');
    wcagContainer.className = 'nsa-issue-wcag-container';
    wcagContainer.innerHTML = `
      <span class="nsa-issue-label" data-nsalabel="nsaWcagReferencesLabel" title="WCAG Referenzen">WCAG Referenzen</span>
      <ul class="nsa-issue-wcag">
        <li><span data-nsalabel="nsaWcagCriterionLabel">Criterion:</span> ${item.wcagCriterion || 'N/A'}</li>
        <li><span data-nsalabel="nsaWcagDescriptionLabel">Description:</span> ${item.wcagDescription || item.description}</li>
        <li><span data-nsalabel="nsaWcagLevelLabel">Level:</span> ${item.wcagLevel || 'A'}</li>
        <li><span data-nsalabel="nsaWcagUrlLabel">URL:</span> <a href="${item.helpUrl || '#'}" target="_blank" data-nsalabel="nsaWcagUrlText">WCAG Url</a></li>
      </ul>
    `;

    // Tags container
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'nsa-issue-tags-container';
    const tags = item.tags || ['cat.name-role-value', 'wcag2a', 'wcag412'];
    tagsContainer.innerHTML = `
      <span class="nsa-issue-label" data-nsalabel="nsaTagsLabel" title="Tags">Tags</span>
      <div class="nsa-issue-tags">
        ${tags.map(tag => `<span class="nsa-tag">${tag}</span>`).join('')}
      </div>
    `;

    nodeContent.appendChild(actions);
    nodeContent.appendChild(sourceCode);
    nodeContent.appendChild(context);
    nodeContent.appendChild(messageContainer);
    nodeContent.appendChild(fixContainer);
    nodeContent.appendChild(complianceContainer);
    nodeContent.appendChild(wcagContainer);
    nodeContent.appendChild(tagsContainer);

    return nodeContent;
  }

  createNodeNavigation(totalItems) {
    const navigation = document.createElement('div');
    navigation.className = 'nsa-node-navigation nsa-tooltip-nav--visible';
    navigation.innerHTML = `
      <button type="button" aria-label="Previous issue" class="nsa-node-navigation__button nsa-node-prev">
        <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="20" height="20">
          <path fill="currentColor" d="M10.5 12.5L5.5 8l5-4.5z"></path>
        </svg>
      </button>
      <div class="nsa-tooltip-counter">
        <span class="nsa-node-current">1</span> /
        <span class="nsa-node-total">${totalItems}</span>
      </div>
      <button type="button" aria-label="Next issue" class="nsa-node-navigation__button nsa-node-next">
        <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="20" height="20">
          <path fill="currentColor" d="M5.5 12.5L10.5 8l-5-4.5z"></path>
        </svg>
      </button>
    `;
    return navigation;
  }

  toggleIssueNodeGroup(group) {
    const content = group.querySelector('.nsa-issue-node-group__content');
    const arrow = group.querySelector('.nsa-dropdown-arrow');
    const header = group.querySelector('.nsa-issue-node-group__header');
    
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      content.classList.add('nsa-hidden');
      header.setAttribute('aria-expanded', 'false');
      arrow.style.transform = 'rotate(0deg)';
    } else {
      content.classList.remove('nsa-hidden');
      header.setAttribute('aria-expanded', 'true');
      arrow.style.transform = 'rotate(180deg)';
    }
  }

  createViolationItem(violation, index) {
    const violationItem = document.createElement('div');
    violationItem.className = 'nsa-issue-item';
    
    const issueHeader = document.createElement('button');
    issueHeader.className = 'nsa-issue-header';
    issueHeader.setAttribute('aria-expanded', 'false');
    issueHeader.innerHTML = `
      <div class="nsa-issue-header-content">
        <div class="nsa-issue-icon nsa-issue-icon--${violation.impact}">
          ${violation.impact === 'critical' ? '⚠️' : violation.impact === 'serious' ? '⚠️' : violation.impact === 'moderate' ? '⚠️' : '✅'}
        </div>
        <div class="nsa-issue-title">${violation.description}</div>
      </div>
      <div class="nsa-issue-count">${violation.nodes ? violation.nodes.length : 1}</div>
      <div class="nsa-dropdown-arrow">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    const issueContent = document.createElement('div');
    issueContent.className = 'nsa-issue-content nsa-hidden';
    issueContent.innerHTML = `
      <div class="nsa-issue-details">
        <div class="nsa-issue-description">
          <p><strong>Beschreibung:</strong> ${violation.description}</p>
          <p><strong>Hilfe:</strong> ${violation.help}</p>
          <p><strong>Kategorie:</strong> ${violation.category}</p>
          <p><strong>Auswirkung:</strong> ${violation.impact}</p>
        </div>
        <div class="nsa-issue-actions">
          <button class="nsa-issue-button nsa-issue-highlight" data-violation-index="${index}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" stroke-width="2"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5C16.478 5 20.268 7.943 21.542 12C20.268 16.057 16.478 19 12 19C7.523 19 3.732 16.057 2.458 12Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            Hervorheben
          </button>
          <a href="${violation.helpUrl}" target="_blank" class="nsa-issue-button nsa-issue-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13V19C18 20.1046 17.1046 21 16 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Mehr erfahren
          </a>
        </div>
      </div>
    `;

    violationItem.appendChild(issueHeader);
    violationItem.appendChild(issueContent);

    const highlightBtn = violationItem.querySelector('.nsa-issue-highlight');
    highlightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.highlightViolation(violation);
    });

    issueHeader.addEventListener('click', () => {
      this.toggleIssue(violationItem);
    });

    return violationItem;
  }

  createPassItem(pass, index) {
    const passItem = document.createElement('div');
    passItem.className = 'nsa-issue-item nsa-issue-item--passed';
    
    const issueHeader = document.createElement('button');
    issueHeader.className = 'nsa-issue-header';
    issueHeader.setAttribute('aria-expanded', 'false');
    issueHeader.innerHTML = `
      <div class="nsa-issue-header-content">
        <div class="nsa-issue-icon nsa-issue-icon--passed">
          ✅
        </div>
        <div class="nsa-issue-title">${pass.description}</div>
      </div>
      <div class="nsa-issue-count">1</div>
      <div class="nsa-dropdown-arrow">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    const issueContent = document.createElement('div');
    issueContent.className = 'nsa-issue-content nsa-hidden';
    issueContent.innerHTML = `
      <div class="nsa-issue-details">
        <div class="nsa-issue-description">
          <p><strong>Beschreibung:</strong> ${pass.description}</p>
          <p><strong>Kategorie:</strong> ${pass.category}</p>
          <p><strong>Status:</strong> Bestanden</p>
        </div>
      </div>
    `;

    passItem.appendChild(issueHeader);
    passItem.appendChild(issueContent);

    issueHeader.addEventListener('click', () => {
      this.toggleIssue(passItem);
    });

    return passItem;
  }

  toggleCategory(categoryItem) {
    const content = categoryItem.querySelector('.nsa-category-content');
    const arrow = categoryItem.querySelector('.nsa-dropdown-arrow');
    const header = categoryItem.querySelector('.nsa-category-toggle');
    
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      content.classList.add('nsa-hidden');
      header.setAttribute('aria-expanded', 'false');
      arrow.style.transform = 'rotate(0deg)';
    } else {
      content.classList.remove('nsa-hidden');
      header.setAttribute('aria-expanded', 'true');
      arrow.style.transform = 'rotate(180deg)';
    }
  }

  toggleIssue(issueItem) {
    const content = issueItem.querySelector('.nsa-issue-content');
    const arrow = issueItem.querySelector('.nsa-dropdown-arrow');
    const header = issueItem.querySelector('.nsa-issue-header');
    
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      content.classList.add('nsa-hidden');
      header.setAttribute('aria-expanded', 'false');
      arrow.style.transform = 'rotate(0deg)';
    } else {
      content.classList.remove('nsa-hidden');
      header.setAttribute('aria-expanded', 'true');
      arrow.style.transform = 'rotate(180deg)';
    }
  }

  toggleExpandAll() {
    const expandBtn = document.getElementById('nsaExpandToggleBtn');
    const expandText = expandBtn.querySelector('.nsa-expand-toggle-text');
    const expandIcon = expandBtn.querySelector('.nsa-expand-toggle-icon');
    const categoryItems = document.querySelectorAll('.nsa-category-item');
    
    this.isExpanded = !this.isExpanded;
    
    categoryItems.forEach(item => {
      const content = item.querySelector('.nsa-category-content');
      const arrow = item.querySelector('.nsa-dropdown-arrow');
      const header = item.querySelector('.nsa-category-toggle');
      
      if (this.isExpanded) {
        content.classList.remove('nsa-hidden');
        header.setAttribute('aria-expanded', 'true');
        arrow.style.transform = 'rotate(180deg)';
      } else {
        content.classList.add('nsa-hidden');
        header.setAttribute('aria-expanded', 'false');
        arrow.style.transform = 'rotate(0deg)';
      }
    });
    
    expandText.textContent = this.isExpanded ? 'Alle einklappen' : 'Alle aufklappen';
    expandBtn.classList.toggle('expanded', this.isExpanded);
  }

  highlightViolation(violation) {
    chrome.runtime.sendMessage({
      action: 'highlightViolations',
      violations: [violation]
    });
  }

  updateLanguageUI() {
    const languageSelect = document.getElementById('nsaLanguageDropdown');
    if (languageSelect) {
      languageSelect.value = this.settings.language;
    }
  }

  updateStandardUI() {
    const standardSelect = document.getElementById('nsaStandardDropdown');
    if (standardSelect) {
      standardSelect.value = this.settings.standard;
    }
  }

  async changeLanguage(language) {
    try {
      this.settings.language = language;
      await chrome.storage.sync.set({ language: language });
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  }

  async changeStandard(standard) {
    try {
      this.settings.standard = standard;
      await chrome.storage.sync.set({ standard: standard });
    } catch (error) {
      console.error('Failed to change standard:', error);
    }
  }

  changeDisabilityFilter(disability) {
    // Implement disability filtering logic here
  }

  async toggleTheme() {
    try {
      this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
      await chrome.storage.sync.set({ theme: this.settings.theme });
      this.applyTheme();
    } catch (error) {
      console.error('Failed to toggle theme:', error);
    }
  }

  applyTheme() {
    const widget = document.getElementById('nsaAuditWidget');
    if (!widget) return;

    widget.classList.remove('nsa-audit-widget--dark', 'nsa-audit-widget--light');
    widget.classList.add(`nsa-audit-widget--${this.settings.theme}`);
  }

  async exportReport(format) {
    try {
      if (!chrome.tabs || !chrome.tabs.query) {
        throw new Error('Chrome tabs API not available');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      await chrome.runtime.sendMessage({
        action: 'exportReport',
        data: this.auditData,
        format: format
      });

    } catch (error) {
      console.error('Export failed:', error);
      this.showError('Failed to export report');
    }
  }

  shareReport() {
    if (navigator.share) {
      navigator.share({
        title: 'Accesstive Accessibility Report',
        text: `Found ${this.auditData.violations.length} accessibility issues`,
        url: window.location.href
      });
    } else {
      // Fallback to copying to clipboard
      const reportText = `Accesstive Accessibility Report\nFound ${this.auditData.violations.length} issues\nURL: ${window.location.href}`;
      navigator.clipboard.writeText(reportText);
    }
  }

  showLoader(show) {
    const loader = document.getElementById('nsaLoader');
    if (loader) {
      loader.classList.toggle('nsa-hidden', !show);
    }
  }

  showError(message) {
    console.error(message);
    // You could add an error display here
  }

  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePanel();
      }
    });
  }
}

// Initialize widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AccesstiveWidget();
});