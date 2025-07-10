import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { Tool } from '@langchain/core/tools';
import { CompletionsParams, Model, Provider } from '@/types';
import { addAbortController, removeAbortController } from '@/utils/abortController';
import { Logger } from '@/utils';
import { Message } from '@/types/message';
import { getMainTextContent } from '@/utils/message/find';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import WebSearchTool from '../tools/WebSearchTool';
import WebPageContextTool from '../tools/WebPageContextTool';
import type { RootStore } from '@/store';

const logger = new Logger('BaseLangChainProvider');

export default abstract class BaseLangChainProvider {
    protected provider: Provider;
    protected model: BaseLanguageModel | null = null;
    protected tools: Tool[] = [];
    protected rootStore?: RootStore;

    constructor(provider: Provider, rootStore?: RootStore) {
        this.provider = provider;
        this.rootStore = rootStore;
        this.setupTools();
    }

    /**
     * Setup available tools based on user settings
     */
    protected setupTools() {
        if (!this.rootStore) return;

        const settings = this.rootStore.settingStore;
        this.tools = []; // Reset tools

        // Add web search tool if enabled
        if (settings.webSearchEnabled && settings.enabledSearchEngines.length > 0) {
            const webSearchTool = new WebSearchTool({
                rootStore: this.rootStore,
                maxResults: 5,
                enableContentFetching: true,
            });
            this.tools.push(webSearchTool);
            logger.info('Web search tool added');
        }

        // Add webpage context tool if enabled
        if (settings.useWebpageContext) {
            const webPageContextTool = new WebPageContextTool();
            this.tools.push(webPageContextTool);
            logger.info('Webpage context tool added');
        }

        logger.info(`Total tools available: ${this.tools.length}`);
    }

    /**
     * Refresh tools based on current settings
     * This method should be called when settings change
     */
    public refreshTools() {
        const oldToolsCount = this.tools.length;
        const oldToolNames = this.tools.map((tool) => tool.name);

        this.setupTools();

        const newToolsCount = this.tools.length;
        const newToolNames = this.tools.map((tool) => tool.name);

        logger.info(`Tools refreshed: ${oldToolsCount} -> ${newToolsCount}`);
        logger.info(`Old tools: [${oldToolNames.join(', ')}]`);
        logger.info(`New tools: [${newToolNames.join(', ')}]`);

        // Log specific changes
        const addedTools = newToolNames.filter((name) => !oldToolNames.includes(name));
        const removedTools = oldToolNames.filter((name) => !newToolNames.includes(name));

        if (addedTools.length > 0) {
            logger.info(`Added tools: [${addedTools.join(', ')}]`);
        }
        if (removedTools.length > 0) {
            logger.info(`Removed tools: [${removedTools.join(', ')}]`);
        }
    }

    /**
     * Remove a specific tool by name
     */
    public removeTool(toolName: string) {
        const initialLength = this.tools.length;
        this.tools = this.tools.filter((tool) => tool.name !== toolName);
        const removed = initialLength - this.tools.length;

        if (removed > 0) {
            logger.info(`Removed ${removed} tool(s) with name: ${toolName}`);
        }
    }

    /**
     * Remove all tools
     */
    public removeAllTools() {
        const removedCount = this.tools.length;
        this.tools = [];
        logger.info(`Removed all ${removedCount} tools`);
    }

    /**
     * Get available tools
     */
    public getTools(): Tool[] {
        return this.tools;
    }

    /**
     * Check if tools are available
     */
    public hasTools(): boolean {
        return this.tools.length > 0;
    }

    /**
     * Enhanced completion method that handles tool usage
     * This method executes tools and returns the enhanced user input for the provider to use
     */
    protected async prepareUserInputWithTools(userInput: string): Promise<string> {
        if (!this.hasTools()) {
            return userInput;
        }

        // Execute tools and gather results
        const toolResults: string[] = [];

        for (const tool of this.tools) {
            try {
                logger.info(`Executing tool: ${tool.name}`);
                const result = await tool.call(userInput);
                toolResults.push(`## ${tool.name} Results:\n${result}\n`);
            } catch (error) {
                logger.error(`Tool ${tool.name} failed:`, error);
                toolResults.push(
                    `## ${tool.name} Error:\nTool execution failed: ${
                        error instanceof Error ? error.message : 'Unknown error'
                    }\n`,
                );
            }
        }

        // If we have tool results, enhance the user input
        if (toolResults.length > 0) {
            return this.buildEnhancedPrompt(userInput, toolResults);
        }

        return userInput;
    }

    /**
     * Build enhanced prompt with tool results
     */
    private buildEnhancedPrompt(userInput: string, toolResults: string[]): string {
        const toolContext = toolResults.join('\n');

        return `You have access to additional context from various tools. Use this information to provide a comprehensive and accurate response.

${toolContext}

User Question: ${userInput}

Please provide a helpful response based on the available information. If you use information from the tools, please cite the sources appropriately.`;
    }

    async convertToLangChainMessages(messages: Message[]) {
        const langchainMessages = [];

        for (const message of messages) {
            const content = getMainTextContent(message);

            if (message.role === 'user') {
                langchainMessages.push(new HumanMessage(content));
            } else if (message.role === 'assistant') {
                langchainMessages.push(new AIMessage(content));
            } else if (message.role === 'system') {
                langchainMessages.push(new SystemMessage(content));
            }
        }

        return langchainMessages;
    }

    protected createAbortController(messageId?: string, isAddEventListener?: boolean) {
        try {
            const abortController = new AbortController();
            const abortFn = () => abortController.abort();

            if (messageId) {
                addAbortController(messageId, abortFn);
            }

            const signalPromise: {
                resolve: (value: unknown) => void;
                promise: Promise<unknown>;
            } = {
                resolve: () => {},
                promise: Promise.resolve(),
            };

            const cleanup = () => {
                try {
                    if (messageId) {
                        signalPromise.resolve?.(undefined);
                        removeAbortController(messageId, abortFn);
                    }
                } catch (error) {
                    logger.error('Error in cleanup:', error);
                    logger.error(
                        'Stack trace:',
                        error instanceof Error ? error.stack : 'No stack trace available',
                    );
                }
            };

            if (isAddEventListener) {
                signalPromise.promise = new Promise((resolve, reject) => {
                    signalPromise.resolve = resolve;

                    const abortHandler = () => {
                        try {
                            // Instead of directly rejecting with an error, we'll clean up first
                            cleanup();
                            // Then reject with a more specific error that can be properly handled
                            reject(new DOMException('Operation aborted', 'AbortError'));
                        } catch (error) {
                            logger.error('Error in abortHandler:', error);
                            logger.error(
                                'Stack trace:',
                                error instanceof Error ? error.stack : 'No stack trace available',
                            );
                        }
                    };

                    if (abortController.signal.aborted) {
                        abortHandler();
                    } else {
                        // Use once: true to ensure the handler is removed after firing
                        abortController.signal.addEventListener('abort', abortHandler, {
                            once: true,
                        });
                    }
                });

                return {
                    abortController,
                    cleanup,
                    signalPromise,
                };
            }

            return {
                abortController,
                cleanup,
                signalPromise,
            };
        } catch (error) {
            logger.error('Error in createAbortController:', error);
            logger.error(
                'Stack trace:',
                error instanceof Error ? error.stack : 'No stack trace available',
            );
            throw error;
        }
    }

    /**
     * 通用的模型检查方法，验证API密钥和主机
     * 子类可以覆盖此方法以提供特定的实现
     */
    async check(): Promise<{ valid: boolean; error: Error | null }> {
        try {
            // 验证API密钥（如果需要）
            if (this.provider.requiresApiKey !== false && !this.provider.apiKey) {
                return { valid: false, error: new Error('API key is required') };
            }

            // 验证API主机
            if (!this.provider.apiHost) {
                return { valid: false, error: new Error('API host is required') };
            }

            // 子类需要实现具体的模型检查逻辑
            return await this.checkModelAvailability();
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error : new Error('Unknown error'),
            };
        }
    }

    /**
     * 子类需要实现此方法来检查特定模型的可用性
     */
    protected abstract checkModelAvailability(): Promise<{ valid: boolean; error: Error | null }>;

    abstract initialize(): void;

    abstract completions({
        messages,
        robot,
        onChunk,
        onFilterMessages,
    }: CompletionsParams): Promise<void>;

    async models(provider: Provider): Promise<Model[]> {
        try {
            if (provider.models.length) {
                return provider.models;
            }

            // 如果本地没有模型，则从API获取
            const res = await fetch(`${this.provider.apiHost}/api/tags`);
            const data = await res.json();

            const models = data.models.map((model: any) => ({
                id: model.name,
                name: model.name,
                provider: provider.id,
                group: 'Ollama',
            }));

            return models;
        } catch (error) {
            logger.error('Error fetching models:', error);
            return [];
        }
    }
}
