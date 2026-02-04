/**
 * Default application configuration
 */
export const DEFAULT_CONFIG = {
  workingHours: 8,
  hourlyRate: 50,
  overtimeMultiplier: 1.5,
  currency: 'EGP',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  theme: 'light'
};

/**
 * Get default configuration
 */
export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}

/**
 * Validate configuration object
 */
export function isValidConfig(config) {
  return (
    config &&
    typeof config.workingHours === 'number' &&
    typeof config.hourlyRate === 'number' &&
    typeof config.overtimeMultiplier === 'number' &&
    config.workingHours > 0 &&
    config.hourlyRate > 0 &&
    config.overtimeMultiplier > 0
  );
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig
  };
}
