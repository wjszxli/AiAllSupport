import { Tool } from '@langchain/core/tools';
import { getSearchService } from '@/services/SearchService';
import { Logger } from '@/utils/logger';
import type { RootStore } from '@/store';

const logger = new Logger('WebSearchTool');

interface WebSearchToolOptions {
    rootStore: RootStore;
    maxResults?: number;
    enableContentFetching?: boolean;
    searchEngine?: string; // Specific search engine to use, if not provided, uses all enabled engines
}

export class WebSearchTool extends Tool {
    name = 'web_search';
    description = `Search the web for current information. Use this tool when you need to find recent, up-to-date information that might not be in your training data.

Input should be a search query string.

Examples of when to use:
- Current events, news, or recent developments
- Weather information
- Stock prices or market data
- Recent product releases or updates
- Any information that changes frequently

The tool will return search results with titles, URLs, and snippets from multiple sources.`;

    private searchService: ReturnType<typeof getSearchService>;
    private searchEngine?: string;
    public lastSearchResponse: any = null; // Store last search response for UI display

    constructor(options: WebSearchToolOptions) {
        super();
        this.searchService = getSearchService(options.rootStore);
        this.searchEngine = options.searchEngine;
    }

    protected async _call(query: string): Promise<string> {
        try {
            logger.info(
                `Performing web search for: ${query}${
                    this.searchEngine ? ` using ${this.searchEngine}` : ''
                }`,
            );

            let searchResponse;
            if (this.searchEngine) {
                searchResponse = await this.searchService.performSearchWithEngine(
                    query,
                    this.searchEngine,
                );
            } else {
                searchResponse = await this.searchService.performSearch(query);
            }

            // Store the search response for UI display
            this.lastSearchResponse = searchResponse;

            const formatted = this.searchService.formatSearchResults(searchResponse);
            logger.info(`Web search completed: ${searchResponse.results.length} results`);
            return formatted;
            // }
        } catch (error) {
            logger.error('Web search failed:', error);
            // Clear last search response on error
            this.lastSearchResponse = null;
            return `Web search failed: ${
                error instanceof Error ? error.message : 'Unknown error'
            }. Please try rephrasing your query or check if web search is properly configured.`;
        }
    }
}

export default WebSearchTool;
