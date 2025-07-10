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
   - Look for messages like: `[LangChainProvider] Tools refreshed: 0 -> 1`
   - Verify tool names in logs: `[LangChainProvider] Added tools: [web_search]`

### 2. Streaming Output Test

1. **Enable search tools**:

   - Go to Settings → Search
   - Enable "Web Search"
   - Configure at least one search engine (e.g., DuckDuckGo)

2. **Test streaming with tools**:

   - Ask a question that would benefit from web search
   - Example: "What's the latest news about AI?"
   - Verify that:
     - Tool execution happens first (check console logs)
     - Response streams character by character
     - Search results are included in the response

3. **Test streaming without tools**:
   - Disable all search tools
   - Ask a general question
   - Verify normal streaming behavior

### 3. Tool Integration Test

1. **Test search tool integration**:

   ```javascript
   // Enable web search
   rootStore.settingStore.setWebSearchEnabled(true);
   rootStore.settingStore.setEnabledSearchEngines(['duckduckgo']);

   // Check that tools were added
   debugLangChain.getDebugInfo();
   ```

2. **Test webpage context tool**:

   ```javascript
   // Enable webpage context
   rootStore.settingStore.setUseWebpageContext(true);

   // Check tools
   debugLangChain.getDebugInfo();
   ```

### 4. Error Handling Test

1. **Test with invalid API keys**:

   - Set invalid API keys for search engines
   - Verify that tools fail gracefully
   - Check that streaming still works

2. **Test tool execution errors**:
   - Monitor console for tool error messages
   - Verify that errors don't break streaming

### 5. Performance Test

1. **Test with multiple tools**:

   - Enable both web search and webpage context
   - Ask a complex question
   - Verify that tool execution doesn't significantly delay response

2. **Test tool refresh performance**:
   - Rapidly toggle settings
   - Verify that refresh operations complete quickly

## Expected Behavior

### ✅ Correct Behavior

1. **Tool Refresh**:

   - Tools are added/removed immediately when settings change
   - Console logs show detailed information about tool changes
   - No page refresh required

2. **Streaming Output**:

   - Responses stream character by character
   - Tool results are integrated into the prompt before streaming
   - No blocking or delays in streaming

3. **Tool Integration**:
   - Tools execute before the main response
   - Tool results are included in the enhanced prompt
   - Sources are properly cited in responses

### ❌ Incorrect Behavior

1. **Tool Refresh Issues**:

   - Tools not updating when settings change
   - Missing console logs about tool changes
   - Errors in tool refresh callbacks

2. **Streaming Issues**:

   - Response appears all at once (not streaming)
   - Long delays before streaming starts
   - Streaming stops or stutters

3. **Tool Integration Issues**:
   - Tools not executing when enabled
   - Tool results not appearing in responses
   - Errors during tool execution break streaming

## Debug Commands

Use these commands in the browser console:

```javascript
// Check current state
debugLangChain.getDebugInfo();

// Manual tool refresh
debugLangChain.refreshAllTools();

// Check active providers
debugLangChain.getDebugInfo().activeProviders;

// Check tool refresh system
debugLangChain.getDebugInfo().toolRefreshInitialized;
```

## Common Issues and Solutions

### Issue: Tools not refreshing

**Solution**: Check that the callback system is properly initialized:

```javascript
// Should return true
debugLangChain.getDebugInfo().toolRefreshInitialized;
```

### Issue: Streaming not working

**Solution**: Verify that the provider is using the new streaming approach:

- Check that `prepareUserInputWithTools` is being called
- Verify that the stream loop is executing properly

### Issue: Tool execution errors

**Solution**: Check console logs for specific error messages:

- API key issues
- Network connectivity problems
- Tool configuration errors

## Performance Expectations

- **Tool refresh**: < 100ms
- **Tool execution**: 1-5 seconds (depending on search complexity)
- **Streaming start**: < 500ms after tool execution
- **Streaming rate**: Smooth, no noticeable delays

## Testing Checklist

- [ ] Tools refresh when settings change
- [ ] Console logs show tool changes
- [ ] Streaming works with tools enabled
- [ ] Streaming works with tools disabled
- [ ] Tool results appear in responses
- [ ] Error handling works properly
- [ ] Performance is acceptable
- [ ] Debug commands work correctly
