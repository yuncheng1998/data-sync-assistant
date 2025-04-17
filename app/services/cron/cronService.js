/**
 * 定时任务服务
 */
import cron from 'node-cron';
import { syncAllShopsProducts } from '../sync/productSync.js';

// 任务状态
let productSyncTask = null;
let isProductSyncRunning = false;

/**
 * 执行产品同步任务
 */
export async function executeProductSync() {
  // 防止重复执行
  if (isProductSyncRunning) {
    console.log('产品同步任务已在运行中，跳过本次执行');
    return;
  }
  
  try {
    console.log('开始执行产品同步定时任务...');
    isProductSyncRunning = true;
    
    // 执行产品同步
    const result = await syncAllShopsProducts();
    
    // 记录执行结果
    console.log('产品同步定时任务完成:', result.message);
    
    return result;
  } catch (error) {
    console.error('产品同步定时任务执行失败:', error);
    throw error;
  } finally {
    isProductSyncRunning = false;
  }
}

/**
 * 启动产品同步定时任务
 * @param {string} schedule - cron 表达式，默认为每5分钟执行一次
 * @returns {boolean} 是否成功启动
 */
export function startProductSyncTask(schedule) {
  // 默认每5分钟执行一次
  const cronSchedule = schedule || process.env.PRODUCT_SYNC_INTERVAL || '*/5 * * * *';
  
  // 如果已经存在任务，先停止
  if (productSyncTask) {
    stopProductSyncTask();
  }
  
  try {
    // 验证 cron 表达式
    if (!cron.validate(cronSchedule)) {
      throw new Error(`无效的 cron 表达式: ${cronSchedule}`);
    }
    
    // 创建定时任务
    productSyncTask = cron.schedule(cronSchedule, executeProductSync, {
      scheduled: true,
      timezone: 'Asia/Shanghai' // 设置时区为中国时区
    });
    
    console.log(`产品同步定时任务已启动，调度: ${cronSchedule}`);
    return true;
  } catch (error) {
    console.error('启动产品同步定时任务失败:', error);
    return false;
  }
}

/**
 * 停止产品同步定时任务
 * @returns {boolean} 是否成功停止
 */
export function stopProductSyncTask() {
  try {
    if (productSyncTask) {
      productSyncTask.stop();
      productSyncTask = null;
      console.log('产品同步定时任务已停止');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('停止产品同步定时任务失败:', error);
    return false;
  }
}

/**
 * 初始化所有定时任务
 */
export function initializeCronTasks() {
  console.log('正在初始化定时任务...');
  
  // 检查环境变量是否启用产品同步
  const enableProductSync = process.env.ENABLE_PRODUCT_SYNC === 'true';
  
  if (enableProductSync) {
    startProductSyncTask();
  } else {
    console.log('产品同步定时任务未启用 (ENABLE_PRODUCT_SYNC != true)');
  }
} 