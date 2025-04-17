/**
 * 应用启动器 - 用于初始化各种服务
 */
import { initializeCronTasks } from './cron/cronService.js';

let isInitialized = false;

/**
 * 初始化应用服务
 */
export function bootstrapApp() {
  if (isInitialized) {
    console.log('应用服务已初始化，跳过');
    return;
  }
  
  try {
    console.log('开始初始化应用服务...');
    
    // 初始化定时任务
    initializeCronTasks();
    
    isInitialized = true;
    console.log('应用服务初始化完成');
  } catch (error) {
    console.error('应用服务初始化失败:', error);
    throw error;
  }
}

/**
 * 检查应用是否已初始化
 * @returns {boolean} 是否已初始化
 */
export function isAppInitialized() {
  return isInitialized;
} 