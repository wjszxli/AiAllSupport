import { load } from 'cheerio';

import type { SearchResult } from '@/services/SearchService';
import { initLogger, Logger } from '@/utils';

// 延迟创建Logger实例，避免初始化顺序问题
let logger: Logger;

// Initialize logger
initLogger().then((config) => {
    // 在initLogger完成后创建Logger实例
    logger = new Logger('background');
    logger.debug('Logger initialized with config', config);
});

/**
 * 在 background script 中执行搜索，绕过跨域限制
 */
export async function performSearchInBackground(
    query: string,
    engine: string,
): Promise<SearchResult[]> {
    try {
        logger.info(`执行搜索: ${engine} - ${query}`);

        // 添加整体超时机制
        const timeoutPromise = new Promise<SearchResult[]>((_, reject) => {
            setTimeout(() => reject(new Error('搜索超时')), 25000); // 25秒超时，比前端的30秒稍短
        });

        const searchPromise = async (): Promise<SearchResult[]> => {
            switch (engine) {
                case 'google':
                    return await searchGoogle(query);
                case 'baidu':
                    return await searchBaidu(query);
                case 'biying':
                    return await searchBing(query);
                case 'sogou':
                    return await searchSogou(query);
                default:
                    throw new Error(`不支持的搜索引擎: ${engine}`);
            }
        };

        // 使用Promise.race来实现超时
        const results = await Promise.race([searchPromise(), timeoutPromise]);

        logger.info(`搜索完成: ${engine} - 找到 ${results.length} 个结果`);
        return results;
    } catch (error) {
        logger.error(`搜索失败 (${engine}):`, error);
        // 即使搜索失败，也返回空数组而不是抛出错误，避免消息端口关闭
        return [];
    }
}

/**
 * Google 搜索实现
 */
async function searchGoogle(query: string): Promise<SearchResult[]> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=zh-CN`;

    try {
        logger.info(`获取Google搜索页面: ${searchUrl}`);

        // 添加请求超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        logger.info(`获取到Google HTML内容，长度: ${html.length}`);

        return parseGoogleResults(html);
    } catch (error) {
        logger.error('Google搜索失败:', error);
        return []; // 返回空数组而不是抛出错误
    }
}

/**
 * 百度搜索实现
 */
async function searchBaidu(query: string): Promise<SearchResult[]> {
    const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&ie=utf-8`;

    try {
        logger.info(`获取百度搜索页面: ${searchUrl}`);

        // 添加请求超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        logger.info(`获取到百度HTML内容，长度: ${html.length}`);

        return parseBaiduResults(html);
    } catch (error) {
        logger.error('百度搜索失败:', error);
        return []; // 返回空数组而不是抛出错误
    }
}

/**
 * 必应搜索实现
 */
async function searchBing(query: string): Promise<SearchResult[]> {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&mkt=zh-CN`;

    try {
        logger.info(`获取必应搜索页面: ${searchUrl}`);

        // 添加请求超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        logger.info(`获取到必应HTML内容，长度: ${html.length}`);

        return parseBingResults(html);
    } catch (error) {
        logger.error('必应搜索失败:', error);
        return []; // 返回空数组而不是抛出错误
    }
}

/**
 * 搜狗搜索实现
 */
async function searchSogou(query: string): Promise<SearchResult[]> {
    const searchUrl = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;

    try {
        logger.info(`获取搜狗搜索页面: ${searchUrl}`);

        // 添加请求超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        logger.info(`获取到搜狗HTML内容，长度: ${html.length}`);

        return parseSogouResults(html);
    } catch (error) {
        logger.error('搜狗搜索失败:', error);
        return []; // 返回空数组而不是抛出错误
    }
}

/**
 * 解析Google搜索结果 - 使用cheerio，参考开源项目优化
 */
function parseGoogleResults(html: string): SearchResult[] {
    try {
        logger.info('开始解析Google HTML结果');

        const results: SearchResult[] = [];
        const $ = load(html);

        // 使用更精确的选择器，参考开源项目
        $('#search .MjjYud').each((i, element) => {
            if (i >= 10) return false; // 只获取前10个结果

            // 查找标题 - 直接查找h3元素
            const titleElement = $(element).find('h3').first();
            const title = titleElement.text().trim();

            // 查找链接 - 直接查找a元素
            const linkElement = $(element).find('a').first();
            let url = linkElement.attr('href') || '';

            // 处理Google重定向链接
            if (url.includes('/url?q=')) {
                const urlMatch = url.match(/[?&]q=([^&]+)/);
                if (urlMatch) {
                    try {
                        url = decodeURIComponent(urlMatch[1]);
                    } catch (e) {
                        logger.warn('解码URL失败:', e);
                    }
                }
            }

            // 获取摘要 - 查找摘要内容
            let snippet = $(element)
                .find('.VwiC3b, .yXK7lf, .st, .IsZvec, .s3v9rd .MUxGbd, .hgKElc, .Uroaid')
                .first()
                .text()
                .trim();

            // 如果没有找到摘要，尝试其他选择器
            if (!snippet) {
                snippet = $(element)
                    .find('[data-sncf] .VwiC3b, [data-snf] .VwiC3b')
                    .first()
                    .text()
                    .trim();
            }

            // 清理摘要中的日期前缀和多余空白
            if (snippet) {
                snippet = snippet.replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*—\s*/, '').trim();
            }

            // 只有当标题和链接都存在且URL有效时才添加结果
            if (title && url && url.startsWith('http')) {
                results.push({
                    title,
                    url,
                    snippet,
                    domain: extractDomain(url),
                    source: 'Google',
                });
                logger.debug(`Google结果 ${i + 1}: ${title} - ${url}`);
            } else {
                logger.debug(`跳过无效结果 ${i + 1}: title="${title}", url="${url}"`);
            }

            return true;
        });

        if (results.length === 0) {
            logger.warn('未能从Google搜索结果中提取数据，可能选择器需要更新');
            logger.debug('HTML结构示例:', $.html().substring(0, 2000));
        }

        logger.info(`Google解析完成，共找到 ${results.length} 个有效结果`);
        return results;
    } catch (error) {
        logger.error('解析Google HTML结果失败:', error);
        return [];
    }
}

/**
 * 解析百度搜索结果 - 使用cheerio
 */
function parseBaiduResults(html: string): SearchResult[] {
    try {
        logger.info(`开始解析百度HTML结果：${html}`);

        const results: SearchResult[] = [];
        const $ = load(html);

        $('.result, .c-container').each((i, element) => {
            if (i >= 10) return false; // 只获取前5个结果

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
                    url: link,
                    domain: extractDomain(link),
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
    } catch (error) {
        logger.error('解析百度HTML结果失败:', error);
        return [];
    }
}

/**
 * 解析必应搜索结果 - 使用cheerio
 */
function parseBingResults(html: string): SearchResult[] {
    try {
        logger.info('开始解析必应HTML结果');

        const results: SearchResult[] = [];
        const $ = load(html);

        $('.b_algo').each((i, element) => {
            if (i >= 10) return false; // 只获取前10个结果

            const titleElement = $(element).find('h2 a');
            const title = titleElement.text().trim();
            const url = titleElement.attr('href') || '';

            // 获取摘要
            const snippet = $(element).find('.b_caption p, .b_descript').first().text().trim();

            // Only add result when title and url exist and url is valid
            if (title && url && url.startsWith('http')) {
                results.push({
                    title,
                    url,
                    snippet,
                    domain: extractDomain(url),
                    source: 'Bing',
                });
            }

            return true;
        });

        if (results.length === 0) {
            logger.warn('未能从必应搜索结果中提取数据，可能选择器需要更新');
        }

        logger.info(`必应解析完成，共找到 ${results.length} 个有效结果`);
        return results;
    } catch (error) {
        logger.error('解析必应HTML结果失败:', error);
        return [];
    }
}

/**
 * 解析搜狗搜索结果 - 使用cheerio
 */
function parseSogouResults(html: string): SearchResult[] {
    try {
        logger.info('开始解析搜狗HTML结果');

        const results: SearchResult[] = [];
        const $ = load(html);

        // 更新选择器以匹配新的搜狗结构
        $('.vrwrap, .result, .results .rb').each((i, element) => {
            if (i >= 10) return false; // 只获取前10个结果

            // 查找标题和链接 - 新的搜狗结构
            const titleLinkElement = $(element)
                .find('h3.vr-title a, .vr-title a, h3 a, .title a')
                .first();

            // 获取标题
            let title = titleLinkElement.text().trim();

            // 清理标题中的HTML标记
            if (title) {
                // 移除搜狗搜索结果中的高亮标记
                title = title.replace(/<!--red_beg-->|<!--red_end-->/g, '').trim();
            }

            // 获取URL
            let url = titleLinkElement.attr('href') || '';

            // 处理搜狗重定向链接
            if (url.includes('/link?url=')) {
                const urlMatch = url.match(/\/link\?url=([^&]+)/);
                if (urlMatch) {
                    try {
                        // 搜狗的URL编码比较复杂，需要特殊处理
                        const encodedUrl = urlMatch[1];
                        if (encodedUrl.startsWith('http')) {
                            url = encodedUrl;
                        } else {
                            // 尝试解码
                            url = decodeURIComponent(encodedUrl);
                        }
                    } catch (e) {
                        logger.warn('解码搜狗URL失败:', e);
                    }
                }
            }

            // 处理搜狗相对URL
            if (url.startsWith('//')) {
                url = 'https:' + url;
            }

            // 获取摘要 - 新的搜狗结构
            let snippet = $(element)
                .find('.fz-mid.space-txt, .ft, .str_info, .space-txt')
                .first()
                .text()
                .trim();

            // 如果没有找到摘要，尝试其他选择器
            if (!snippet) {
                snippet = $(element)
                    .find('#cacheresult_summary_' + (i + 1))
                    .text()
                    .trim();
            }

            // 如果还是没有找到，尝试查找step-cont类
            if (!snippet) {
                const stepContent = $(element).find('.step-cont').first().text().trim();
                if (stepContent) {
                    snippet = stepContent;
                }
            }

            // 清理摘要内容
            if (snippet) {
                // 移除日期前缀
                snippet = snippet.replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*[-—]\s*/, '').trim();
                // 移除搜狗搜索结果中的高亮标记
                snippet = snippet.replace(/<!--red_beg-->|<!--red_end-->/g, '').trim();
            }

            // Only add result when title and url exist and url is valid
            if (title && url && url.startsWith('http')) {
                results.push({
                    title,
                    url,
                    snippet,
                    domain: extractDomain(url),
                    source: 'Sogou',
                });
                logger.debug(`搜狗结果 ${i + 1}: ${title} - ${url}`);
            } else {
                logger.debug(`跳过无效搜狗结果 ${i + 1}: title="${title}", url="${url}"`);
            }

            return true;
        });

        if (results.length === 0) {
            logger.warn('未能从搜狗搜索结果中提取数据，可能选择器需要更新');
            logger.debug('搜狗HTML结构示例:', $.html().substring(0, 2000));
        }

        logger.info(`搜狗解析完成，共找到 ${results.length} 个有效结果`);
        return results;
    } catch (error) {
        logger.error('解析搜狗HTML结果失败:', error);
        return [];
    }
}

/**
 * 从URL提取域名
 */
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return '';
    }
}
