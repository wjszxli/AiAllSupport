import { db } from './index';

/**
 * Initialize the database and run any needed migrations
 */
export const initializeDatabase = async () => {
    try {
        // Open the database
        await db.open();
        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        return false;
    }
};

export default initializeDatabase;
