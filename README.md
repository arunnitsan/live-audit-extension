# Accesstive - Live Audit Extension

A modern Chrome extension for real-time accessibility auditing built with **Vite + TypeScript** for maximum maintainability and developer experience.

## 🚀 Features

- **Real-time Accessibility Auditing**: Scan web pages for WCAG compliance issues
- **Interactive Widget Interface**: Modern, accessible widget design with dark/light themes
- **Multiple WCAG Standards**: Support for WCAG 2.0, 2.1, and 2.2 (A, AA, AAA levels)
- **Visual Highlighting**: Highlight accessibility issues directly on the page
- **Filtering & Categorization**: Filter by impact level, disability type, and WCAG standard
- **Export Reports**: Generate PDF reports and share accessibility findings
- **Keyboard Navigation**: Full keyboard accessibility support
- **Multi-language Support**: English and German language options
- **AI-Powered Solutions**: Get AI-generated fixes for accessibility issues

## 🛠️ Tech Stack

- **Vite** - Fast build tool and development server
- **TypeScript** - Type-safe JavaScript
- **SCSS** - Enhanced CSS with variables and mixins
- **Chrome Extension Manifest V3** - Latest extension architecture
- **ESLint** - Code linting and formatting
- **Modern ES2020+** - Latest JavaScript features

## 📁 Project Structure

```
live-audit-extension/
├── src/                          # Source code
│   ├── assets/                   # Static assets (fonts, icons, images)
│   │   ├── Fonts/               # Custom fonts
│   │   ├── icons/               # SVG icons
│   │   └── scss/                # SCSS stylesheets
│   ├── audit/                   # Core audit functionality
│   │   ├── nsaAudit.ts         # Main audit class
│   │   ├── nsaAuditTooltip.ts  # Tooltip management
│   │   ├── nsaAiSolution.ts    # AI solution integration
│   │   └── ...                 # Other audit modules
│   ├── background/              # Background service worker
│   ├── content/                 # Content scripts
│   ├── sidebar/                 # Sidebar widget
│   ├── options/                 # Options page
│   ├── types/                   # TypeScript type definitions
│   ├── background.ts           # Background entry point
│   ├── content.ts              # Content script entry point
│   ├── sidebar.ts              # Sidebar entry point
│   ├── options.ts              # Options page entry point
│   ├── sidebar.html            # Sidebar HTML
│   ├── sidebar.css             # Sidebar styles
│   ├── options.html            # Options page HTML
│   ├── options.css             # Options page styles
│   └── content.css             # Content script styles
├── dist/                        # Built extension (generated)
├── icons/                       # Extension icons
├── manifest.json               # Extension manifest
├── package.json                # Dependencies and scripts
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── .eslintrc.js                # ESLint configuration
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Chrome** 88+ (for Manifest V3 support)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd live-audit-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

### Development

1. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Build for production**
   ```bash
   npm run build
   # or
   yarn build
   ```

3. **Type checking**
   ```bash
   npm run type-check
   # or
   yarn type-check
   ```

4. **Linting**
   ```bash
   npm run lint
   # or
   yarn lint
   ```

### Loading the Extension

1. **Build the extension**
   ```bash
   npm run build
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `dist` folder

3. **Test the extension**
   - Click the Accesstive icon in the toolbar
   - The sidebar should open with the audit interface

## 🔧 Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production extension |
| `npm run build:watch` | Build with file watching |
| `npm run preview` | Preview built extension |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run clean` | Clean build directory |
| `npm run package` | Build and create zip package |

## 🏗️ Architecture

### Entry Points

- **`background.ts`** - Service worker for extension lifecycle
- **`content.ts`** - Content script for page interaction
- **`sidebar.ts`** - Sidebar widget interface
- **`options.ts`** - Extension options page
- **`audit/main.ts`** - Main audit functionality

### Key Classes

- **`AccesstiveBackground`** - Background service worker management
- **`AccesstiveContentScript`** - Content script functionality
- **`AccesstiveSidebarWidget`** - Sidebar widget management
- **`NsaAuditAccesstive`** - Core audit functionality
- **`NsaTooltipManager`** - Tooltip system management
- **`NsaAiSolutionManager`** - AI solution integration

### Build Process

1. **TypeScript Compilation** - Type checking and compilation
2. **Vite Bundling** - Module bundling and optimization
3. **Asset Processing** - SCSS compilation, asset copying
4. **Manifest Processing** - Extension manifest generation
5. **Output Generation** - Chrome extension ready files

## 🎨 Styling

The extension uses **SCSS** for styling with a modular approach:

- **`_variables.scss`** - Color variables and constants
- **`_mixins.scss`** - Reusable SCSS mixins
- **`_typography.scss`** - Font and text styling
- **`_audit.scss`** - Main audit interface styles
- **`_button.scss`** - Button component styles
- **`_tooltip.scss`** - Tooltip system styles

## 🔌 API Integration

The extension integrates with the Accesstive API for:

- **Audit Data** - Fetching accessibility audit results
- **AI Solutions** - Getting AI-generated fixes
- **Report Generation** - Creating PDF reports
- **Settings Sync** - Synchronizing user preferences

## 🧪 Testing

### Manual Testing

1. **Load the extension** in Chrome
2. **Navigate to different websites**
3. **Test the sidebar functionality**
4. **Verify tooltip behavior**
5. **Check keyboard navigation**
6. **Test theme switching**

### Automated Testing

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Build verification
npm run build
```

## 📦 Building for Production

1. **Set production environment**
   ```bash
   export NODE_ENV=production
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Package for distribution**
   ```bash
   npm run package
   ```

4. **Upload to Chrome Web Store**
   - Use the generated `accesstive-extension.zip`
   - Follow Chrome Web Store guidelines

## 🚀 Deployment

### Chrome Web Store

1. **Prepare for submission**
   - Update version in `manifest.json`
   - Update `package.json` version
   - Run `npm run package`

2. **Submit to Chrome Web Store**
   - Upload the generated zip file
   - Fill out store listing details
   - Submit for review

### Manual Distribution

1. **Build the extension**
   ```bash
   npm run build
   ```

2. **Share the `dist` folder**
   - Users can load it as an unpacked extension
   - Or you can create a zip of the `dist` folder

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
VITE_API_URL=https://api.accesstive.org
VITE_API_KEY=your_api_key_here
VITE_DEV_MODE=true
VITE_DEBUG_MODE=false
```

### Vite Configuration

The `vite.config.ts` file contains:

- **Entry points** for all extension parts
- **Asset handling** for fonts, icons, and images
- **Build optimization** for Chrome extensions
- **Path aliases** for clean imports

### TypeScript Configuration

The `tsconfig.json` includes:

- **Modern ES2020** target
- **Strict type checking**
- **Path mapping** for clean imports
- **Chrome extension types**

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow TypeScript best practices
   - Add proper type definitions
   - Update documentation

4. **Test your changes**
   ```bash
   npm run type-check
   npm run lint
   npm run build
   ```

5. **Submit a pull request**

## 📝 License

This project is part of the Accesstive accessibility platform.

## 🆘 Support

- **Documentation**: [Accesstive Docs](https://accesstive.com/docs)
- **Issues**: [GitHub Issues](https://github.com/accesstive/audit-extension/issues)
- **Website**: [Accesstive.com](https://accesstive.com)

---

Built with ❤️ using Vite + TypeScript for maximum maintainability and developer experience.