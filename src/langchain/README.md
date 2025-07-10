# LangChain Integration

This directory contains the LangChain integration for the Chrome extension, providing a unified interface for various AI providers with intelligent tool support.

## Architecture Overview

The LangChain integration follows a provider-based architecture with centralized tool management:

```
LangChainService
├── LangChainProviderFactory
├── BaseLangChainProvider (Abstract)
│   ├── Tool Management
│   ├── Tool Refresh System
│   ├── Tool Execution Logic
│   └── Enhanced Completion Flow
├── OpenAiLangChainProvider
├── DeepSeekLangChainProvider
├── OllamaLangChainProvider
└── Tools/
    ├── WebSearchTool
    └── WebPageContextTool
```

## Key Features

### 1. Centralized Tool Management

- All tool setup and management is handled in `BaseLangChainProvider`
- Tools are configured based on user settings, not query content
- Consistent tool behavior across all providers
- **NEW**: Automatic tool refresh when settings change

### 2. Dynamic Tool Refresh

- Tools are automatically refreshed when user settings change
- Supports real-time tool addition/removal without restart
- Callback-based system for efficient updates
- Manual refresh capability for debugging

### 3. Intelligent Tool Selection

- Tools are automatically selected based on user settings and query analysis
- Web search is triggered by keywords like "current", "latest", "news", etc.
- Webpage context is used for queries about "this page", "current page", etc.

### 4. Provider Abstraction

- All providers inherit from `BaseLangChainProvider`
- Consistent interface for completions, model checking, and tool integration
- Easy to add new providers

## Components

### BaseLangChainProvider

The base class that all providers inherit from. It handles:

- **Tool Setup**: Configures available tools based on user settings
- **Tool Refresh**: Automatically updates tools when settings change
- **Tool Execution**: Analyzes queries and executes appropriate tools
- **Enhanced Completion**: Combines tool results with user queries
- **Direct Completion**: Fallback for queries that don't need tools

Key methods:

- `setupTools()`: Configure tools based on settings
- `refreshTools()`: Update tools when settings change
- `removeTool(name)`: Remove a specific tool by name
- `removeAllTools()`: Remove all tools
- `handleToolBasedCompletion()`: Main completion flow with tool support
- `executeDirectCompletion()`: Abstract method for provider-specific completion

### Tool Refresh System

The tool refresh system ensures that tools are automatically updated when user settings change:

#### How it works:

1. **Registration**: When a `LangChainService` is created, it registers its provider with the global refresh system
2. **Callback Setup**: The system registers a callback with `SettingStore` to listen for setting changes
3. **Automatic Refresh**: When settings change, all active providers refresh their tools
4. **Cleanup**: Providers are removed from the system when disposed

#### Setting Changes that Trigger Refresh:

- `webSearchEnabled`: Enable/disable web search
- `enabledSearchEngines`: Change which search engines are enabled
- `useWebpageContext`: Enable/disable webpage context extraction
- `tavilyApiKey`, `exaApiKey`, `bochaApiKey`: API key changes

#### Manual Refresh:

```typescript
// Refresh all active providers
LangChainService.refreshAllTools();

// Refresh specific service instance
langChainService.refreshTools();
```

### Tools

#### WebSearchTool

- **Name**: `web_search`
- Provides web search capabilities using the SearchService
- Supports multiple search engines (Tavily, Exa, Google, Baidu, etc.)
- Optional content fetching for enhanced results
- Automatic result formatting

#### WebPageContextTool

- **Name**: `webpage_context`
- Extracts content from the current webpage
- Uses Chrome extension APIs to access page content
- Handles selected text and full page content
- Automatic content length limiting

### Providers

#### OpenAiLangChainProvider

- Supports OpenAI and OpenAI-compatible APIs
- Handles streaming responses
- Integrated with centralized tool system

#### DeepSeekLangChainProvider

- Specialized for DeepSeek API
- Supports thinking/reasoning content
- Integrated with centralized tool system

#### OllamaLangChainProvider

- Local model support via Ollama
- Dynamic model discovery
- Integrated with centralized tool system

## Configuration

### Tool Configuration

Tools are automatically configured based on user settings:

```typescript
// Web search tool is added if:
settings.webSearchEnabled && settings.enabledSearchEngines.length > 0;

// Webpage context tool is added if:
settings.useWebpageContext;
```

### Provider Selection

Providers are selected based on the provider name:

```typescript
// OpenAI-compatible providers
case 'OpenAI':
case 'OpenRouter':
case 'Anthropic':
// ... other OpenAI-compatible providers
    return new OpenAiLangChainProvider(provider, rootStore);

// DeepSeek
case 'DeepSeek':
    return new DeepSeekLangChainProvider(provider, rootStore);

// Ollama
case 'Ollama':
    return new OllamaLangChainProvider(provider, rootStore);
```

## Usage

### Basic Usage

```typescript
const service = new LangChainService(provider, rootStore);
await service.completions({
  messages,
  robot,
  onChunk,
  onFilterMessages,
});
```

### Tool Integration

Tools are automatically used based on:

1. **User Settings**: Tools must be enabled in settings
2. **Query Analysis**: Keywords trigger specific tools
3. **Context**: Current page analysis for webpage context

### Tool Refresh

Tools are automatically refreshed when settings change. You can also manually refresh:

```typescript
// Manual refresh for debugging
LangChainService.refreshAllTools();
```

### Search Keywords

Web search is triggered by keywords like:

- English: "current", "recent", "latest", "today", "now", "news", "weather"
- Chinese: "最新", "当前", "现在", "今天", "最近", "新闻", "天气"

### Webpage Context Keywords

Webpage context is used for queries like:

- English: "this page", "current page", "summarize", "explain"
- Chinese: "这个页面", "当前页面", "总结", "解释"

## Error Handling

The system includes comprehensive error handling:

- **Tool Failures**: Individual tool failures don't break the entire flow
- **Provider Errors**: Graceful fallback to direct completion
- **Network Issues**: Proper error messages and retry logic
- **Abort Handling**: Clean cancellation of ongoing operations
- **Refresh Errors**: Individual provider refresh failures are logged but don't affect others

## Extension Points

### Adding New Tools

1. Create a new tool class extending `Tool`
2. Add it to the `setupTools()` method in `BaseLangChainProvider`
3. Update the `analyzeQueryForTools()` method if needed
4. Tool will automatically be included in refresh system

### Adding New Providers

1. Create a new provider class extending `BaseLangChainProvider`
2. Implement the abstract methods:
   - `executeDirectCompletion()`
   - `checkModelAvailability()`
   - `initialize()`
   - `completions()`
3. Add the provider to `LangChainProviderFactory`
4. Tool refresh will work automatically

## Debugging

### Tool Refresh Debugging

To debug tool refresh issues:

1. **Check Console Logs**: Look for `[LangChainService]` and `[BaseLangChainProvider]` logs
2. **Manual Refresh**: Call `LangChainService.refreshAllTools()` in console
3. **Setting Changes**: Verify that setting changes trigger callbacks
4. **Provider Registration**: Check if providers are properly registered

### Common Issues

1. **Tools Not Refreshing**: Ensure `rootStore` is passed to `LangChainService` constructor
2. **Multiple Registrations**: Each service instance registers separately - this is normal
3. **Settings Not Persisting**: Check Chrome storage permissions

## Future Enhancements

The architecture is designed to support future extensions:

- **MCP (Model Context Protocol)**: Easy integration of MCP tools
- **Knowledge Bases**: Vector database integration
- **Code Execution**: Sandboxed code execution tools
- **File Operations**: File system access tools
- **API Integration**: Custom API calling tools
- **Advanced Tool Refresh**: Selective tool refresh based on specific setting changes

## Benefits

1. **High Cohesion**: Tool logic is centralized in BaseLangChainProvider
2. **Low Coupling**: Providers are independent and easily extensible
3. **Real-time Updates**: Tools refresh automatically when settings change
4. **Efficient Resource Management**: Automatic cleanup of unused providers
5. **Debugging Support**: Comprehensive logging and manual refresh capabilities
