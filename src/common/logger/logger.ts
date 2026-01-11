import winston from 'winston';
import { isProduction } from '../utils/env';

// Log levels enum
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Logger class - singleton wrapper around Winston
export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    this.logger = createWinstonLogger();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }

  public debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  public child(context: Record<string, any>): winston.Logger {
    return this.logger.child(context);
  }
}

// Create Winston logger with environment-specific configuration
function createWinstonLogger(): winston.Logger {
  return winston.createLogger({
    level: isProduction() ? LogLevel.INFO : LogLevel.DEBUG,
    format: isProduction() ? getProductionFormat() : getDevelopmentFormat(),
    transports: getTransports(),
  });
}

// Production format - JSON output for log aggregators
function getProductionFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );
}

// Development format - colored, human-readable output
function getDevelopmentFormat(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  );
}

// Get transports - console always, files in production
function getTransports(): winston.transport[] {
  const transports: winston.transport[] = [
    new winston.transports.Console(),
  ];

  if (isProduction()) {
    transports.push(
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log' 
      })
    );
  }

  return transports;
}
