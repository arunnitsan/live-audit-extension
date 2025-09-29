import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AccessibilityIssue, AuditData, GroupedData } from './nsaAudit';
import { impactLabels } from './nsaTemplates';
import { nsaAuditResultStorage } from './nsaStorageHelper';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface PdfOptions {
  title?: string;
  url?: string;
  date?: string;
  language?: string;
  userInfo?: { name: string; email: string };
}

export class NsaPdfGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private readonly pageWidth: number;
  private readonly pageHeight: number;
  private currentLanguage: string = 'en';
  private translations: Record<string, string> = {};

  // Constants
  private readonly config = {
    margin: 20,
    normalFontSize: 10,
    smallFontSize: 9,
    spacing: { xs: 4, s: 6, m: 10, l: 15, xl: 20 },
    colors: {
      primary: [25, 118, 210] as [number, number, number],
      error: [211, 47, 47] as [number, number, number],
      warning: [255, 152, 0] as [number, number, number],
      notice: [97, 97, 97] as [number, number, number],
      passed: [76, 175, 80] as [number, number, number],
      gray: [100, 100, 100] as [number, number, number]
    }
  };

  constructor(options: PdfOptions = {}) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', putOnlyUsedFonts: true, floatPrecision: 16 });
    (this.doc as any).autoTable = autoTable;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();

    this.currentLanguage = this.detectLanguage(options.language);
    this.translations = this.getTranslations(this.currentLanguage);
    this.generatePdfContent(options);
  }

  private detectLanguage(providedLanguage?: string): string {
    if (providedLanguage) return providedLanguage;

    try {
      const languageDropdown = document.querySelector('#nsaLanguageDropdown') as HTMLSelectElement;
      if (languageDropdown?.value) return languageDropdown.value;

      const allSelects = document.querySelectorAll('select');
      for (const select of allSelects) {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && (selectedOption.textContent === 'DE' || selectedOption.value === 'de')) return 'de';
      }

      if (navigator.language.split('-')[0] === 'de') return 'de';
    } catch (error) {
      // Silently handle errors
    }

    return 'en';
  }

  private getTranslations(language: string): Record<string, string> {
    const labels = {
      en: {
        cover: ['Accesstive Live Audit', 'Human-First Accessibility Meets AI', 'Project Information', 'Website', 'Audit Date', 'Report Version', 'Generated', 'WCAG 2.1 AA Compliance • Automated Testing • Accessibility Standards', 'Prepared for', 'Report ID', 'Powered by Accesstive - Fix issues with Access Monitor'],
        executive: ['Executive Summary', 'This accessibility audit evaluates your website\'s compliance with WCAG 2.1 guidelines and relevant accessibility standards.', 'Total Issues Found', 'Critical Issues', 'Major Issues', 'Minor Issues', 'Compliance Score', 'What This Means:', '• Your website has accessibility barriers that may prevent users with disabilities from accessing content', '• Addressing these issues improves user experience for all visitors and ensures legal compliance', '• WCAG 2.1 compliance helps meet ADA, Section 508, and EN 301 549 requirements'],
        findings: ['Audit Findings Overview', 'Category', 'Issues Found', 'Severity', 'WCAG Ref.', 'Critical', 'Major', 'Minor', 'No issues found'],
        detailed: ['Detailed Findings', '#', 'Issue', 'Impact', 'Selector'],
        nextSteps: ['Next Steps & Recommendations', 'How to Fix These Issues', '1. Prioritize Critical Issues: Start with the most severe accessibility barriers', '2. Use Automated Tools: Leverage Accesstive AI for quick fixes where possible', '3. Manual Review: Some issues require human judgment and testing', '4. Regular Monitoring: Implement ongoing accessibility testing', 'Fix Accessibility Issues Faster with Accesstive', 'Start your free trial with Access Monitor to automatically detect and fix accessibility issues.', 'Contact: support@accesstive.org | Visit: accesstive.com'],
        errors: ['PDF Generation Error', 'An error occurred while generating the PDF report.', 'Please try again or contact support if the issue persists.', 'No Accessibility Issues Found', 'The audit did not find any accessibility issues to report.'],
        footer: ['Page {current} of {total}', 'Powered by Accesstive - Fix issues with Access Monitor']
      },
      de: {
        cover: ['Accesstive Live-Audit', 'Mensch-zentrierte Barrierefreiheit trifft auf KI', 'Projektinformationen', 'Website', 'Audit-Datum', 'Berichtsversion', 'Generiert', 'WCAG 2.1 AA-Konformität • Automatisierte Tests • Barrierefreiheitsstandards', 'Erstellt für', 'Berichts-ID', 'Powered by Accesstive - Probleme mit Access Monitor beheben'],
        executive: ['Zusammenfassung', 'Dieses Barrierefreiheits-Audit bewertet die Einhaltung der WCAG 2.1-Richtlinien und relevanter Barrierefreiheitsstandards auf Ihrer Website.', 'Gefundene Probleme', 'Kritische Probleme', 'Hauptprobleme', 'Nebenprobleme', 'Konformitätsbewertung', 'Was das bedeutet:', '• Ihre Website hat Barrierefreiheitshindernisse, die Benutzer mit Behinderungen am Zugang zu Inhalten hindern können', '• Die Behebung dieser Probleme verbessert die Benutzererfahrung für alle Besucher und gewährleistet die rechtliche Compliance', '• WCAG 2.1-Konformität hilft bei der Einhaltung von ADA, Section 508 und EN 301 549'],
        findings: ['Audit-Ergebnisse Übersicht', 'Kategorie', 'Gefundene Probleme', 'Schweregrad', 'WCAG-Ref.', 'Kritisch', 'Haupt', 'Neben', 'Keine Probleme gefunden'],
        detailed: ['Detaillierte Ergebnisse', '#', 'Problem', 'Auswirkung', 'Selektor'],
        nextSteps: ['Nächste Schritte & Empfehlungen', 'So beheben Sie diese Probleme', '1. Priorisieren Sie kritische Probleme: Beginnen Sie mit den schwerwiegendsten Barrierefreiheitshindernissen', '2. Verwenden Sie automatisierte Tools: Nutzen Sie Accesstive KI für schnelle Behebungen wo möglich', '3. Manuelle Überprüfung: Einige Probleme erfordern menschliche Beurteilung und Tests', '4. Regelmäßige Überwachung: Implementieren Sie kontinuierliche Barrierefreiheitstests', 'Beheben Sie Barrierefreiheitsprobleme schneller mit Accesstive', 'Starten Sie Ihre kostenlose Testversion mit Access Monitor, um automatisch Barrierefreiheitsprobleme zu erkennen und zu beheben.', 'Kontakt: support@accesstive.org | Besuchen: accesstive.com'],
        errors: ['PDF-Generierungsfehler', 'Ein Fehler ist beim Generieren des PDF-Berichts aufgetreten.', 'Bitte versuchen Sie es erneut oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.', 'Keine Barrierefreiheitsprobleme gefunden', 'Das Audit hat keine Barrierefreiheitsprobleme zu melden gefunden.'],
        footer: ['Seite {current} von {total}', 'Powered by Accesstive – Probleme mit Access Monitor beheben']
      }
    };

    const lang = labels[language as keyof typeof labels] || labels.en;
    const keys = ['cover', 'executive', 'findings', 'detailed', 'nextSteps', 'errors', 'footer'];
    const keyMap = ['nsaPdfCover', 'nsaPdfExecutive', 'nsaPdfFindings', 'nsaPdfDetailed', 'nsaPdfNextSteps', 'nsaPdfError', 'nsaPdfFooter'];
    const subKeys = [
      ['Title', 'Subtitle', 'ProjectInfo', 'Website', 'AuditDate', 'ReportVersion', 'Generated', 'Standards', 'PreparedFor', 'ReportId', 'FooterCta'],
      ['Title', 'Intro', 'TotalIssues', 'CriticalIssues', 'MajorIssues', 'MinorIssues', 'ComplianceScore', 'WhatThisMeans', 'Bullet1', 'Bullet2', 'Bullet3'],
      ['Title', 'Category', 'IssuesFound', 'Severity', 'WcagRef', 'Critical', 'Major', 'Minor', 'NoIssues'],
      ['Title', 'Number', 'Issue', 'Impact', 'Selector'],
      ['Title', 'HowToFix', 'Step1', 'Step2', 'Step3', 'Step4', 'CtaTitle', 'CtaDescription', 'ContactInfo'],
      ['Title', 'Occurred', 'TryAgain', 'NoIssues', 'NoIssuesDescription'],
      ['PageOf', 'PoweredBy']
    ];

    const result: Record<string, string> = {};
    keys.forEach((key, i) => {
      lang[key as keyof typeof lang].forEach((text: string, j: number) => {
        result[keyMap[i] + subKeys[i][j]] = text;
      });
    });

    return result;
  }

  private t(key: string, params?: Record<string, string | number>): string {
    const translation = this.translations[key] || key;
    return params ? translation.replace(/\{(\w+)\}/g, (match, paramKey) => params[paramKey]?.toString() || match) : translation;
  }

  private setTextStyle(fontSize: number, fontStyle: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = [0, 0, 0]): void {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', fontStyle);
    this.doc.setTextColor(...color);
  }

  private addCenteredText(text: string, y: number, fontSize: number = this.config.normalFontSize): void {
    this.setTextStyle(fontSize);
    this.doc.text(text, this.pageWidth / 2, y, { align: 'center' });
  }

  private getImpactColor(impact: string): [number, number, number] {
    const colorMap: Record<string, [number, number, number]> = {
      critical: this.config.colors.error,
      serious: this.config.colors.error,
      moderate: this.config.colors.warning,
      minor: this.config.colors.notice,
      passed: this.config.colors.passed
    };
    return colorMap[impact] || [0, 0, 0];
  }

  private getComplianceScoreInfo(score: number) {
    const levels = [
      { min: 90, color: [76, 175, 80] as [number, number, number], bg: [232, 245, 233] as [number, number, number], status: { en: 'Excellent', de: 'Exzellent' } },
      { min: 75, color: [139, 195, 74] as [number, number, number], bg: [241, 248, 233] as [number, number, number], status: { en: 'Good', de: 'Gut' } },
      { min: 60, color: [255, 193, 7] as [number, number, number], bg: [255, 248, 225] as [number, number, number], status: { en: 'Fair', de: 'Befriedigend' } },
      { min: 40, color: [255, 152, 0] as [number, number, number], bg: [255, 243, 224] as [number, number, number], status: { en: 'Poor', de: 'Schlecht' } },
      { min: 0, color: [244, 67, 54] as [number, number, number], bg: [255, 235, 238] as [number, number, number], status: { en: 'Critical', de: 'Kritisch' } }
    ];

    const level = levels.find(l => score >= l.min) || levels[levels.length - 1];
    return {
      color: level.color,
      bgColor: level.bg,
      status: level.status[this.currentLanguage as keyof typeof level.status] || level.status.en
    };
  }

  private addComplianceScoreIndicator(score: number): void {
    const scoreInfo = this.getComplianceScoreInfo(score);
    const boxWidth = 60, boxHeight = 20;
    const boxX = (this.pageWidth - boxWidth) / 2;

    this.doc.setFillColor(...scoreInfo.bgColor);
    this.doc.roundedRect(boxX, this.currentY, boxWidth, boxHeight, 3, 3, 'F');
    this.doc.setDrawColor(...scoreInfo.color);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(boxX, this.currentY, boxWidth, boxHeight, 3, 3, 'S');

    this.setTextStyle(16, 'bold', scoreInfo.color);
    this.doc.text(`${score}%`, this.pageWidth / 2, this.currentY + 8, { align: 'center' });
    this.setTextStyle(10, 'normal', scoreInfo.color);
    this.doc.text(scoreInfo.status, this.pageWidth / 2, this.currentY + 15, { align: 'center' });

    this.currentY += boxHeight + this.config.spacing.m;
  }

  private generateVersion(): string {
    const now = new Date();
    return `v${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}`;
  }

  private generatePdfContent(options: PdfOptions): void {
    try {
      const data = nsaAuditResultStorage.loadSettings() as AuditData[];
      if (!data || !Array.isArray(data) || data.length === 0) {
        this.renderEmptyReport(options);
        return;
      }

      this.createCoverPage(options);
      this.createExecutiveSummary(data);
      this.createAuditFindingsOverview(data);
      this.createDetailedFindings(data);
      this.createNextStepsPage();
    } catch (error) {
      console.error('Error generating PDF content:', error);
      this.renderErrorReport(error);
    }
  }

  private createTable(data: string[][], headers?: string[], options: any = {}): void {
    const defaultOptions = {
      theme: 'grid',
      headStyles: { fillColor: this.config.colors.primary, textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: this.config.normalFontSize, cellPadding: 5, lineWidth: 0.1, overflow: 'linebreak' },
      margin: { left: this.config.margin, right: this.config.margin },
      didDrawPage: (data: any) => this.addFooterToPage(data),
      ...options
    };

    autoTable(this.doc, {
      startY: this.currentY,
      head: headers ? [headers] : undefined,
      body: data,
      ...defaultOptions
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + this.config.spacing.m;
  }

  private createCoverPage(options: PdfOptions): void {
    this.currentY = 50;

    try {
      const logoUrl = '/assets/images/accesstive.png';
      const logoHeight = 12, logoWidth = logoHeight * (811 / 114);
      this.doc.addImage(logoUrl, 'PNG', (this.pageWidth - logoWidth) / 2, this.currentY, logoWidth, logoHeight);
      this.currentY += logoHeight + 20;
    } catch (error) {
      this.currentY += 20;
    }

    this.addCenteredText(this.t('nsaPdfCoverTitle'), this.currentY, 24);
    this.currentY += this.config.spacing.m;
    this.addCenteredText(this.t('nsaPdfCoverSubtitle'), this.currentY, 16);
    this.currentY += this.config.spacing.xl;

    this.addCenteredText(this.t('nsaPdfCoverProjectInfo'), this.currentY, 14);
    this.currentY += this.config.spacing.m;

    const now = new Date();
    const projectData = [
      ...(options.url ? [[this.t('nsaPdfCoverWebsite'), options.url]] : []),
      [this.t('nsaPdfCoverAuditDate'), options.date || new Date().toLocaleDateString()],
      [this.t('nsaPdfCoverReportVersion'), this.generateVersion()],
      [this.t('nsaPdfCoverGenerated'), now.toLocaleString(this.currentLanguage === 'en' ? 'en-US' : 'de-DE', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      })],
      [this.t('nsaPdfCoverStandards'), 'WCAG 2.1 AA-Konformität • Automatisierte Tests • Barrierefreiheitsstandards'],
      ...(options.userInfo ? [[this.t('nsaPdfCoverPreparedFor'), `${options.userInfo.name} (${options.userInfo.email})`]] : []),
      [this.t('nsaPdfCoverReportId'), `RPT-${now.getTime().toString().slice(-8)}`]
    ];

    this.createTable(projectData, undefined, {
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60, halign: 'left' }, 1: { halign: 'left', cellWidth: 60 } },
      styles: { fontSize: 11, cellPadding: 6 },
      margin: { left: (this.pageWidth - 120) / 2, right: (this.pageWidth - 120) / 2 },
      tableWidth: 120
    });

    this.addFooterToPage({ pageNumber: 1 });
  }

  private createExecutiveSummary(data: AuditData[]): void {
    this.doc.addPage();
    this.currentY = 30;

    this.setTextStyle(18, 'bold', this.config.colors.primary);
    this.doc.text(this.t('nsaPdfExecutiveTitle'), this.config.margin, this.currentY);
    this.currentY += this.config.spacing.l;

    const introText = this.doc.splitTextToSize(this.t('nsaPdfExecutiveIntro'), this.pageWidth - (this.config.margin * 2));
    this.setTextStyle(12);
    this.doc.text(introText, this.config.margin, this.currentY);
    this.currentY += introText.length * 6 + this.config.spacing.l;

    const metrics = this.calculateAuditMetrics(data);
    const summaryData = [
      [this.t('nsaPdfExecutiveTotalIssues'), metrics.totalIssues.toString()],
      [this.t('nsaPdfExecutiveCriticalIssues'), metrics.critical.toString()],
      [this.t('nsaPdfExecutiveMajorIssues'), metrics.major.toString()],
      [this.t('nsaPdfExecutiveMinorIssues'), metrics.minor.toString()],
      [this.t('nsaPdfExecutiveComplianceScore'), `${metrics.complianceScore}%`]
    ];

    this.createTable(summaryData, undefined, {
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { halign: 'center', cellWidth: 40 } },
      styles: { valign: 'middle' },
      margin: { left: (this.pageWidth - 100) / 2, right: (this.pageWidth - 100) / 2 },
      tableWidth: 100,
      didParseCell: (data: any) => {
        if (data.column.index === 0 && data.row.index === 4) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 12;
        } else if (data.column.index === 1 && data.row.index === 4) {
          const scoreInfo = this.getComplianceScoreInfo(metrics.complianceScore);
          data.cell.styles.textColor = scoreInfo.color;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 14;
          data.cell.styles.fillColor = scoreInfo.bgColor;
          data.cell.text = [`${metrics.complianceScore}%`, scoreInfo.status];
        }
      }
    });

    this.addComplianceScoreIndicator(metrics.complianceScore);

    this.setTextStyle(12, 'bold');
    this.doc.text(this.t('nsaPdfExecutiveWhatThisMeans'), this.config.margin, this.currentY);
    this.currentY += this.config.spacing.m;

    this.setTextStyle(12);
    [this.t('nsaPdfExecutiveBullet1'), this.t('nsaPdfExecutiveBullet2'), this.t('nsaPdfExecutiveBullet3')].forEach((point) => {
      const splitText = this.doc.splitTextToSize(point, this.pageWidth - (this.config.margin * 2));
      this.doc.text(splitText, this.config.margin, this.currentY);
      this.currentY += splitText.length * 6 + this.config.spacing.s;
    });
  }

  private createAuditFindingsOverview(data: AuditData[]): void {
    this.doc.addPage();
    this.currentY = 30;

    this.setTextStyle(18, 'bold', this.config.colors.primary);
    this.doc.text(this.t('nsaPdfFindingsTitle'), this.config.margin, this.currentY);
    this.currentY += this.config.spacing.l;

    const findingsData = this.categorizeFindings(data);
    this.createTable(findingsData, [this.t('nsaPdfFindingsCategory'), this.t('nsaPdfFindingsIssuesFound'), this.t('nsaPdfFindingsSeverity'), this.t('nsaPdfFindingsWcagRef')], {
      columnStyles: { 0: { halign: 'left', cellWidth: 50 }, 1: { halign: 'center', cellWidth: 40 }, 2: { halign: 'center', cellWidth: 30 }, 3: { halign: 'center', cellWidth: 30 } },
      margin: { left: (this.pageWidth - 150) / 2, right: (this.pageWidth - 150) / 2 },
      tableWidth: 150,
      didParseCell: (data: any) => {
        if (data.column.index === 2 && data.row.index > 0) {
          const severity = Array.isArray(data.cell.raw) ? data.cell.raw[0] : String(data.cell.raw);
          const severityColors: Record<string, [number, number, number]> = {
            [this.t('nsaPdfFindingsCritical')]: this.config.colors.error,
            [this.t('nsaPdfFindingsMajor')]: this.config.colors.warning,
            [this.t('nsaPdfFindingsMinor')]: this.config.colors.notice
          };
          if (severityColors[severity]) {
            data.cell.styles.textColor = severityColors[severity];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
  }

  private createDetailedFindings(data: AuditData[]): void {
    this.doc.addPage();
    this.currentY = 30;

    this.setTextStyle(18, 'bold', this.config.colors.primary);
    this.doc.text(this.t('nsaPdfDetailedTitle'), this.config.margin, this.currentY);
    this.currentY += this.config.spacing.l;

    const issuesByType = this.groupIssuesByType(data);
    Object.entries(issuesByType).forEach(([issueType, issues]) => {
      if (issues.length === 0) return;

      this.setTextStyle(14, 'bold', this.config.colors.primary);
      this.doc.text(issueType, this.config.margin, this.currentY);
      this.currentY += this.config.spacing.s;

      const tableData = issues.map((issue, index) => ({
        '#': (index + 1).toString(),
        'Issue': issue.title,
        'Impact': impactLabels[issue.impact] || issue.impact,
        'Selector': issue.selector || 'N/A',
        impactColor: this.getImpactColor(issue.impact)
      }));

      this.createTable(tableData.map(row => [row['#'], row['Issue'], row['Impact'], row['Selector']]),
        [this.t('nsaPdfDetailedNumber'), this.t('nsaPdfDetailedIssue'), this.t('nsaPdfDetailedImpact'), this.t('nsaPdfDetailedSelector')], {
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { halign: 'left', cellWidth: 70 },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'left', cellWidth: 70, fontSize: this.config.smallFontSize, font: 'courier' }
        },
        styles: { cellPadding: 4 },
        margin: { left: 15, right: 15 },
        tableWidth: this.pageWidth - 30,
        didParseCell: (data: any) => {
          if (data.column.index === 2 && data.row.index > 0) {
            const issueIndex = data.row.index - 1;
            if (issueIndex < tableData.length) {
              data.cell.styles.textColor = tableData[issueIndex].impactColor;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
    });
  }

  private createNextStepsPage(): void {
    this.doc.addPage();
    this.currentY = 30;

    this.setTextStyle(18, 'bold', this.config.colors.primary);
    this.doc.text(this.t('nsaPdfNextStepsTitle'), this.config.margin, this.currentY);
    this.currentY += this.config.spacing.l;

    this.setTextStyle(14, 'bold');
    this.doc.text(this.t('nsaPdfNextStepsHowToFix'), this.config.margin, this.currentY);
    this.currentY += this.config.spacing.s;

    this.setTextStyle(12);
    [this.t('nsaPdfNextStepsStep1'), this.t('nsaPdfNextStepsStep2'), this.t('nsaPdfNextStepsStep3'), this.t('nsaPdfNextStepsStep4')].forEach((point) => {
      const splitText = this.doc.splitTextToSize(point, this.pageWidth - (this.config.margin * 2));
      this.doc.text(splitText, this.config.margin, this.currentY);
      this.currentY += splitText.length * 6 + this.config.spacing.s;
    });

    this.setTextStyle(16, 'bold', this.config.colors.primary);
    this.doc.text(this.t('nsaPdfNextStepsCtaTitle'), this.config.margin, this.currentY);
    this.currentY += this.config.spacing.m;

    this.setTextStyle(12);
    this.doc.text(this.t('nsaPdfNextStepsCtaDescription'), this.config.margin, this.currentY);

    this.setTextStyle(10, 'normal', this.config.colors.gray);
    this.doc.text(this.t('nsaPdfNextStepsContactInfo'), this.config.margin, this.pageHeight - 30);

    this.addFooterToPage({ pageNumber: this.doc.getNumberOfPages() });
  }

  private addFooterToPage(data: any): void {
    const pageCount = this.doc.getNumberOfPages();
    const currentPage = data.pageNumber;
    this.setTextStyle(this.config.smallFontSize, 'normal', this.config.colors.gray);
    this.doc.text(this.t('nsaPdfFooterPageOf', { current: currentPage, total: pageCount }), this.pageWidth - 30, this.pageHeight - 10);
    this.setTextStyle(8, 'italic', this.config.colors.gray);
    this.doc.text(this.t('nsaPdfFooterPoweredBy'), this.pageWidth / 2, this.pageHeight - 5, { align: 'center' });
  }

  private renderErrorReport(_error: any): void {
    this.addCenteredText(this.t('nsaPdfErrorTitle'), this.currentY, 14);
    this.currentY += 12;
    this.addCenteredText(this.t('nsaPdfErrorOccurred'), this.currentY, 10);
    this.currentY += 6;
    this.addCenteredText(this.t('nsaPdfErrorTryAgain'), this.currentY, 10);
  }

  private renderEmptyReport(options: PdfOptions): void {
    this.createCoverPage(options);
    this.addCenteredText(this.t('nsaPdfErrorNoIssues'), this.currentY, 14);
    this.currentY += 12;
    this.addCenteredText(this.t('nsaPdfErrorNoIssuesDescription'), this.currentY, 10);
  }

  private calculateAuditMetrics(data: AuditData[]): { totalIssues: number; critical: number; major: number; minor: number; complianceScore: number } {
    try {
      const statistics = data?.[0] as any;
      if (statistics?.statistics) {
        return {
          totalIssues: statistics.statistics.totalIssues || 0,
          critical: statistics.statistics.criticalIssues || statistics.statistics.seriousIssues || 0,
          major: statistics.statistics.moderateIssues || 0,
          minor: statistics.statistics.minorIssues || 0,
          complianceScore: statistics.statistics.scorePercentage || 0
        };
      }
    } catch (error) {
      // Fallback to calculation
    }

    let totalIssues = 0, critical = 0, major = 0, minor = 0;
    data.forEach(auditData => {
      Object.entries(auditData.grouped).forEach(([, categoryData]) => {
        ['errors', 'warnings', 'notices'].forEach(type => {
          const issues = (categoryData as GroupedData)[type as keyof GroupedData] || [];
          totalIssues += issues.length;
          issues.forEach((issue: AccessibilityIssue) => {
            const impactCounts: Record<string, () => void> = {
              critical: () => critical++,
              serious: () => critical++,
              moderate: () => major++,
              minor: () => minor++
            };
            impactCounts[issue.impact]?.();
          });
        });
      });
    });

    const complianceScore = totalIssues > 0 ? Math.max(0, 100 - (critical * 10 + major * 5 + minor * 2)) : 100;
    return { totalIssues, critical, major, minor, complianceScore: Math.round(complianceScore) };
  }

  private categorizeFindings(data: AuditData[]): string[][] {
    const categories: { [key: string]: { count: number; severity: string; wcagRef: string } } = {};

    data.forEach(auditData => {
      if (!auditData?.grouped) return;

      Object.entries(auditData.grouped).forEach(([category, categoryData]) => {
        const categoryName = this.mapCategoryToDisplayName(category);
        if (!categories[categoryName]) {
          categories[categoryName] = { count: 0, severity: this.t('nsaPdfFindingsMinor'), wcagRef: this.getWcagReference(category) };
        }

        ['errors', 'warnings', 'notices'].forEach(type => {
          const issues = (categoryData as GroupedData)[type as keyof GroupedData] || [];
          categories[categoryName].count += issues.length;
          if (type === 'errors' && issues.length > 0) {
            categories[categoryName].severity = this.t('nsaPdfFindingsCritical');
          } else if (type === 'warnings' && issues.length > 0 && categories[categoryName].severity !== this.t('nsaPdfFindingsCritical')) {
            categories[categoryName].severity = this.t('nsaPdfFindingsMajor');
          }
        });
      });
    });

    const results = Object.entries(categories)
      .filter(([, data]) => data.count > 0)
      .map(([category, data]) => [category, data.count.toString(), data.severity, data.wcagRef]);

    return results.length === 0 ? [[this.t('nsaPdfFindingsNoIssues'), '0', 'N/A', 'N/A']] : results;
  }

  private mapCategoryToDisplayName(category: string): string {
    const cleanCategory = category.toLowerCase().replace(/^cat\./, '');
    const categoryMap: Record<string, string> = {
      color: 'Contrast Errors', forms: 'Forms', keyboard: 'Keyboard Navigation', images: 'Alt Text Issues',
      headings: 'Headings', labels: 'Missing Labels', aria: 'ARIA Issues', navigation: 'Navigation',
      focus: 'Focus Management', semantics: 'Semantic HTML', text: 'Text Content', media: 'Media Content',
      layout: 'Layout Issues', interaction: 'User Interaction', 'name-role-value': 'Name, Role, Value',
      structure: 'Document Structure', 'text-alternatives': 'Text Alternatives', parsing: 'HTML Parsing',
      language: 'Language Declaration', 'sensory-and-visual-cues': 'Sensory & Visual Cues',
      'time-and-media': 'Time & Media', tables: 'Tables'
    };
    return categoryMap[cleanCategory] || cleanCategory.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  private getWcagReference(category: string): string {
    const cleanCategory = category.toLowerCase().replace(/^cat\./, '');
    const wcagMap: Record<string, string> = {
      color: '1.4.3', forms: '1.3.1, 3.3.2', keyboard: '2.1.1, 2.1.2', images: '1.1.1',
      headings: '1.3.1, 2.4.6', labels: '1.3.1, 3.3.2', aria: '4.1.2', navigation: '2.4.3, 2.4.5',
      focus: '2.4.7', semantics: '1.3.1, 4.1.2', text: '1.4.3, 1.4.4', media: '1.2.1, 1.2.2',
      layout: '1.4.10', interaction: '2.1.1, 2.1.2', 'name-role-value': '4.1.2', structure: '1.3.1',
      'text-alternatives': '1.1.1', parsing: '4.1.1', language: '3.1.1', 'sensory-and-visual-cues': '1.3.3',
      'time-and-media': '2.2.1, 2.2.2', tables: '1.3.1'
    };
    return wcagMap[cleanCategory] || '2.1.1';
  }

  private groupIssuesByType(data: AuditData[]): { [key: string]: AccessibilityIssue[] } {
    const issuesByType: { [key: string]: AccessibilityIssue[] } = {};
    data.forEach(auditData => {
      Object.entries(auditData.grouped).forEach(([category, categoryData]) => {
        const typeName = this.mapCategoryToDisplayName(category);
        if (!issuesByType[typeName]) issuesByType[typeName] = [];
        ['errors', 'warnings', 'notices'].forEach(type => {
          const issues = (categoryData as GroupedData)[type as keyof GroupedData] || [];
          issuesByType[typeName].push(...issues);
        });
      });
    });
    return issuesByType;
  }

  public save(filename?: string): void {
    const finalFilename = filename || `accesstive-audit-report-${this.generateVersion()}-${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(finalFilename);
  }
}

export default NsaPdfGenerator;
