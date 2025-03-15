import storageUtils from './storage';

// Log levels in order of increasing severity
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4, // Used to disable all logging
}

// Configuration type for the logger
export interface LoggerConfig {
    enabled: boolean;
    level: LogLevel;
    includeTimestamp: boolean;
    logToConsole: boolean;
    persistLogs: boolean;
    maxPersistedLogs: number;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
    enabled: false, // Disabled by default
    level: LogLevel.INFO,
    includeTimestamp: true,
    logToConsole: true,
    persistLogs: false,
    maxPersistedLogs: 1000,
};

// Storage keys
const CONFIG_STORAGE_KEY = 'deepseek_logger_config';
const LOGS_STORAGE_KEY = 'deepseek_logs';

// Log entry interface
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    message: string;
    data?: any;
    context?: string;
}

// In-memory store of logs (when persistence is enabled)
let logStore: LogEntry[] = [];

// Current configuration
let currentConfig: LoggerConfig = { ...DEFAULT_CONFIG };

// Initialize logger
export async function initLogger(): Promise<LoggerConfig> {
    try {
        const storedConfig = await storageUtils.get<LoggerConfig>(CONFIG_STORAGE_KEY);
        if (storedConfig) {
            currentConfig = { ...DEFAULT_CONFIG, ...storedConfig };
        }

        if (currentConfig.persistLogs) {
            const storedLogs = await storageUtils.get<LogEntry[]>(LOGS_STORAGE_KEY);
            if (storedLogs) {
                logStore = storedLogs;
            }
        }
    } catch (error: unknown) {
        console.error('Failed to initialize logger:', error);
    }

    return currentConfig;
}

// Update logger configuration
export async function updateLoggerConfig(config: Partial<LoggerConfig>): Promise<LoggerConfig> {
    currentConfig = { ...currentConfig, ...config };

    try {
        await storageUtils.set(CONFIG_STORAGE_KEY, currentConfig);
    } catch (error: unknown) {
        console.error('Failed to save logger configuration:', error);
    }

    return currentConfig;
}

// Get current logger configuration
export function getLoggerConfig(): LoggerConfig {
    return { ...currentConfig };
}

// Clear all persisted logs
export async function clearLogs(): Promise<void> {
    logStore = [];

    if (currentConfig.persistLogs) {
        try {
            await storageUtils.set(LOGS_STORAGE_KEY, logStore);
        } catch (error: unknown) {
            console.error('Failed to clear persisted logs:', error);
        }
    }
}

// Get all logs
export function getLogs(): LogEntry[] {
    return [...logStore];
}

// Core logging function
function logInternal(level: LogLevel, message: string, data?: any, context?: string): void {
    if (!currentConfig.enabled || level < currentConfig.level) {
        return;
    }

    const entry: LogEntry = {
        timestamp: Date.now(),
        level,
        message,
        context,
    };

    if (data !== undefined) {
        entry.data = data;
    }

    // Add to memory store if persistence is enabled
    if (currentConfig.persistLogs) {
        logStore.push(entry);

        // Trim log store if it exceeds maximum size
        if (logStore.length > currentConfig.maxPersistedLogs) {
            logStore = logStore.slice(-currentConfig.maxPersistedLogs);
        }

        // Save to storage (debounced in a real implementation)
        storageUtils.set(LOGS_STORAGE_KEY, logStore).catch((error: unknown) => {
            console.error('Failed to persist logs:', error);
        });
    }

    // Log to console if enabled
    if (currentConfig.logToConsole) {
        const timestamp = currentConfig.includeTimestamp
            ? `[${new Date(entry.timestamp).toISOString()}] `
            : '';
        const contextStr = context ? `[${context}] ` : '';
        const prefix = `${timestamp}${getLevelLabel(level)} ${contextStr}`;

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(`${prefix}${message}`, data !== undefined ? data : '');
                break;
            case LogLevel.INFO:
                console.info(`${prefix}${message}`, data !== undefined ? data : '');
                break;
            case LogLevel.WARN:
                console.warn(`${prefix}${message}`, data !== undefined ? data : '');
                break;
            case LogLevel.ERROR:
                console.error(`${prefix}${message}`, data !== undefined ? data : '');
                break;
        }
    }
}

// Helper to get level label
function getLevelLabel(level: LogLevel): string {
    switch (level) {
        case LogLevel.DEBUG:
            return '[DEBUG]';
        case LogLevel.INFO:
            return '[INFO]';
        case LogLevel.WARN:
            return '[WARN]';
        case LogLevel.ERROR:
            return '[ERROR]';
        default:
            return '';
    }
}

// Public logging functions
export function debug(message: string, data?: any, context?: string): void {
    logInternal(LogLevel.DEBUG, message, data, context);
}

export function info(message: string, data?: any, context?: string): void {
    logInternal(LogLevel.INFO, message, data, context);
}

export function warn(message: string, data?: any, context?: string): void {
    logInternal(LogLevel.WARN, message, data, context);
}

export function error(message: string, data?: any, context?: string): void {
    logInternal(LogLevel.ERROR, message, data, context);
}

// Logger class for context-specific logging
export class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    debug(message: string, data?: any): void {
        debug(message, data, this.context);
    }

    info(message: string, data?: any): void {
        info(message, data, this.context);
    }

    warn(message: string, data?: any): void {
        warn(message, data, this.context);
    }

    error(message: string, data?: any): void {
        error(message, data, this.context);
    }
}
