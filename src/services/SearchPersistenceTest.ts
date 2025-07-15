import { db } from '@/db';
import { createSearchResultsBlock } from '@/utils/message/create';
import { MessageBlockStatus } from '@/types/messageBlock';
import { Logger } from '@/utils/logger';

const logger = new Logger('SearchPersistenceTest');

/**
 * 测试搜索结果的持久化功能
 */
export async function testSearchResultsPersistence() {
    logger.info('Starting search results persistence test...');

    try {
        // 1. 创建测试数据
        const testMessageId = 'test-message-' + Date.now();
        const testQuery = 'test search query';
        const testResults = [
            {
                title: 'Test Result 1',
                url: 'https://example.com/1',
                snippet: 'This is a test search result',
                domain: 'example.com',
            },
            {
                title: 'Test Result 2',
                url: 'https://example.com/2',
                snippet: 'This is another test search result',
                domain: 'example.com',
            },
        ];
        const testEngine = 'test-engine';

        // 2. 创建搜索结果块
        const searchResultsBlock = createSearchResultsBlock(
            testMessageId,
            testQuery,
            testResults,
            testEngine,
            {
                status: MessageBlockStatus.SUCCESS,
                contentFetched: false,
            },
        );

        logger.info('Created test search results block:', {
            blockId: searchResultsBlock.id,
            messageId: searchResultsBlock.messageId,
            query: searchResultsBlock.query,
            resultsCount: searchResultsBlock.results.length,
        });

        // 3. 保存到数据库
        await db.message_blocks.put(JSON.parse(JSON.stringify(searchResultsBlock)));
        logger.info('Saved search results block to database');

        // 4. 从数据库读取
        const retrievedBlock = await db.message_blocks.get(searchResultsBlock.id);
        if (!retrievedBlock) {
            throw new Error('Failed to retrieve search results block from database');
        }

        logger.info('Retrieved search results block from database:', {
            blockId: retrievedBlock.id,
            messageId: retrievedBlock.messageId,
            type: retrievedBlock.type,
            query: 'query' in retrievedBlock ? retrievedBlock.query : 'N/A',
            resultsCount: 'results' in retrievedBlock ? retrievedBlock.results?.length : 0,
        });

        // 5. 验证数据完整性
        if (retrievedBlock.type !== 'search_results') {
            throw new Error('Retrieved block is not a search_results block');
        }

        const searchBlock = retrievedBlock as any;
        if (searchBlock.query !== testQuery) {
            throw new Error(`Query mismatch: expected "${testQuery}", got "${searchBlock.query}"`);
        }

        if (!searchBlock.results || searchBlock.results.length !== testResults.length) {
            throw new Error(
                `Results count mismatch: expected ${testResults.length}, got ${
                    searchBlock.results?.length || 0
                }`,
            );
        }

        // 6. 验证结果内容
        for (let i = 0; i < testResults.length; i++) {
            const expected = testResults[i];
            const actual = searchBlock.results[i];

            if (actual.title !== expected.title) {
                throw new Error(
                    `Result ${i} title mismatch: expected "${expected.title}", got "${actual.title}"`,
                );
            }

            if (actual.url !== expected.url) {
                throw new Error(
                    `Result ${i} URL mismatch: expected "${expected.url}", got "${actual.url}"`,
                );
            }
        }

        // 7. 清理测试数据
        await db.message_blocks.delete(searchResultsBlock.id);
        logger.info('Cleaned up test data');

        logger.info('✅ Search results persistence test PASSED');
        return true;
    } catch (error) {
        logger.error('❌ Search results persistence test FAILED:', error);
        return false;
    }
}

/**
 * 测试搜索结果的加载功能
 */
export async function testSearchResultsLoading() {
    logger.info('Starting search results loading test...');

    try {
        // 1. 查询数据库中的搜索结果块
        const searchResultsBlocks = await db.message_blocks
            .where('type')
            .equals('search_results')
            .toArray();

        logger.info(`Found ${searchResultsBlocks.length} search results blocks in database`);

        // 2. 验证每个搜索结果块的数据完整性
        for (const block of searchResultsBlocks) {
            const searchBlock = block as any;

            logger.info(`Checking search results block ${block.id}:`, {
                messageId: block.messageId,
                query: searchBlock.query || 'N/A',
                resultsCount: searchBlock.results?.length || 0,
                engine: searchBlock.engine || 'N/A',
                status: block.status,
            });

            // 验证必要字段
            if (!searchBlock.query) {
                logger.warn(`Search block ${block.id} missing query field`);
            }

            if (!searchBlock.results || !Array.isArray(searchBlock.results)) {
                logger.warn(`Search block ${block.id} missing or invalid results field`);
            }

            if (!searchBlock.engine) {
                logger.warn(`Search block ${block.id} missing engine field`);
            }

            // 验证结果数据
            if (searchBlock.results && Array.isArray(searchBlock.results)) {
                for (let i = 0; i < searchBlock.results.length; i++) {
                    const result = searchBlock.results[i];
                    if (!result.title || !result.url) {
                        logger.warn(`Search block ${block.id} result ${i} missing title or URL`);
                    }
                }
            }
        }

        logger.info('✅ Search results loading test PASSED');
        return true;
    } catch (error) {
        logger.error('❌ Search results loading test FAILED:', error);
        return false;
    }
}

/**
 * 运行所有搜索持久化测试
 */
export async function runAllSearchPersistenceTests() {
    logger.info('Running all search persistence tests...');

    const results = {
        persistence: await testSearchResultsPersistence(),
        loading: await testSearchResultsLoading(),
    };

    const allPassed = Object.values(results).every((result) => result);

    if (allPassed) {
        logger.info('🎉 All search persistence tests PASSED');
    } else {
        logger.error('💥 Some search persistence tests FAILED');
    }

    return results;
}
