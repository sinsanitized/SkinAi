export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`ℹ️  ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`❌ ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`⚠️  ${message}`, ...args);
  },
  success: (message: string, ...args: unknown[]) => {
    console.log(`✅ ${message}`, ...args);
  },
};
