import {
    runAllSearchPersistenceTests,
    testSearchResultsPersistence,
    testSearchResultsLoading,
} from '@/services/SearchPersistenceTest';
import { Logger } from '@/utils/logger';

const logger = new Logger('Debug');

/**
 * 调试工具函数
 */
export const debugUtils = {
    // 搜索持久化测试
    testSearchPersistence: runAllSearchPersistenceTests,
    testSearchResultsPersistence,
    testSearchResultsLoading,

    // 数据库检查
    async checkDatabase() {
        try {
            const { db } = await import('@/db');

            // 检查数据库表
            const tables = ['topics', 'message_blocks', 'robots'];
            for (const tableName of tables) {
                const table = (db as any)[tableName];
                if (table) {
                    const count = await table.count();
                    logger.info(`Table ${tableName}: ${count} records`);
                } else {
                    logger.warn(`Table ${tableName} not found`);
                }
            }

            // 检查搜索结果块
            const searchBlocks = await db.message_blocks
                .where('type')
                .equals('search_results')
                .toArray();

            logger.info(`Found ${searchBlocks.length} search results blocks`);

            if (searchBlocks.length > 0) {
                logger.info(
                    'Search results blocks:',
                    searchBlocks.map((b) => ({
                        id: b.id,
                        messageId: b.messageId,
                        query: (b as any).query || 'N/A',
                        resultsCount: (b as any).results?.length || 0,
                        status: b.status,
                    })),
                );
            }

            return {
                tables: tables.length,
                searchBlocks: searchBlocks.length,
            };
        } catch (error) {
            logger.error('Database check failed:', error);
            return null;
        }
    },

    // 清理测试数据
    async cleanupTestData() {
        try {
            const { db } = await import('@/db');

            // 删除测试消息块
            const testBlocks = await db.message_blocks
                .where('messageId')
                .startsWith('test-message-')
                .toArray();

            if (testBlocks.length > 0) {
                await db.message_blocks.bulkDelete(testBlocks.map((b) => b.id));
                logger.info(`Cleaned up ${testBlocks.length} test blocks`);
            }

            return testBlocks.length;
        } catch (error) {
            logger.error('Cleanup failed:', error);
            return 0;
        }
    },

    // 日志级别控制
    setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
        logger.info(`Setting log level to: ${level}`);
        // 这里可以添加全局日志级别设置逻辑
    },
};

// 在开发环境中将调试工具暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).debugUtils = debugUtils;
    logger.info('Debug utilities available at window.debugUtils');
}

export default debugUtils;
