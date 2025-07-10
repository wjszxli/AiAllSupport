import { SEARCH_ENGINES } from '@/utils/constant';
import { load } from 'cheerio';
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
     * 执行搜索
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
        // const minResults = 5; // 最少期望的搜索结果数量
        const maxResults = 15; // 最多搜索结果数量

        // 依次尝试启用的搜索引擎，收集结果直到达到期望数量
        for (const engine of settings.enabledSearchEngines) {
            try {
                logger.info(
                    `Trying search with engine: ${engine}, current results: ${allResults.length}`,
                );

                let results: SearchResult[];

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
                    case SEARCH_ENGINES.DUCKDUCKGO:
                        results = await this.searchWithDuckDuckGo(query);
                        break;
                    case SEARCH_ENGINES.SOGOU:
                        results = await this.searchWithSogou(query);
                        break;
                    case SEARCH_ENGINES.SEARXNG:
                        results = await this.searchWithSearXNG(query);
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

        // 如果结果仍然不够，尝试未启用的免费搜索引擎作为补充
        // if (allResults.length < minResults) {
        //     logger.info(
        //         `Only ${allResults.length} results found, trying additional engines for supplementation`,
        //     );

        //     const additionalEngines = [
        //         SEARCH_ENGINES.DUCKDUCKGO,
        //         SEARCH_ENGINES.SEARXNG,
        //         SEARCH_ENGINES.GOOGLE,
        //         SEARCH_ENGINES.BAIDU,
        //         SEARCH_ENGINES.BIYING,
        //     ].filter((engine) => !settings.enabledSearchEngines.includes(engine));

        //     for (const engine of additionalEngines.slice(0, 2)) {
        //         // 最多尝试2个额外引擎
        //         try {
        //             logger.info(`Trying additional engine: ${engine}`);

        //             let results: SearchResult[] = [];
        //             switch (engine) {
        //                 case SEARCH_ENGINES.GOOGLE:
        //                     results = await this.searchWithGoogle(query);
        //                     break;
        //                 case SEARCH_ENGINES.BAIDU:
        //                     results = await this.searchWithBaidu(query);
        //                     break;
        //                 case SEARCH_ENGINES.BIYING:
        //                     results = await this.searchWithBing(query);
        //                     break;
        //                 case SEARCH_ENGINES.DUCKDUCKGO:
        //                     results = await this.searchWithDuckDuckGo(query);
        //                     break;
        //                 case SEARCH_ENGINES.SEARXNG:
        //                     results = await this.searchWithSearXNG(query);
        //                     break;
        //             }

        //             if (results.length > 0) {
        //                 const existingUrls = new Set(allResults.map((r) => r.url));
        //                 const newResults = results.filter(
        //                     (result) => result.url && !existingUrls.has(result.url),
        //                 );

        //                 allResults.push(...newResults);
        //                 usedEngines.push(engine);

        //                 logger.info(
        //                     `Additional engine ${engine} added ${newResults.length} results, total: ${allResults.length}`,
        //                 );

        //                 if (allResults.length >= minResults) {
        //                     break;
        //                 }
        //             }
        //         } catch (error) {
        //             logger.error(`Additional search failed with engine ${engine}:`, error);
        //         }
        //     }
        // }

        // 检查是否有任何结果
        if (allResults.length === 0) {
            throw new Error('All search engines failed to return results');
        }

        // 过滤域名黑名单
        const filteredResults = this.filterResultsByDomain(allResults);

        // 限制最终结果数量并按相关性排序（这里简单按顺序）
        const finalResults = filteredResults.slice(0, maxResults);

        logger.info(
            `Search completed: used engines [${usedEngines.join(', ')}], final results: ${
                finalResults.length
            }`,
        );

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

        const response = await fetch('https://api.bochaai.com/v1/search', {
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
     * 使用Google搜索（免费）
     */
    private async searchWithGoogle(query: string): Promise<SearchResult[]> {
        try {
            // 使用Google Custom Search JSON API的公开搜索
            const searchUrl = `https://www.googleapis.com/customsearch/v1?key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw&cx=017576662512468239146:omuauf_lfve&q=${encodeURIComponent(
                query,
            )}&num=10`;

            try {
                const response = await fetch(searchUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    const results =
                        data.items?.map((item: any) => ({
                            title: item.title || '',
                            url: item.link || '',
                            snippet: item.snippet || '',
                            domain: this.extractDomain(item.link || ''),
                        })) || [];

                    if (results.length > 0) {
                        logger.info('Google search successful with Custom Search API');
                        return results;
                    }
                }
            } catch (apiError) {
                logger.warn('Google Custom Search API failed, trying alternative:', apiError);
            }

            // 备选方案：使用SERP API
            try {
                const serpResponse = await fetch(
                    `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
                        query,
                    )}&api_key=demo&num=10`,
                    {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json',
                        },
                    },
                );

                if (serpResponse.ok) {
                    const serpData = await serpResponse.json();
                    const serpResults =
                        serpData.organic_results?.map((result: any) => ({
                            title: result.title || '',
                            url: result.link || '',
                            snippet: result.snippet || '',
                            domain: this.extractDomain(result.link || ''),
                        })) || [];

                    if (serpResults.length > 0) {
                        logger.info('Google search successful with SERP API');
                        return serpResults;
                    }
                }
            } catch (serpError) {
                logger.warn('SERP API failed, trying web scraping:', serpError);
            }

            // 最后备选：网页抓取Google搜索结果
            return await this.scrapeGoogleSearch(query);
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
            // 使用百度搜索建议API
            const suggestionUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(
                query,
            )}&ie=utf-8&rn=20`;

            try {
                const response = await fetch(suggestionUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept':
                            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    },
                });

                if (response.ok) {
                    const html = await response.text();
                    const $ = load(html);
                    const results: SearchResult[] = [];

                    // 百度搜索结果通常在带有特定class的div中
                    $('.result, .c-container').each((i, element) => {
                        if (i >= 5) return false; // 只获取前5个结果

                        const titleElement = $(element).find('.t, .c-title');
                        const title = titleElement.text().trim();

                        // 获取链接（百度使用重定向链接）
                        let link = titleElement.find('a').attr('href') || '';

                        // 获取摘要
                        const snippet = $(element)
                            .find('.c-abstract, .content-abstract')
                            .text()
                            .trim();

                        // Only add result when title and link exist
                        if (title && link) {
                            results.push({
                                title,
                                url: link,
                                snippet,
                                domain: this.extractDomain(link || ''),
                                source: 'Baidu',
                            });
                        }

                        // Return true to continue iteration
                        return true;
                    });

                    if (results.length === 0) {
                        logger.warn('未能从百度搜索结果中提取数据，可能选择器需要更新');
                    }

                    return results;
                }
            } catch (suggestionError) {
                logger.warn('Baidu suggestion API failed:', suggestionError);
            }

            // 备选方案：生成静态百度搜索结果
            const staticResults = [
                {
                    title: `百度搜索: ${query}`,
                    url: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
                    snippet: `在百度上搜索"${query}"的结果`,
                    domain: 'baidu.com',
                },
            ];

            logger.info('Baidu search using static result');
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
            // 使用Bing搜索API
            return await this.scrapeBingSearch(query);
        } catch (error) {
            logger.error('Bing search failed:', error);
            return [];
        }
    }

    /**
     * 使用DuckDuckGo搜索（免费）
     */
    private async searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
        try {
            // 使用DuckDuckGo的即时答案API
            const response = await fetch(
                `https://api.duckduckgo.com/?q=${encodeURIComponent(
                    query,
                )}&format=json&no_html=1&skip_disambig=1`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                },
            );

            if (!response.ok) {
                throw new Error(
                    `DuckDuckGo search failed: ${response.status} ${response.statusText}`,
                );
            }

            const data = await response.json();
            const results: SearchResult[] = [];

            // 处理即时答案
            if (data.Abstract) {
                results.push({
                    title: data.Heading || 'DuckDuckGo即时答案',
                    url:
                        data.AbstractURL ||
                        `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                    snippet: data.Abstract,
                    domain: this.extractDomain(data.AbstractURL || 'duckduckgo.com'),
                });
            }

            // 处理相关主题
            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                data.RelatedTopics.slice(0, 9).forEach((topic: any) => {
                    if (topic.Text && topic.FirstURL) {
                        results.push({
                            title: topic.Text.split(' - ')[0] || topic.Text,
                            url: topic.FirstURL,
                            snippet: topic.Text,
                            domain: this.extractDomain(topic.FirstURL),
                        });
                    }
                });
            }

            // 如果结果太少，使用多个第三方DuckDuckGo搜索代理
            if (results.length < 3) {
                const proxyApis = [
                    `https://ddg-api.herokuapp.com/search?query=${encodeURIComponent(
                        query,
                    )}&limit=10`,
                    `https://duckduckgo-api.vercel.app/api/search?q=${encodeURIComponent(
                        query,
                    )}&limit=10`,
                ];

                for (const proxyApi of proxyApis) {
                    try {
                        // 创建AbortController用于超时控制
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 8000);

                        const proxyResponse = await fetch(proxyApi, {
                            method: 'GET',
                            headers: {
                                Accept: 'application/json',
                            },
                            signal: controller.signal,
                        });

                        clearTimeout(timeoutId);

                        if (proxyResponse.ok) {
                            const proxyData = await proxyResponse.json();
                            const proxyResults =
                                proxyData.results?.map((result: any) => ({
                                    title: result.title || '',
                                    url: result.link || result.url || '',
                                    snippet: result.snippet || result.description || '',
                                    domain: this.extractDomain(result.link || result.url || ''),
                                })) || [];

                            if (proxyResults.length > 0) {
                                results.push(...proxyResults);
                                logger.info(`DuckDuckGo proxy successful: ${proxyApi}`);
                                break; // 找到结果就停止尝试其他代理
                            }
                        }
                    } catch (proxyError) {
                        logger.warn(`DuckDuckGo proxy ${proxyApi} failed:`, proxyError);
                        continue; // 尝试下一个代理
                    }
                }
            }

            // 如果仍然结果太少，使用SearXNG作为最终备选
            if (results.length < 3) {
                try {
                    logger.info('Using SearXNG as final fallback for DuckDuckGo search');
                    const searxResults = await this.searchWithSearXNG(query, 'duckduckgo');
                    results.push(...searxResults);
                } catch (searxError) {
                    logger.warn('SearXNG fallback for DuckDuckGo failed:', searxError);
                }
            }

            return results.slice(0, 10);
        } catch (error) {
            logger.error('DuckDuckGo search failed:', error);
            return [];
        }
    }

    /**
     * 使用搜狗搜索（免费）
     */
    private async searchWithSogou(query: string): Promise<SearchResult[]> {
        try {
            // 使用搜狗搜索
            return await this.scrapeSogouSearch(query);
        } catch (error) {
            logger.error('Sogou search failed:', error);
            return [];
        }
    }

    /**
     * 网页抓取Google搜索结果
     */
    private async scrapeGoogleSearch(query: string): Promise<SearchResult[]> {
        try {
            // 使用无服务器函数或代理来抓取Google搜索结果
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;

            // 尝试使用AllOrigins代理服务
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;

            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                const htmlContent = data.contents;

                // 简单的HTML解析来提取搜索结果
                const results = this.parseGoogleResults(htmlContent);
                if (results.length > 0) {
                    logger.info('Google search successful with web scraping');
                    return results;
                }
            }

            logger.warn('Google web scraping failed');
            return [];
        } catch (error) {
            logger.error('Google web scraping failed:', error);
            return [];
        }
    }

    /**
     * 网页抓取必应搜索结果
     */
    private async scrapeBingSearch(query: string): Promise<SearchResult[]> {
        try {
            // 使用Bing搜索API
            const searchUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(
                query,
            )}&count=10`;

            try {
                // 尝试使用免费的Bing API演示密钥
                const response = await fetch(searchUrl, {
                    method: 'GET',
                    headers: {
                        'Ocp-Apim-Subscription-Key': 'demo-key',
                        'Accept': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    const results =
                        data.webPages?.value?.map((item: any) => ({
                            title: item.name || '',
                            url: item.url || '',
                            snippet: item.snippet || '',
                            domain: this.extractDomain(item.url || ''),
                        })) || [];

                    if (results.length > 0) {
                        logger.info('Bing search successful with API');
                        return results;
                    }
                }
            } catch (apiError) {
                logger.warn('Bing API failed, using fallback:', apiError);
            }

            // 备选方案：生成静态必应搜索结果
            const staticResults = [
                {
                    title: `必应搜索: ${query}`,
                    url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
                    snippet: `在必应上搜索"${query}"的结果`,
                    domain: 'bing.com',
                },
            ];

            logger.info('Bing search using static result');
            return staticResults;
        } catch (error) {
            logger.error('Bing search failed:', error);
            return [];
        }
    }

    /**
     * 网页抓取搜狗搜索结果
     */
    private async scrapeSogouSearch(query: string): Promise<SearchResult[]> {
        try {
            // 搜狗搜索没有公开API，生成搜索链接
            const staticResults = [
                {
                    title: `搜狗搜索: ${query}`,
                    url: `https://www.sogou.com/web?query=${encodeURIComponent(query)}`,
                    snippet: `在搜狗上搜索"${query}"的结果`,
                    domain: 'sogou.com',
                },
            ];

            logger.info('Sogou search using static result');
            return staticResults;
        } catch (error) {
            logger.error('Sogou search failed:', error);
            return [];
        }
    }

    /**
     * 解析Google搜索结果HTML
     */
    private parseGoogleResults(html: string): SearchResult[] {
        try {
            const results: SearchResult[] = [];

            // 简单的正则表达式来匹配Google搜索结果
            // 这个正则表达式匹配Google搜索结果的基本结构
            const titleRegex = /<h3[^>]*>([^<]+)<\/h3>/g;
            const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>/g;
            const snippetRegex = /<span[^>]*>([^<]{50,200})</g;

            let titleMatch;
            let linkMatch;
            let snippetMatch;

            const titles = [];
            const links = [];
            const snippets = [];

            while ((titleMatch = titleRegex.exec(html)) !== null) {
                titles.push(titleMatch[1]);
            }

            while ((linkMatch = linkRegex.exec(html)) !== null) {
                const url = linkMatch[1];
                if (url.startsWith('http') && !url.includes('google.com')) {
                    links.push(url);
                }
            }

            while ((snippetMatch = snippetRegex.exec(html)) !== null) {
                snippets.push(snippetMatch[1]);
            }

            // 组合结果
            const maxResults = Math.min(titles.length, links.length, 10);
            for (let i = 0; i < maxResults; i++) {
                if (titles[i] && links[i]) {
                    results.push({
                        title: titles[i],
                        url: links[i],
                        snippet: snippets[i] || '',
                        domain: this.extractDomain(links[i]),
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Failed to parse Google results:', error);
            return [];
        }
    }

    /**
     * 使用SearXNG搜索（免费）
     */
    private async searchWithSearXNG(query: string, engine?: string): Promise<SearchResult[]> {
        try {
            // 使用更可靠的公共SearXNG实例
            const searxInstances = [
                'https://searx.org',
                'https://searx.space',
                'https://search.disroot.org',
                'https://searx.laquadrature.net',
                'https://searx.mastodon.host',
                'https://searx.semipvt.com',
                'https://search.snopyta.org',
            ];

            let engineParam = '';
            if (engine) {
                // 指定搜索引擎
                const engineMap: { [key: string]: string } = {
                    google: 'google',
                    bing: 'bing',
                    baidu: 'baidu',
                    sogou: 'sogou',
                    duckduckgo: 'duckduckgo',
                };
                engineParam = engineMap[engine] ? `&engines=${engineMap[engine]}` : '';
            }

            for (const instance of searxInstances) {
                try {
                    // 创建AbortController用于超时控制
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const response = await fetch(
                        `${instance}/search?q=${encodeURIComponent(
                            query,
                        )}&format=json${engineParam}`,
                        {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent':
                                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            },
                            signal: controller.signal,
                        },
                    );

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        continue; // 尝试下一个实例
                    }

                    const data = await response.json();

                    if (data.results && data.results.length > 0) {
                        const results = data.results.slice(0, 10).map((result: any) => ({
                            title: result.title || '',
                            url: result.url || '',
                            snippet: result.content || result.description || '',
                            domain: this.extractDomain(result.url || ''),
                        }));

                        logger.info(`SearXNG search successful with instance: ${instance}`);
                        return results;
                    }
                } catch (instanceError) {
                    logger.warn(`SearXNG instance ${instance} failed:`, instanceError);
                    continue; // 尝试下一个实例
                }
            }

            throw new Error('All SearXNG instances failed');
        } catch (error) {
            logger.error('SearXNG search failed:', error);
            return [];
        }
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

            // 使用代理服务获取网页内容，避免CORS问题
            const proxyUrls = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                `https://cors-anywhere.herokuapp.com/${url}`,
                `https://thingproxy.freeboard.io/fetch/${url}`,
            ];

            let content = '';

            for (const proxyUrl of proxyUrls) {
                try {
                    // 创建AbortController用于超时控制
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

                    const response = await fetch(proxyUrl, {
                        method: 'GET',
                        headers: {
                            'Accept':
                                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        },
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        let responseText = '';

                        if (proxyUrl.includes('allorigins.win')) {
                            const data = await response.json();
                            responseText = data.contents || '';
                        } else {
                            responseText = await response.text();
                        }

                        if (responseText) {
                            content = this.extractTextFromHtml(responseText);
                            if (content.length > 100) {
                                // 确保获取到了有效内容
                                logger.info(
                                    `Successfully fetched content from ${url} using ${proxyUrl}`,
                                );
                                break;
                            }
                        }
                    }
                } catch (proxyError) {
                    logger.warn(`Proxy ${proxyUrl} failed for ${url}:`, proxyError);
                    continue;
                }
            }

            // 如果代理失败，尝试直接请求
            if (!content) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept':
                                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        },
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const html = await response.text();
                        content = this.extractTextFromHtml(html);
                        logger.info(`Successfully fetched content directly from ${url}`);
                    }
                } catch (directError) {
                    logger.warn(`Direct fetch failed for ${url}:`, directError);
                }
            }

            return content || '';
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
