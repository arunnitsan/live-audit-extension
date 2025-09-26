# Accesstive - Live Audit Extension

A Chrome extension for real-time accessibility auditing using the Accesstive widget design.

## Features

- **Real-time Accessibility Auditing**: Scan web pages for WCAG compliance issues
- **Interactive Widget Interface**: Modern, accessible widget design with dark/light themes
- **Multiple WCAG Standards**: Support for WCAG 2.0, 2.1, and 2.2 (A, AA, AAA levels)
- **Visual Highlighting**: Highlight accessibility issues directly on the page
- **Filtering & Categorization**: Filter by impact level, disability type, and WCAG standard
- **Export Reports**: Generate PDF reports and share accessibility findings
- **Keyboard Navigation**: Full keyboard accessibility support
- **Multi-language Support**: English and German language options

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `live-audit-extension` folder
5. The extension will appear in your Chrome toolbar

## Usage

1. **Open the Widget**: Click the Accesstive icon in your Chrome toolbar
2. **Start Scanning**: The widget will automatically start scanning the current page
3. **Review Issues**: Browse through categorized accessibility issues
4. **Highlight Problems**: Click "Highlight" on any issue to see it on the page
5. **Filter Results**: Use the impact filters and standard dropdown to focus on specific issues
6. **Export Reports**: Generate PDF reports or share findings

## Widget Interface

The extension uses the official Accesstive widget design with:

- **Toggle Button**: Shows issue count and opens/closes the audit panel
- **Audit Panel**: Main interface with filters, results, and controls
- **Impact Filters**: Filter by Critical, Serious, Moderate, Minor, Passed, and Best Practice
- **WCAG Standards**: Choose from various WCAG versions and levels
- **Theme Toggle**: Switch between dark and light themes
- **Language Selection**: Choose between English and German
- **Export Options**: Generate PDF reports and share links

## Technical Details

- **Manifest V3**: Uses the latest Chrome extension architecture
- **Content Scripts**: Injects accessibility auditing into web pages
- **Background Service Worker**: Handles extension-wide functionality
- **Chrome Storage API**: Saves settings and audit results
- **Real-time Highlighting**: Visual overlay system for issue identification

## Files Structure

```
live-audit-extension/
├── manifest.json          # Extension configuration
├── popup.html             # Widget HTML structure
├── popup.css              # Widget styling
├── popup.js               # Widget functionality
├── content.js             # Page auditing script
├── content.css            # Content script styles
├── background.js          # Service worker
├── options.html           # Extension options page
├── options.css            # Options page styles
├── options.js             # Options page functionality
└── README.md              # This file
```

## Development

The extension is built with modern web technologies:

- **HTML5**: Semantic markup with ARIA attributes
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **JavaScript ES6+**: Modern JavaScript with classes and async/await
- **Chrome Extension APIs**: Manifest V3 with service workers

## Browser Support

- Chrome 88+ (Manifest V3 support required)
- Other Chromium-based browsers (Edge, Brave, etc.)

## License

This project is part of the Accesstive accessibility platform.