import { SEARCH_ENGINES } from '@/utils/constant';
import type { RootStore } from '@/store';

// 延迟创建Logger实例，避免循环依赖
let logger: any = {
    info: (msg: string, ...args: any[]) => console.log(`[SearchService] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[SearchService] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[SearchService] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => console.debug(`[SearchService] ${msg}`, ...args),
};

// 异步初始化真正的Logger
(async () => {
    try {
        const { Logger } = await import('@/utils/logger');
        logger = new Logger('SearchService');
    } catch (error) {
        console.error('Failed to initialize logger in SearchService:', error);
    }
})();

export interface SearchResult {
    title: string;
    url: string;
    link?: string;
    source?: string;
    snippet: string;
    domain: string;
}

export interface EnhancedSearchResult extends SearchResult {
    content?: string; // Full content fetched from the URL
    fetchedAt?: string; // Timestamp when content was fetched
    contentSummary?: string; // Summary of the content
}

export interface SearchResponse {
    results: SearchResult[];
    query: string;
    engine: string;
}

export interface EnhancedSearchResponse {
    results: EnhancedSearchResult[];
    query: string;
    engine: string;
    contentFetched: boolean; // Whether content was successfully fetched
}

class SearchService {
    private rootStore: RootStore;

    constructor(rootStore: RootStore) {
        this.rootStore = rootStore;
    }

    /**
     * 检查模型是否支持原生搜索
     */
    public modelSupportsNativeSearch(modelId?: string): boolean {
        if (!modelId) return false;

        // 检查模型ID是否包含search关键字
        const searchKeywords = ['search', 'web', 'browse'];
        return searchKeywords.some((keyword) => modelId.toLowerCase().includes(keyword));
    }

    /**
     * 执行搜索 - 使用指定搜索引擎
     */
    public async performSearchWithEngine(query: string, engine: string): Promise<SearchResponse> {
        const settings = this.rootStore.settingStore;

        // 检查搜索是否启用
        if (!settings.webSearchEnabled) {
            throw new Error('Web search is not enabled');
        }

        // 检查指定的搜索引擎是否启用
        if (!settings.enabledSearchEngines.includes(engine)) {
            throw new Error(`Search engine ${engine} is not enabled`);
        }

        logger.info(`performSearchWithEngine: ${query}, engine: ${engine}`);

        try {
            let results: SearchResult[] = [];

            switch (engine) {
                case SEARCH_ENGINES.TAVILY:
                    results = await this.searchWithTavily(query);
                    break;
                case SEARCH_ENGINES.EXA:
                    results = await this.searchWithExa(query);
                    break;
                case SEARCH_ENGINES.BOCHA:
                    results = await this.searchWithBocha(query);
                    break;
                case SEARCH_ENGINES.GOOGLE:
                    results = await this.searchWithGoogle(query);
                    break;
                case SEARCH_ENGINES.BAIDU:
                    results = await this.searchWithBaidu(query);
                    break;
                case SEARCH_ENGINES.BIYING:
                    results = await this.searchWithBing(query);
                    break;
                case SEARCH_ENGINES.SOGOU:
                    results = await this.searchWithSogou(query);
                    break;
                case SEARCH_ENGINES.SEARXNG:
                    results = await this.searchWithSearxng(query);
                    break;
                default:
                    throw new Error(`Unknown search engine: ${engine}`);
            }

            const filteredResults = this.filterResultsByDomain(results);
            return {
                query,
                results: filteredResults,
                engine: engine,
            };
        } catch (error) {
            logger.error(`Search failed with engine ${engine}:`, error);
            throw error;
        }
    }

    /**
     * 执行搜索 - 使用所有启用的搜索引擎
     */
    public async performSearch(query: string): Promise<SearchResponse> {
        const settings = this.rootStore.settingStore;

        // 检查搜索是否启用
        if (!settings.webSearchEnabled) {
            throw new Error('Web search is not enabled');
        }

        // 检查是否有启用的搜索引擎
        if (!settings.enabledSearchEngines || settings.enabledSearchEngines.length === 0) {
            throw new Error('No search engines enabled');
        }

        const allResults: SearchResult[] = [];
        const usedEngines: string[] = [];
        const maxResults = 20; // 最多搜索结果数量

        logger.info(`performSearch: ${query}，engines ${settings.enabledSearchEngines}`);
        // 尝试启用的搜索引擎
        for (const engine of settings.enabledSearchEngines) {
            logger.info(
                `Trying search with engine: ${engine}, current results: ${allResults.length}`,
            );
            try {
                let results: SearchResult[] = [];

                switch (engine) {
                    case SEARCH_ENGINES.TAVILY:
                        results = await this.searchWithTavily(query);
                        break;
                    case SEARCH_ENGINES.EXA:
                        results = await this.searchWithExa(query);
                        break;
                    case SEARCH_ENGINES.BOCHA:
                        results = await this.searchWithBocha(query);
                        break;
                    case SEARCH_ENGINES.GOOGLE:
                        results = await this.searchWithGoogle(query);
                        break;
                    case SEARCH_ENGINES.BAIDU:
                        results = await this.searchWithBaidu(query);
                        break;
                    case SEARCH_ENGINES.BIYING:
                        results = await this.searchWithBing(query);
                        break;
                    case SEARCH_ENGINES.SOGOU:
                        results = await this.searchWithSogou(query);
                        break;
                    case SEARCH_ENGINES.SEARXNG:
                        results = await this.searchWithSearxng(query);
                        break;
                    default:
                        logger.warn(`Unknown search engine: ${engine}`);
                        continue;
                }

                if (results.length > 0) {
                    logger.info(`${engine} returned ${results.length} results`);

                    // 添加结果到总列表，避免重复URL
                    const existingUrls = new Set(allResults.map((r) => r.url));
                    const newResults = results.filter(
                        (result) => result.url && !existingUrls.has(result.url),
                    );

                    allResults.push(...newResults);
                    usedEngines.push(engine);

                    logger.info(
                        `Added ${newResults.length} new results, total: ${allResults.length}`,
                    );
                } else {
                    logger.warn(`${engine} returned no results`);
                }
            } catch (error) {
                logger.error(`Search failed with engine ${engine}:`, error);
                continue;
            }

            // 如果已经有足够的结果，可以停止搜索
            if (allResults.length >= maxResults) {
                logger.info(`Reached maximum results (${maxResults}), stopping search`);
                break;
            }
        }

        // 过滤域名黑名单
        const filteredResults = this.filterResultsByDomain(allResults);

        // 限制最终结果数量并按相关性排序（这里简单按顺序）
        const finalResults = filteredResults.slice(0, maxResults);

        return {
            results: finalResults,
            query,
            engine: usedEngines.join(', '),
        };
    }

    /**
     * 执行搜索并增强结果内容
     */
    public async performSearchWithContent(
        query: string,
        maxUrlsToFetch: number = 5,
    ): Promise<EnhancedSearchResponse> {
        logger.info(`Performing search with content enhancement: ${query}`);

        try {
            // 首先执行常规搜索
            const searchResponse = await this.performSearch(query);

            // 然后增强搜索结果，获取URL内容
            const enhancedResponse = await this.enhanceSearchResultsWithContent(
                searchResponse,
                maxUrlsToFetch,
            );

            logger.info(
                `Search with content completed: ${enhancedResponse.results.length} results, ` +
                    `content fetched: ${enhancedResponse.contentFetched}`,
            );

            return enhancedResponse;
        } catch (error) {
            logger.error('Search with content failed:', error);
            throw error;
        }
    }

    /**
     * 使用Tavily API搜索
     */
    private async searchWithTavily(query: string): Promise<SearchResult[]> {
        const apiKey = this.rootStore.settingStore.tavilyApiKey;
        if (!apiKey) {
            throw new Error('Tavily API key not configured');
        }

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                query,
                search_depth: 'basic',
                include_answer: false,
                include_images: false,
                include_raw_content: false,
                max_results: 10,
            }),
        });

        if (!response.ok) {
            throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return (
            data.results?.map((result: any) => ({
                title: result.title || '',
                url: result.url || '',
                snippet: result.content || '',
                domain: this.extractDomain(result.url || ''),
            })) || []
        );
    }

    /**
     * 使用Exa API搜索
     */
    private async searchWithExa(query: string): Promise<SearchResult[]> {
        const apiKey = this.rootStore.settingStore.exaApiKey;
        if (!apiKey) {
            throw new Error('Exa API key not configured');
        }

        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({
                query,
                num_results: 10,
                include_domains: [],
                exclude_domains: [],
                use_autoprompt: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Exa search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return (
            data.results?.map((result: any) => ({
                title: result.title || '',
                url: result.url || '',
                snippet: result.text || '',
                domain: this.extractDomain(result.url || ''),
            })) || []
        );
    }

    /**
     * 使用Bocha API搜索
     */
    private async searchWithBocha(query: string): Promise<SearchResult[]> {
        const apiKey = this.rootStore.settingStore.bochaApiKey;
        if (!apiKey) {
            throw new Error('Bocha API key not configured');
        }

        const response = await fetch('https://api.bochaai.com/v1/web-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                query,
                count: 10,
            }),
        });

        if (!response.ok) {
            throw new Error(`Bocha search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return (
            data.results?.map((result: any) => ({
                title: result.title || '',
                url: result.url || '',
                snippet: result.snippet || '',
                domain: this.extractDomain(result.url || ''),
            })) || []
        );
    }

    /**
     * 使用SearXNG API搜索
     */
    private async searchWithSearxng(query: string): Promise<SearchResult[]> {
        const settings = this.rootStore.settingStore;
        const apiUrl = settings.searxngApiUrl;
        const username = settings.searxngUsername;

        if (!apiUrl) {
            throw new Error('SearXNG API URL not configured');
        }

        try {
            // 验证并构建搜索URL
            let baseUrl = apiUrl.trim();
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                baseUrl = 'https://' + baseUrl;
            }

            const searchUrl = new URL('/search', baseUrl);
            searchUrl.searchParams.set('q', query);
            searchUrl.searchParams.set('format', 'json');
            searchUrl.searchParams.set('category', 'general');

            // 构建请求头
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'AiAllSupport-Extension/1.0',
            };

            // 如果配置了用户名，添加到请求头
            if (username && username.trim()) {
                headers['X-Username'] = username.trim();
            }

            const response = await fetch(searchUrl.toString(), {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                throw new Error(`SearXNG search failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // 解析SearXNG的响应格式
            if (!data.results || !Array.isArray(data.results)) {
                return [];
            }

            return data.results
                .map((result: any) => ({
                    title: result.title || '',
                    url: result.url || '',
                    snippet: result.content || result.snippet || '',
                    domain: this.extractDomain(result.url || ''),
                }))
                .filter((result: SearchResult) => result.url && result.title);
        } catch (error) {
            logger.error('SearXNG search failed:', error);
            throw error;
        }
    }

    /**
     * 使用Google搜索（免费）
     */
    private async searchWithGoogle(query: string): Promise<SearchResult[]> {
        try {
            // 优先尝试通过 background script 搜索（绕过跨域限制）
            try {
                logger.info('Trying background script search for Google');
                const backgroundResults = await this.searchViaBackground(query, 'google');
                if (backgroundResults.length > 0) {
                    logger.info(
                        `Google search successful via background with ${backgroundResults.length} results`,
                    );
                    return backgroundResults;
                }
            } catch (backgroundError) {
                logger.warn('Background Google search failed:', backgroundError);
            }

            // 最终方案：生成相关的Google搜索结果链接
            logger.info('Using static Google search results as final fallback');
            const staticResults = [
                {
                    title: `Google搜索: ${query}`,
                    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                    snippet: `在Google上搜索"${query}"的结果`,
                    domain: 'google.com',
                },
                {
                    title: `Google学术: ${query}`,
                    url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
                    snippet: `在Google学术中搜索"${query}"的学术资料`,
                    domain: 'scholar.google.com',
                },
                {
                    title: `Google新闻: ${query}`,
                    url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
                    snippet: `在Google新闻中搜索"${query}"的最新资讯`,
                    domain: 'news.google.com',
                },
            ];

            return staticResults;
        } catch (error) {
            logger.error('Google search failed:', error);
            return [];
        }
    }

    /**
     * 使用百度搜索（免费）
     */
    private async searchWithBaidu(query: string): Promise<SearchResult[]> {
        try {
            // 优先尝试通过 background script 搜索
            try {
                logger.info('Trying background script search for Baidu');
                const backgroundResults = await this.searchViaBackground(query, 'baidu');
                if (backgroundResults.length > 0) {
                    logger.info(
                        `Baidu search successful via background with ${backgroundResults.length} results`,
                    );
                    return backgroundResults;
                }
            } catch (backgroundError) {
                logger.warn('Background Baidu search failed:', backgroundError);
            }

            // 备选方案：生成相关的百度搜索结果链接
            logger.info('Using static Baidu search results as fallback');
            const staticResults = [
                {
                    title: `百度搜索: ${query}`,
                    url: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
                    snippet: `在百度上搜索"${query}"的结果`,
                    domain: 'baidu.com',
                },
                {
                    title: `百度百科: ${query}`,
                    url: `https://baike.baidu.com/search?word=${encodeURIComponent(query)}`,
                    snippet: `在百度百科中查找"${query}"的相关信息`,
                    domain: 'baike.baidu.com',
                },
                {
                    title: `百度知道: ${query}`,
                    url: `https://zhidao.baidu.com/search?word=${encodeURIComponent(query)}`,
                    snippet: `在百度知道中查找"${query}"的问答`,
                    domain: 'zhidao.baidu.com',
                },
                {
                    title: `百度图片: ${query}`,
                    url: `https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(
                        query,
                    )}`,
                    snippet: `在百度图片中搜索"${query}"的相关图片`,
                    domain: 'image.baidu.com',
                },
                {
                    title: `百度学术: ${query}`,
                    url: `https://xueshu.baidu.com/s?wd=${encodeURIComponent(query)}`,
                    snippet: `在百度学术中搜索"${query}"的学术资料`,
                    domain: 'xueshu.baidu.com',
                },
            ];

            return staticResults;
        } catch (error) {
            logger.error('Baidu search failed:', error);
            return [];
        }
    }

    /**
     * 使用必应搜索（免费）
     */
    private async searchWithBing(query: string): Promise<SearchResult[]> {
        try {
            // 优先尝试通过 background script 搜索
            try {
                logger.info('Trying background script search for Bing');
                const backgroundResults = await this.searchViaBackground(query, 'biying');
                if (backgroundResults.length > 0) {
                    logger.info(
                        `Bing search successful via background with ${backgroundResults.length} results`,
                    );
                    return backgroundResults;
                }
            } catch (backgroundError) {
                logger.warn('Background Bing search failed:', backgroundError);
            }

            // 备选方案：生成相关的必应搜索结果链接
            logger.info('Using static Bing search results as fallback');
            const staticResults = [
                {
                    title: `必应搜索: ${query}`,
                    url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
                    snippet: `在必应上搜索"${query}"的结果`,
                    domain: 'bing.com',
                },
                {
                    title: `必应图片: ${query}`,
                    url: `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`,
                    snippet: `在必应图片中搜索"${query}"的相关图片`,
                    domain: 'bing.com',
                },
                {
                    title: `必应新闻: ${query}`,
                    url: `https://www.bing.com/news/search?q=${encodeURIComponent(query)}`,
                    snippet: `在必应新闻中搜索"${query}"的最新资讯`,
                    domain: 'bing.com',
                },
            ];

            return staticResults;
        } catch (error) {
            logger.error('Bing search failed:', error);
            return [];
        }
    }

    /**
     * 使用搜狗搜索（免费）
     */
    private async searchWithSogou(query: string): Promise<SearchResult[]> {
        try {
            // 优先尝试通过 background script 搜索
            try {
                logger.info('Trying background script search for Sogou');
                const backgroundResults = await this.searchViaBackground(query, 'sogou');
                if (backgroundResults.length > 0) {
                    logger.info(
                        `Sogou search successful via background with ${backgroundResults.length} results`,
                    );
                    return backgroundResults;
                }
            } catch (backgroundError) {
                logger.warn('Background Sogou search failed:', backgroundError);
            }

            // 备选方案：生成相关的搜狗搜索结果链接
            logger.info('Using static Sogou search results as fallback');
            const staticResults = [
                {
                    title: `搜狗搜索: ${query}`,
                    url: `https://www.sogou.com/web?query=${encodeURIComponent(query)}`,
                    snippet: `在搜狗上搜索"${query}"的结果`,
                    domain: 'sogou.com',
                },
                {
                    title: `搜狗百科: ${query}`,
                    url: `https://baike.sogou.com/v${Math.floor(
                        Math.random() * 100000000,
                    )}?query=${encodeURIComponent(query)}`,
                    snippet: `在搜狗百科中查找"${query}"的相关信息`,
                    domain: 'baike.sogou.com',
                },
                {
                    title: `搜狗问问: ${query}`,
                    url: `https://wenwen.sogou.com/s/?w=${encodeURIComponent(query)}`,
                    snippet: `在搜狗问问中查找"${query}"的问答`,
                    domain: 'wenwen.sogou.com',
                },
            ];

            return staticResults;
        } catch (error) {
            logger.error('Sogou search failed:', error);
            return [];
        }
    }

    /**
     * 通过 background script 执行搜索（绕过跨域限制）
     */
    private async searchViaBackground(query: string, engine: string): Promise<SearchResult[]> {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`通过 background script 搜索: ${engine} - ${query}`);

                // 设置超时机制
                const timeout = setTimeout(() => {
                    logger.error('Background script 搜索超时 (30秒)');
                    reject(new Error('搜索超时'));
                }, 30000); // 30秒超时

                chrome.runtime.sendMessage(
                    {
                        action: 'performSearch',
                        query: query,
                        engine: engine,
                    },
                    (response) => {
                        clearTimeout(timeout);

                        if (chrome.runtime.lastError) {
                            logger.error('Background script 通信错误:', chrome.runtime.lastError);
                            // 将Chrome运行时错误转换为更友好的错误信息
                            const errorMessage =
                                chrome.runtime.lastError.message || 'Unknown error';
                            if (
                                errorMessage.includes('message port closed') ||
                                errorMessage.includes('receiving end does not exist')
                            ) {
                                reject(
                                    new Error('Background script 连接中断，可能是扩展刚刚重新加载'),
                                );
                            } else {
                                reject(new Error(`Background script 通信失败: ${errorMessage}`));
                            }
                            return;
                        }

                        if (!response) {
                            logger.error('Background script 返回空响应');
                            reject(new Error('Background script 返回空响应'));
                            return;
                        }

                        if (response.success) {
                            logger.info(
                                `Background script 搜索成功，返回 ${
                                    response.results?.length || 0
                                } 个结果`,
                            );
                            resolve(response.results || []);
                        } else {
                            logger.error('Background script 搜索失败:', response.error);
                            reject(new Error(response.error || 'Background script 搜索失败'));
                        }
                    },
                );
            } catch (error) {
                logger.error('发送消息到 background script 失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 从URL提取域名
     */
    private extractDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return '';
        }
    }

    /**
     * 根据过滤域名列表过滤搜索结果
     */
    private filterResultsByDomain(results: SearchResult[]): SearchResult[] {
        const filteredDomains = this.rootStore.settingStore.filteredDomains;
        if (!filteredDomains || filteredDomains.length === 0) {
            return results;
        }

        return results.filter((result) => {
            const domain = result.domain.toLowerCase();
            return !filteredDomains.some((filteredDomain) =>
                domain.includes(filteredDomain.toLowerCase()),
            );
        });
    }

    /**
     * 格式化搜索结果为引用文本
     */
    public formatSearchResults(searchResponse: SearchResponse): string {
        const { results, query } = searchResponse;

        if (!results || results.length === 0) {
            return '';
        }

        let formatted = `## 搜索结果 (查询: "${query}")\n\n`;

        results.forEach((result, index) => {
            formatted += `[${index + 1}] **${result.title}**\n`;
            formatted += `   ${result.snippet}\n`;
            formatted += `   来源: ${result.url}\n\n`;
        });

        return formatted;
    }

    /**
     * 从URL获取网页内容
     */
    private async fetchUrlContent(url: string): Promise<string> {
        try {
            logger.info(`Fetching content from URL: ${url}`);

            // 尝试直接fetch请求
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Cache-Control': 'no-cache',
                    },
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const html = await response.text();
                    const extractedContent = this.extractTextFromHtml(html);
                    if (extractedContent && extractedContent.length > 100) {
                        logger.info(`Successfully fetched content directly from ${url}`);
                        return extractedContent;
                    }
                }
            } catch (directError) {
                logger.warn(`Direct fetch failed for ${url}:`, directError);
            }

            return '';
        } catch (error) {
            logger.error(`Failed to fetch content from ${url}:`, error);
            return '';
        }
    }

    /**
     * 从HTML中提取纯文本内容
     */
    private extractTextFromHtml(html: string): string {
        try {
            // 移除脚本和样式标签
            let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
            cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            cleanHtml = cleanHtml.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

            // 移除HTML标签
            cleanHtml = cleanHtml.replace(/<[^>]+>/g, ' ');

            // 解码HTML实体
            cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');
            cleanHtml = cleanHtml.replace(/&amp;/g, '&');
            cleanHtml = cleanHtml.replace(/&lt;/g, '<');
            cleanHtml = cleanHtml.replace(/&gt;/g, '>');
            cleanHtml = cleanHtml.replace(/&quot;/g, '"');
            cleanHtml = cleanHtml.replace(/&#39;/g, "'");

            // 清理多余的空白字符
            cleanHtml = cleanHtml.replace(/\s+/g, ' ');
            cleanHtml = cleanHtml.trim();

            // 限制内容长度
            const maxLength = 8000; // 8KB的文本内容
            if (cleanHtml.length > maxLength) {
                cleanHtml = cleanHtml.substring(0, maxLength) + '...';
            }

            return cleanHtml;
        } catch (error) {
            logger.error('Failed to extract text from HTML:', error);
            return '';
        }
    }

    /**
     * 增强搜索结果，获取URL内容
     */
    public async enhanceSearchResultsWithContent(
        searchResponse: SearchResponse,
        maxUrls: number = 10,
    ): Promise<EnhancedSearchResponse> {
        logger.info(
            `Enhancing search results with content for ${searchResponse.results.length} results`,
        );

        const enhancedResults: EnhancedSearchResult[] = [];
        let contentFetched = false;

        // 选择前几个结果获取内容
        const urlsToFetch = searchResponse.results.slice(0, maxUrls);

        for (const result of urlsToFetch) {
            const enhancedResult: EnhancedSearchResult = {
                ...result,
                fetchedAt: new Date().toISOString(),
            };

            try {
                const content = await this.fetchUrlContent(result.url);
                if (content) {
                    enhancedResult.content = content;
                    enhancedResult.contentSummary = this.generateContentSummary(content);
                    contentFetched = true;
                    logger.info(`Enhanced result with content: ${result.title}`);
                } else {
                    logger.warn(`No content fetched for: ${result.title}`);
                }
            } catch (error) {
                logger.error(`Failed to enhance result ${result.title}:`, error);
            }

            enhancedResults.push(enhancedResult);
        }

        // 添加剩余的结果（不获取内容）
        const remainingResults = searchResponse.results.slice(maxUrls);
        enhancedResults.push(...remainingResults.map((result) => ({ ...result })));

        return {
            results: enhancedResults,
            query: searchResponse.query,
            engine: searchResponse.engine,
            contentFetched,
        };
    }

    /**
     * 生成内容摘要
     */
    private generateContentSummary(content: string): string {
        // 简单的摘要生成：取前500个字符
        const maxSummaryLength = 500;
        if (content.length <= maxSummaryLength) {
            return content;
        }

        // 尝试在句号处截断
        const truncated = content.substring(0, maxSummaryLength);
        const lastSentenceEnd = Math.max(
            truncated.lastIndexOf('.'),
            truncated.lastIndexOf('。'),
            truncated.lastIndexOf('!'),
            truncated.lastIndexOf('？'),
        );

        if (lastSentenceEnd > 200) {
            return truncated.substring(0, lastSentenceEnd + 1);
        }

        return truncated + '...';
    }

    /**
     * 格式化增强搜索结果为引用文本
     */
    public formatEnhancedSearchResults(searchResponse: EnhancedSearchResponse): string {
        const { results, query, contentFetched } = searchResponse;

        if (!results || results.length === 0) {
            return '';
        }

        let formatted = `## 搜索结果 (查询: "${query}")\n\n`;

        if (contentFetched) {
            formatted += `*已获取部分网页内容进行详细分析*\n\n`;
        }

        results.forEach((result, index) => {
            formatted += `[${index + 1}] **${result.title}**\n`;
            formatted += `   ${result.snippet}\n`;
            formatted += `   来源: ${result.url}\n`;

            if (result.content) {
                formatted += `   \n**网页内容摘要:**\n`;
                formatted += `   ${
                    result.contentSummary || result.content.substring(0, 300) + '...'
                }\n`;
            }

            formatted += `\n`;
        });

        return formatted;
    }
}

// 创建单例实例
let searchService: SearchService | null = null;

export const getSearchService = (rootStore: RootStore): SearchService => {
    if (!searchService) {
        searchService = new SearchService(rootStore);
    }
    return searchService;
};

export default SearchService;
