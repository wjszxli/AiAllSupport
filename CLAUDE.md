# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepSeekAllSupports is a Chrome browser extension that provides AI chat capabilities across multiple DeepSeek API providers. The extension supports various AI models and providers including DeepSeek official, SiliconFlow, Tencent Cloud, Baidu Cloud, Alibaba Cloud, and local models via Ollama.

## Development Commands

### Core Commands
- `pnpm start` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm test` - Run tests (currently aliases to build)
- `pnpm lint` - Run both ESLint and Stylelint
- `pnpm lint:es` - Run ESLint on TypeScript/TSX files
- `pnpm lint:style` - Run Stylelint on CSS/LESS/SCSS files
- `pnpm clean` - Remove build artifacts and distributions
- `pnpm reinstall` - Clean reinstall of dependencies

### Package Manager
- Uses **pnpm** exclusively (enforced by preinstall script)
- Node.js version: ^18.12.1

## Architecture Overview

### Browser Extension Structure
- **Manifest V3** Chrome extension
- **Content Scripts**: Injected into all web pages for AI interaction
- **Background Service Worker**: Handles extension lifecycle and API calls
- **Side Panel**: Dedicated chat interface in browser sidebar
- **Popup**: Quick access interface from extension icon
- **Options Page**: Configuration and settings

### Key Directories

#### `/src/`
- **`/chat/`** - Main chat interface components and logic
- **`/contents/`** - Content script implementations for web page integration
- **`/options/`** - Settings and configuration UI
- **`/popup/`** - Extension popup interface
- **`/sidepanel/`** - Side panel chat interface
- **`/background/`** - Background service worker scripts
- **`/services/`** - API communication and message handling
- **`/store/`** - State management using MobX
- **`/langchain/`** - LangChain integration for AI providers
- **`/config/`** - Model configurations and provider settings
- **`/locales/`** - Internationalization support

#### `/server/`
- Build system and development server configuration
- TypeScript compilation and webpack configuration

### Technology Stack

#### Frontend
- **React 18** with TypeScript
- **MobX** for state management
- **Ant Design** for UI components
- **SCSS/LESS** for styling
- **Webpack** for bundling

#### AI Integration
- **LangChain** for AI provider abstraction
- **OpenAI SDK** for OpenAI-compatible APIs
- **Custom providers** for DeepSeek, Anthropic, Google, etc.

#### Browser APIs
- **Chrome Extension APIs**: storage, declarativeNetRequest, contextMenus, commands, activeTab, scripting, sidePanel
- **WebExtension Polyfill** for cross-browser compatibility

### State Management
- **MobX stores** in `/src/store/`:
  - `MessageStore` - Chat messages and conversations
  - `MessageBlockStore` - Message block handling
  - `setting.ts` - Application settings
  - `robot.ts` - AI assistant configurations
  - `llm.ts` - LLM provider settings

### Model Configuration
- Models are defined in `/src/config/models.ts`
- Supports 30+ AI providers with 100+ models
- Chat models are filtered using `isChatModel()` function
- Provider-specific configurations in `/src/config/providers.ts`

### Message Processing
- Streaming responses with real-time rendering
- Markdown rendering with syntax highlighting
- Math formula support via MathJax
- Mermaid diagram rendering
- Code block highlighting for multiple languages

### Content Script Integration
- Injected into all web pages (`<all_urls>`)
- Floating chat button and draggable interface
- Text selection and context menu integration
- Page content extraction and summarization

## Development Guidelines

### Code Style
- Uses `@yutengjing/eslint-config-react` for ESLint
- Stylelint with standard config and SCSS support
- Prettier for code formatting
- TypeScript strict mode enabled

### File Structure Conventions
- Components use index.tsx + index.scss pattern
- Services are organized by functionality
- Hooks follow `use*` naming convention
- Types are centralized in `/src/types/`

### Build System
- Development server runs on localhost with hot reload
- Production builds are optimized and minified
- Webpack handles asset optimization and chunking
- Source maps enabled for development

### Testing and Quality
- Lint-staged hooks ensure code quality
- Husky pre-commit hooks
- TypeScript compilation validates types
- ESLint checks code patterns and imports

### Internationalization
- Multiple language support (EN, ZH-CN, ZH-TW, JA, KO, etc.)
- Translation keys centralized in `/src/locales/`
- Dynamic language switching support

## Key Features Implementation

### Multi-Provider Support
- Abstracted provider interface in LangChain services
- Dynamic model loading from configuration
- Provider-specific authentication and API handling

### Real-time Chat
- WebSocket-like streaming via Server-Sent Events
- Message chunking and reassembly
- Error handling and retry logic

### Browser Integration
- Context menu integration for text selection
- Keyboard shortcuts (Ctrl+Shift+Y / Cmd+Shift+Y)
- Floating UI with drag-and-drop positioning
- Side panel for dedicated chat experience

### Content Processing
- Web page content extraction
- Text summarization capabilities
- Code review integration for GitHub/GitLab
- Translation features for selected text