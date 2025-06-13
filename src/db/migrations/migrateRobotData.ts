import { db } from '@/db';
import robotStore from '@/store/robot';
import robotDB from '@/db/robotDB';
import { message } from 'antd';

/**
 * Migrates robot data from the old MobX store to the new IndexedDB database
 */
export const migrateRobotData = async () => {
    try {
        // Check if we've already migrated (look for robots in DB)
        const existingRobots = await db.table('robots').toArray();

        // If we already have robots in the DB, skip migration
        if (existingRobots.length > 0) {
            console.log('Robot data already migrated, skipping migration.');
            return true;
        }

        // Get robots from the old store
        const robots = robotStore.robotList;

        if (!robots.length) {
            console.warn('No robots found in the old store to migrate.');
            return false;
        }

        console.log(`Migrating ${robots.length} robots from store to database...`);

        // Save each robot to the database
        for (const robot of robots) {
            await db.table('robots').put(robot);

            // Also ensure topics are in the topics table
            for (const topic of robot.topics) {
                // Check if this topic already exists in the topics table
                const existingTopic = await db.topics.get(topic.id);

                if (!existingTopic) {
                    await db.topics.add({
                        id: topic.id,
                        messages: topic.messages || [],
                    });
                }
            }
        }

        // Set the selected robot in robotDB
        await robotDB.updateSelectedRobot(robotStore.selectedRobot);

        console.log('Robot data migration completed successfully.');
        return true;
    } catch (error) {
        console.error('Failed to migrate robot data:', error);
        message.error('迁移机器人数据失败，请刷新页面重试');
        return false;
    }
};

/**
 * Helper function to check if migration is needed
 */
export const isMigrationNeeded = async () => {
    try {
        // Check if robots exist in DB
        const existingRobots = await db.table('robots').toArray();
        return existingRobots.length === 0;
    } catch (error) {
        console.error('Error checking migration status:', error);
        return true; // Assume migration is needed if we can't check
    }
};
