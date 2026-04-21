/**
 * Environment Configuration
 * Centralized configuration for API endpoints and app settings
 */

const CONFIG = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL || 'ws://localhost:8080/ws',
  ENV: process.env.EXPO_PUBLIC_ENV || 'development',
  
  // Feature Flags
  ENABLE_LOGGING: process.env.EXPO_PUBLIC_ENV !== 'production',
  ENABLE_REDUX_LOG: true,
  
  // Timeouts (in milliseconds)
  API_TIMEOUT: 30000,
  SOCKET_TIMEOUT: 30000,
  
  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // App Constants
  AI_BOT_ID: 'shop-expert-ai-bot',
  AI_BOT_NAME: 'ShopExpert AI',
};

export default CONFIG;
