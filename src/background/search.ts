import { load } from 'cheerio';
import { tavily } from '@tavily/core';
import { t } from '@/locales/i18n';
import { initLogger, Logger } from '@/utils';
import storage from '@/utils/storage';
import type { SearchResult } from '@/types';
import { SEARCH_ENGINES } from '@/utils/constant';

const logger = new Logger('background');
initLogger().then((config) => {
    logger.info('Logger initialized with config', config);
});

// 用于网页搜索的函数，支持多个搜索引擎
export async function searchWeb(query: string): Promise<SearchResult[]> {
    try {
        logger.info('Executing multi-search engine search', { query });

        // 获取配置
        const [enabledEngines, filteredDomains] = await Promise.all([
            storage.getEnabledSearchEngines(),
            storage.getFilteredDomains(),
        ]);

        logger.debug('Enabled search engines', { enabledEngines });
        logger.debug('Filtered domains', { filteredDomains });

        // 创建搜索引擎函数映射
        const searchFunctions: Record<string, (query: string) => Promise<SearchResult[]>> = {
            [SEARCH_ENGINES.BAIDU]: searchBaidu,
            [SEARCH_ENGINES.GOOGLE]: searchGoogle,
            [SEARCH_ENGINES.DUCKDUCKGO]: searchDuckDuckGo,
            [SEARCH_ENGINES.SOGOU]: searchSogou,
            [SEARCH_ENGINES.BRAVE]: searchBrave,
            [SEARCH_ENGINES.SEARXNG]: searchSearxng,
            [SEARCH_ENGINES.TAVILY]: searchTavily,
        };

        // 获取启用的搜索函数
        const enabledSearchFunctions = enabledEngines
            .filter((engine) => searchFunctions[engine])
            .map((engine) => searchFunctions[engine]);

        if (enabledSearchFunctions.length === 0) {
            console.log('没有启用的搜索引擎');
            return [];
        }

        // 并行执行启用的搜索引擎的请求
        const results = await Promise.allSettled(enabledSearchFunctions.map((fn) => fn(query)));

        // 合并结果
        let combinedResults: SearchResult[] = [];

        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                combinedResults.push(...result.value);
            }
        });

        // 过滤掉来自特定域名的结果（如知乎）
        if (filteredDomains.length > 0) {
            const beforeFilterCount = combinedResults.length;

            combinedResults = combinedResults.filter((result) => {
                // 检查结果链接是否包含要过滤的域名
                return !filteredDomains.some((domain) => result.link.includes(domain));
            });

            const filteredCount = beforeFilterCount - combinedResults.length;
            if (filteredCount > 0) {
                console.log(
                    `已过滤掉 ${filteredCount} 个来自以下域名的结果: ${filteredDomains.join(', ')}`,
                );
            }
        }

        // 如果所有搜索引擎都没有返回结果
        if (combinedResults.length === 0) {
            console.log('所有搜索引擎均未返回结果或结果已被过滤');
        }

        return combinedResults;
    } catch (error: any) {
        logger.error('Search web error', error);
        return [];
    }
}

// 百度搜索函数
export async function searchBaidu(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行百度搜索:', query);

        // 使用百度搜索
        const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&ie=utf-8&rn=20`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(t('baiduSearchFailed').replace('{status}', response.status.toString()));
        }

        const html = await response.text();

        // 使用cheerio解析百度搜索结果HTML
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
            const snippet = $(element).find('.c-abstract, .content-abstract').text().trim();

            // Only add result when title and link exist
            if (title && link) {
                results.push({
                    title,
                    link,
                    snippet,
                    source: 'Baidu',
                });
            }

            // Return true to continue iteration
            return true;
        });

        if (results.length === 0) {
            console.log('未能从百度搜索结果中提取数据，可能选择器需要更新');
        }

        return results;
    } catch (error: any) {
        console.error('百度搜索失败:', error);
        // 搜索失败时返回空数组
        return [];
    }
}

// Google搜索函数
export async function searchGoogle(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行Google搜索:', query);

        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(
                t('googleSearchFailed').replace('{status}', response.status.toString()),
            );
        }

        const html = await response.text();

        // 使用cheerio解析Google搜索结果HTML
        const $ = load(html);
        const results: SearchResult[] = [];

        // Google搜索结果选择器
        $('div.g').each((i, element) => {
            if (i >= 5) return false; // 只获取前5个结果

            const titleElement = $(element).find('h3');
            const title = titleElement.text().trim();

            // 获取链接
            const linkElement = $(element).find('a');
            const link = linkElement.attr('href') || '';

            // 获取摘要
            const snippetElement = $(element).find('div.VwiC3b');
            const snippet = snippetElement.text().trim();

            if (title && link && link.startsWith('http')) {
                results.push({
                    title,
                    link,
                    snippet,
                    source: 'Google',
                });
            }

            return true;
        });

        if (results.length === 0) {
            console.log('未能从Google搜索结果中提取数据，可能选择器需要更新');
        }

        return results;
    } catch (error: any) {
        console.error('Google搜索失败:', error);
        return [];
    }
}

// DuckDuckGo搜索函数
export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行DuckDuckGo搜索:', query);

        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(
                t('duckduckgoSearchFailed').replace('{status}', response.status.toString()),
            );
        }

        const html = await response.text();

        // 使用cheerio解析DuckDuckGo搜索结果HTML
        const $ = load(html);
        const results: SearchResult[] = [];

        // DuckDuckGo搜索结果选择器
        $('.result').each((i, element) => {
            if (i >= 5) return false; // 只获取前5个结果

            const titleElement = $(element).find('.result__title');
            const title = titleElement.text().trim();

            // 获取链接
            const linkElement = $(element).find('.result__url');
            let link = linkElement.attr('href') || '';

            // 获取摘要
            const snippetElement = $(element).find('.result__snippet');
            const snippet = snippetElement.text().trim();

            if (title && link) {
                results.push({
                    title,
                    link,
                    snippet,
                    source: 'DuckDuckGo',
                });
            }

            return true;
        });

        if (results.length === 0) {
            console.log('未能从DuckDuckGo搜索结果中提取数据，可能选择器需要更新');
        }

        return results;
    } catch (error: any) {
        console.error('DuckDuckGo搜索失败:', error);
        return [];
    }
}

// 搜狗搜索函数
export async function searchSogou(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行搜狗搜索:', query);

        const searchUrl = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(t('sogouSearchFailed').replace('{status}', response.status.toString()));
        }

        const html = await response.text();

        // 使用cheerio解析搜狗搜索结果HTML
        const $ = load(html);
        const results: SearchResult[] = [];

        // 搜狗搜索结果选择器
        $('.vrwrap, .rb').each((i, element) => {
            if (i >= 5) return false; // 只获取前5个结果

            const titleElement = $(element).find('.pt, .vr-title');
            const title = titleElement.text().trim();

            // 获取链接
            const linkElement = $(element).find('a');
            let link = linkElement.attr('href') || '';

            // 获取摘要
            const snippetElement = $(element).find('.ft, .vr-summary');
            const snippet = snippetElement.text().trim();

            if (title && link) {
                results.push({
                    title,
                    link,
                    snippet,
                    source: 'Sogou',
                });
            }

            return true;
        });

        if (results.length === 0) {
            console.log('未能从搜狗搜索结果中提取数据，可能选择器需要更新');
        }

        return results;
    } catch (error: any) {
        console.error('搜狗搜索失败:', error);
        return [];
    }
}

// Brave搜索函数
export async function searchBrave(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行Brave搜索:', query);

        const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(t('braveSearchFailed').replace('{status}', response.status.toString()));
        }

        const html = await response.text();

        // 使用cheerio解析Brave搜索结果HTML
        const $ = load(html);
        const results: SearchResult[] = [];

        // Brave搜索结果选择器
        $('.snippet').each((i, element) => {
            if (i >= 5) return false; // 只获取前5个结果

            const titleElement = $(element).find('.snippet-title');
            const title = titleElement.text().trim();

            // 获取链接
            const linkElement = $(element).find('.result-header a');
            let link = linkElement.attr('href') || '';

            // 获取摘要
            const snippetElement = $(element).find('.snippet-description');
            const snippet = snippetElement.text().trim();

            if (title && link) {
                results.push({
                    title,
                    link,
                    snippet,
                    source: 'Brave',
                });
            }

            return true;
        });

        if (results.length === 0) {
            console.log('未能从Brave搜索结果中提取数据，可能选择器需要更新');
        }

        return results;
    } catch (error: any) {
        console.error('Brave搜索失败:', error);
        return [];
    }
}

// SearXNG搜索函数
export async function searchSearxng(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行SearXNG搜索:', query);

        // 使用公共的SearXNG实例，可以根据需要更改
        const searchUrl = `https://searx.be/search?q=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(
                t('searxngSearchFailed').replace('{status}', response.status.toString()),
            );
        }

        const html = await response.text();

        // 使用cheerio解析SearXNG搜索结果HTML
        const $ = load(html);
        const results: SearchResult[] = [];

        // SearXNG搜索结果选择器
        $('.result').each((i, element) => {
            if (i >= 5) return false; // 只获取前5个结果

            const titleElement = $(element).find('h4');
            const title = titleElement.text().trim();

            // 获取链接
            const linkElement = $(element).find('h4 a');
            let link = linkElement.attr('href') || '';

            // 获取摘要
            const snippetElement = $(element).find('.result-content');
            const snippet = snippetElement.text().trim();

            if (title && link) {
                results.push({
                    title,
                    link,
                    snippet,
                    source: 'SearXNG',
                });
            }

            return true;
        });

        if (results.length === 0) {
            console.log('未能从SearXNG搜索结果中提取数据，可能选择器需要更新');
        }

        return results;
    } catch (error: any) {
        console.error('SearXNG搜索失败:', error);
        return [];
    }
}

// Tavily搜索函数 - 使用 @tavily/core 库
export async function searchTavily(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行Tavily搜索:', query);

        // 获取Tavily API密钥
        const apiKey = await storage.getTavilyApiKey();
        if (!apiKey) {
            console.error('未配置Tavily API密钥');
            return [];
        }

        // 创建 Tavily 客户端
        const tvly = tavily({ apiKey });

        // 执行搜索
        const response = await tvly.search(query, {
            searchDepth: 'basic',
            maxResults: 5,
        });
        console.log('Tavily搜索结果:', response);

        // 将 Tavily 返回的结果转换为应用所需的 SearchResult 格式
        const results: SearchResult[] = [];

        if (response.results && Array.isArray(response.results)) {
            response.results.forEach((item) => {
                if (item.title && item.url) {
                    results.push({
                        title: item.title,
                        link: item.url,
                        snippet: item.content || '',
                        source: 'Tavily',
                    });
                }
            });
        }

        if (results.length === 0) {
            console.log('未从Tavily API获取到搜索结果');
        }

        return results;
    } catch (error: any) {
        console.error('Tavily搜索失败:', error);
        return [];
    }
}

// 专门用于获取网页内容的函数
export async function fetchWebPage(url: string): Promise<string> {
    try {
        console.log('获取网页内容:', url);

        // 处理各搜索引擎的重定向链接
        let targetUrl = url;

        // 检查是否是搜索引擎的重定向链接
        if (
            // 百度重定向链接
            url.startsWith('http://www.baidu.com/link?') ||
            url.startsWith('https://www.baidu.com/link?') ||
            // Google重定向链接
            url.includes('google.com/url?') ||
            // DuckDuckGo重定向链接
            url.includes('duckduckgo.com/l/?') ||
            // 搜狗重定向链接
            url.includes('sogou.com/link?') ||
            // Brave和SearXNG可能使用不同的重定向机制，添加对应的检测条件
            url.includes('search.brave.com/outgoing?') ||
            url.includes('searx.be/r?')
        ) {
            console.log('检测到搜索引擎重定向链接，获取真实URL');

            try {
                const redirectResponse = await fetch(url, {
                    method: 'GET',
                    redirect: 'manual', // 不自动跟随重定向，以便我们获取Location头
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                    },
                });

                // 检查是否是重定向响应
                if (redirectResponse.status === 302 || redirectResponse.status === 301) {
                    const location = redirectResponse.headers.get('Location');
                    if (location) {
                        targetUrl = location;
                        console.log('获取到真实URL:', targetUrl);
                    }
                } else if (redirectResponse.ok) {
                    // 有些搜索引擎可能不使用HTTP重定向，而是在URL参数中包含目标URL
                    // 例如Google的url参数，DuckDuckGo的uddg参数
                    const urlObj = new URL(url);

                    if (url.includes('google.com/url?')) {
                        const googleUrl = urlObj.searchParams.get('url');
                        if (googleUrl) {
                            targetUrl = googleUrl;
                            console.log('从Google URL参数中提取目标URL:', targetUrl);
                        }
                    } else if (url.includes('duckduckgo.com/l/?')) {
                        const duckUrl = urlObj.searchParams.get('uddg');
                        if (duckUrl) {
                            targetUrl = duckUrl;
                            console.log('从DuckDuckGo URL参数中提取目标URL:', targetUrl);
                        }
                    } else if (url.includes('search.brave.com/outgoing?')) {
                        const braveUrl = urlObj.searchParams.get('url');
                        if (braveUrl) {
                            targetUrl = braveUrl;
                            console.log('从Brave URL参数中提取目标URL:', targetUrl);
                        }
                    } else if (url.includes('searx.be/r?')) {
                        const searxUrl = urlObj.searchParams.get('url');
                        if (searxUrl) {
                            targetUrl = searxUrl;
                            console.log('从SearXNG URL参数中提取目标URL:', targetUrl);
                        }
                    } else if (url.includes('sogou.com/link?')) {
                        const sogouUrl = urlObj.searchParams.get('url');
                        if (sogouUrl) {
                            targetUrl = sogouUrl;
                            console.log('从搜狗URL参数中提取目标URL:', targetUrl);
                        }
                    }
                }
            } catch (redirectError) {
                console.error('获取真实URL失败:', redirectError);
                // 如果获取真实URL失败，继续使用原始URL
            }
        }

        // 获取网页内容
        console.log('正在获取页面内容，URL:', targetUrl);

        // 创建一个请求，使用合适的User-Agent以模拟浏览器
        const contentResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        });

        if (!contentResponse.ok) {
            throw new Error(
                `Failed to fetch page: ${contentResponse.status} ${contentResponse.statusText}`,
            );
        }

        const html = await contentResponse.text();

        // 使用cheerio解析HTML
        const $ = load(html);

        // 移除不需要的元素
        $('script, style, meta, link, noscript, svg, iframe, img').remove();

        // 获取标题
        const title = $('title').text().trim();

        // 获取正文内容，规范化空白
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

        // 限制内容长度
        const maxContentLength = 5000;
        let content =
            bodyText.length > maxContentLength
                ? bodyText.substring(0, maxContentLength) + '...'
                : bodyText;

        return `${title}\n\n${content}`;
    } catch (error: any) {
        console.error('Failed to fetch web content:', error);
        return `Error fetching content from ${url}: ${error.message || 'Unknown error'}`;
    }
}
