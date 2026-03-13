import type { Logger } from './types.js';

/**
 * Default console-based logger.
 */
export function createConsoleLogger(): Logger {
  return {
    debug: (message: string, ...args: unknown[]) => console.debug(`[fhir-engine] ${message}`, ...args),
    info: (message: string, ...args: unknown[]) => console.info(`[fhir-engine] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => console.warn(`[fhir-engine] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => console.error(`[fhir-engine] ${message}`, ...args),
  };
}
