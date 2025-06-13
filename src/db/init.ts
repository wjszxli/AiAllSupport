import { db } from './index';
import { migrateRobotData, isMigrationNeeded } from './migrations/migrateRobotData';

/**
 * Initialize the database and run any needed migrations
 */
export const initializeDatabase = async () => {
    try {
        // Open the database
        await db.open();
        console.log('Database opened successfully');

        // Check if robot data migration is needed
        if (await isMigrationNeeded()) {
            console.log('Migration needed, migrating robot data...');
            await migrateRobotData();
        }

        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        return false;
    }
};

export default initializeDatabase;
