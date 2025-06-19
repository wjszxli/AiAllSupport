import * as log from 'loglevel';
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

// Initialize the root logger
const rootLogger = log.getLogger('root');

// Map our log levels to loglevel's levels
function mapLogLevel(level: LogLevel): log.LogLevelDesc {
    switch (level) {
        case LogLevel.DEBUG:
            return log.levels.DEBUG;
        case LogLevel.INFO:
            return log.levels.INFO;
        case LogLevel.WARN:
            return log.levels.WARN;
        case LogLevel.ERROR:
            return log.levels.ERROR;
        case LogLevel.NONE:
            return log.levels.SILENT;
        default:
            return log.levels.INFO;
    }
}

// Initialize logger
export async function initLogger(): Promise<LoggerConfig> {
    try {
        const storedConfig = await storageUtils.get<LoggerConfig>(CONFIG_STORAGE_KEY);
        if (storedConfig) {
            currentConfig = { ...DEFAULT_CONFIG, ...storedConfig };
        }

        // Set the log level based on configuration
        rootLogger.setLevel(mapLogLevel(currentConfig.level));

        if (currentConfig.persistLogs) {
            const storedLogs = await storageUtils.get<LogEntry[]>(LOGS_STORAGE_KEY);
            if (storedLogs) {
                logStore = storedLogs;
            }
        }
    } catch (error: unknown) {
        rootLogger.error('Failed to initialize logger:', error);
    }

    return currentConfig;
}

// Update logger configuration
export async function updateLoggerConfig(config: Partial<LoggerConfig>): Promise<LoggerConfig> {
    currentConfig = { ...currentConfig, ...config };

    // Update loglevel's log level
    if (config.level !== undefined) {
        rootLogger.setLevel(mapLogLevel(config.level));
    }

    // Enable/disable logging
    if (config.enabled !== undefined && !config.enabled) {
        rootLogger.setLevel(log.levels.SILENT);
    } else if (config.enabled !== undefined && config.enabled) {
        rootLogger.setLevel(mapLogLevel(currentConfig.level));
    }

    try {
        await storageUtils.set(CONFIG_STORAGE_KEY, currentConfig);
    } catch (error: unknown) {
        rootLogger.error('Failed to save logger configuration:', error);
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
            rootLogger.error('Failed to clear persisted logs:', error);
        }
    }
}

// Get all logs
export function getLogs(): LogEntry[] {
    return [...logStore];
}

// Helper to get level label
export function getLevelLabel(level: LogLevel): string {
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

// Core logging function that wraps loglevel and adds our custom functionality
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

        // Save to storage
        storageUtils.set(LOGS_STORAGE_KEY, logStore).catch((error: unknown) => {
            rootLogger.error('Failed to persist logs:', error);
        });
    }

    // Format the message with timestamp and context if needed
    let formattedMessage = message;
    if (currentConfig.includeTimestamp) {
        formattedMessage = `[${new Date(entry.timestamp).toISOString()}] ${formattedMessage}`;
    }
    if (context) {
        formattedMessage = `[${context}] ${formattedMessage}`;
    }

    // Use loglevel for actual logging
    switch (level) {
        case LogLevel.DEBUG:
            rootLogger.debug(formattedMessage, data);
            break;
        case LogLevel.INFO:
            rootLogger.info(formattedMessage, data);
            break;
        case LogLevel.WARN:
            rootLogger.warn(formattedMessage, data);
            break;
        case LogLevel.ERROR:
            rootLogger.error(formattedMessage, data);
            break;
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
    private loggerInstance: log.Logger;

    constructor(context: string) {
        this.context = context;
        this.loggerInstance = log.getLogger(context);

        // Inherit level from root logger
        this.loggerInstance.setLevel(rootLogger.getLevel());
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
