# LangChain Tool Refresh Testing Guide

This guide explains how to test the tool refresh functionality in the LangChain integration.

## Overview

The tool refresh system automatically updates tools when user settings change. This ensures that tools are dynamically added or removed based on user preferences without requiring a restart.

## Testing the Tool Refresh System

### 1. Basic Functionality Test

1. **Open the chat interface**
2. **Open browser console** (F12)
3. **Check initial state**:

   ```javascript
   // Check debug info
   debugLangChain.getDebugInfo();
   ```

4. **Toggle search settings**:

   - Click the search button in the chat input area
   - Or go to Settings → Search and toggle "Web Search"

5. **Verify tool refresh**:
   - Check console logs for refresh messages
   - Look for messages like: `[LangChainService] Refreshing tools for X active providers`

### 2. Manual Refresh Test

You can manually trigger tool refresh for testing:

```javascript
// Manually refresh all tools
debugLangChain.refreshAllTools();

// Check the result
debugLangChain.getDebugInfo();
```

### 3. Setting Changes That Trigger Refresh

The following setting changes should trigger tool refresh:

#### Web Search Settings:

- `webSearchEnabled` (Enable/disable web search)
- `enabledSearchEngines` (Change search engines)
- `tavilyApiKey` (Tavily API key)
- `exaApiKey` (Exa API key)
- `bochaApiKey` (Bocha API key)

#### Webpage Context Settings:

- `useWebpageContext` (Enable/disable webpage context)

### 4. Expected Tool Behavior

#### When Web Search is Enabled:

- Should see `web_search` tool in debug info
- Tool count should increase by 1

#### When Web Search is Disabled:

- Should NOT see `web_search` tool in debug info
- Tool count should decrease by 1

#### When Webpage Context is Enabled:

- Should see `webpage_context` tool in debug info
- Tool count should increase by 1

#### When Webpage Context is Disabled:

- Should NOT see `webpage_context` tool in debug info
- Tool count should decrease by 1

### 5. Console Log Examples

#### Successful Tool Refresh:

```
[LangChainService] Refreshing tools for 1 active providers
[BaseLangChainProvider] Tools refreshed: 0 -> 1
[BaseLangChainProvider] Old tools: []
[BaseLangChainProvider] New tools: [web_search]
[BaseLangChainProvider] Added tools: [web_search]
```

#### Tool Removal:

```
[LangChainService] Refreshing tools for 1 active providers
[BaseLangChainProvider] Tools refreshed: 1 -> 0
[BaseLangChainProvider] Old tools: [web_search]
[BaseLangChainProvider] New tools: []
[BaseLangChainProvider] Removed tools: [web_search]
```

### 6. Testing Scenarios

#### Scenario 1: Enable Web Search

1. Ensure web search is disabled
2. Send a message (to create a LangChain provider)
3. Check debug info - should have 0 or 1 tools (depending on webpage context)
4. Enable web search via chat button or settings
5. Check debug info again - should have +1 tool (`web_search`)

#### Scenario 2: Disable Web Search

1. Ensure web search is enabled
2. Send a message
3. Check debug info - should include `web_search` tool
4. Disable web search
5. Check debug info - should no longer include `web_search` tool

#### Scenario 3: Change Search Engines

1. Enable web search with some engines
2. Send a message
3. Change enabled search engines in settings
4. Should see tool refresh in console (same tool, but refreshed)

#### Scenario 4: Multiple Providers

1. Send messages with different models/providers
2. Check debug info - should show multiple providers
3. Change settings
4. All providers should refresh their tools

### 7. Troubleshooting

#### Tools Not Refreshing:

- Check if `rootStore` is passed to LangChainService
- Verify console logs for error messages
- Ensure settings are actually changing (check storage)

#### Multiple Refresh Calls:

- This is normal - each active provider refreshes independently
- Each message creates a new provider instance temporarily

#### Settings Not Persisting:

- Check Chrome storage permissions
- Verify settings are saved to Chrome storage

### 8. Debug Commands

```javascript
// Get current debug info
debugLangChain.getDebugInfo();

// Manual refresh
debugLangChain.refreshAllTools();

// Check current settings
rootStore.settingStore.getAllSettings();

// Toggle web search programmatically
rootStore.settingStore.setWebSearchEnabled(true);
rootStore.settingStore.setWebSearchEnabled(false);

// Toggle webpage context programmatically
rootStore.settingStore.setUseWebpageContext(true);
rootStore.settingStore.setUseWebpageContext(false);
```

### 9. Expected Debug Info Structure

```javascript
{
  activeProviders: 1,
  toolRefreshInitialized: true,
  providers: [
    {
      tools: [
        {
          name: "web_search",
          description: "Search the web for current information. Use this tool when you need to find recent, up-to-date..."
        },
        {
          name: "webpage_context",
          description: "Get the content of the current webpage that the user is browsing. Use this when the user asks..."
        }
      ],
      toolCount: 2
    }
  ]
}
```

## Implementation Details

### Callback Registration

- LangChainService registers callbacks with SettingStore
- Callbacks are called when relevant settings change
- Each setting change method calls `notifyToolRefreshCallbacks()`

### Provider Management

- Active providers are tracked in a static Set
- Providers are added on construction, removed on disposal
- All active providers are refreshed when settings change

### Tool Refresh Logic

- `refreshTools()` calls `setupTools()` to reconfigure tools
- Old tools are completely replaced with new tools
- Detailed logging shows what changed

This system ensures that tools are always in sync with user settings without requiring restarts or manual intervention.
