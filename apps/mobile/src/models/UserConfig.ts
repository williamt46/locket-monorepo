/**
 * @deprecated Renamed to BaselineCycleData — the cycle baseline is health data,
 * not "config"/"metadata". This re-export keeps old import paths working for one
 * release; migrate imports to ./BaselineCycleData.
 */
export * from './BaselineCycleData';
export type { BaselineCycleData as UserConfig } from './BaselineCycleData';
export { createDefaultBaselineCycleData as createDefaultUserConfig } from './BaselineCycleData';
