/**
 * Cron服务 - 管理定时任务
 */
import { TaskType } from '../database/index.js';
import { executeProductSync, executeOrderSync, executeDiscountSync } from '../database/index.js';
import { SyncTaskManager } from './syncTaskManager.js';
import { TaskScheduler } from './taskScheduler.js';

// 创建任务调度器
const scheduler = new TaskScheduler();

// 默认同步选项
export const DEFAULT_SYNC_OPTIONS = {
  product: {
    // 增量同步选项
    incremental: {
      incremental: true,
      syncModifiedOnly: true,
      batchSize: 50,
      includeMetafields: true
    },
    // 全量同步选项
    full: {
      incremental: false,
      syncModifiedOnly: false,
      batchSize: 100,
      includeMetafields: true,
      deleteStaleProducts: true
    }
  },
  order: {
    // 增量同步选项
    incremental: {
      incremental: true,
      syncModifiedOnly: true,
      batchSize: 25,
      includeLineItems: true
    },
    // 全量同步选项
    full: {
      incremental: false,
      syncModifiedOnly: false,
      batchSize: 50,
      includeLineItems: true,
      includeCustomer: true
    }
  },
  discount: {
    // 增量同步选项
    incremental: {
      incremental: true,
      syncModifiedOnly: true,
      batchSize: 50
    },
    // 全量同步选项
    full: {
      incremental: false,
      syncModifiedOnly: false,
      batchSize: 100
    }
  }
};

// 创建同步任务管理器实例
const productSyncManager = new SyncTaskManager(
  '产品', 
  TaskType.PRODUCT, 
  executeProductSync, 
  DEFAULT_SYNC_OPTIONS.product
);

const orderSyncManager = new SyncTaskManager(
  '订单', 
  TaskType.ORDER, 
  executeOrderSync, 
  DEFAULT_SYNC_OPTIONS.order
);

const discountSyncManager = new SyncTaskManager(
  '折扣', 
  TaskType.DISCOUNT, 
  executeDiscountSync, 
  DEFAULT_SYNC_OPTIONS.discount
);

/**
 * 判断是否应该执行全量同步
 * 策略：每周日或每月1日执行全量同步，其他时间执行增量同步
 * @returns {boolean} 是否需要执行全量同步
 */
function shouldPerformFullSync() {
  if (process.env.SYNC_FULL_DATA === 'true') {
    return true;
  }
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const dayOfMonth = now.getDate(); // 1-31
  
  // 周日或月初执行全量同步
  // return dayOfWeek === 0 || dayOfMonth === 1;
  return false;
}

/**
 * 同步所有数据
 * 根据当前日期决定是执行增量同步还是全量同步
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllData() {
  console.log(`开始数据同步，时间: ${new Date().toISOString()}`);
  
  // 确定同步策略
  const fullSync = shouldPerformFullSync();
  console.log(`同步策略: ${fullSync ? '全量同步' : '增量同步'}`);
  
  // 执行同步
  try {
    // 使用Promise.all进行并行处理，提高性能
    // 对于大型系统可能需要考虑串行执行，以避免资源竞争
    
    // 创建同步任务数组
    const syncTasks = [
      productSyncManager.getTaskHandler()(fullSync)
        .then(result => ({ type: 'product', result }))
        .catch(error => ({ type: 'product', error })),
      
      orderSyncManager.getTaskHandler()(fullSync)
        .then(result => ({ type: 'order', result }))
        .catch(error => ({ type: 'order', error })),
      
      discountSyncManager.getTaskHandler()(fullSync)
        .then(result => ({ type: 'discount', result }))
        .catch(error => ({ type: 'discount', error }))
    ];
    
    // 并行执行所有同步任务
    const results = await Promise.all(syncTasks);
    
    // 处理结果
    const syncResults = {};
    let hasErrors = false;
    
    results.forEach(item => {
      if (item.error) {
        hasErrors = true;
        syncResults[item.type] = { 
          success: false, 
          error: item.error.message 
        };
        console.error(`${item.type}同步失败:`, item.error);
      } else {
        syncResults[item.type] = item.result;
      }
    });
    
    return {
      success: !hasErrors,
      ...syncResults
    };
  } catch (error) {
    console.error('数据同步过程中发生错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 启动数据同步定时任务
 * @param {string} schedule - Cron表达式，默认为每5分钟执行一次
 * @returns {Object} 任务信息
 */
export function startDataSyncTask(schedule = '*/5 * * * *') {
  return scheduler.startTask(
    'dataSync', 
    async () => await syncAllData(),
    schedule
  );
}

/**
 * 停止数据同步定时任务
 * @returns {boolean} 是否成功停止
 */
export function stopDataSyncTask() {
  return scheduler.stopTask('dataSync');
}

/**
 * 启动产品同步定时任务
 * @param {string} schedule - Cron表达式
 * @returns {Object} 任务信息
 */
export function startProductSyncTask(schedule = '*/10 * * * *') {
  return scheduler.startTask(
    'productSync',
    productSyncManager.getTaskHandler(),
    schedule
  );
}

/**
 * 停止产品同步定时任务
 * @returns {boolean} 是否成功停止
 */
export function stopProductSyncTask() {
  return scheduler.stopTask('productSync');
}

/**
 * 启动订单同步定时任务
 * @param {string} schedule - Cron表达式
 * @returns {Object} 任务信息
 */
export function startOrderSyncTask(schedule = '*/15 * * * *') {
  return scheduler.startTask(
    'orderSync',
    orderSyncManager.getTaskHandler(),
    schedule
  );
}

/**
 * 停止订单同步定时任务
 * @returns {boolean} 是否成功停止
 */
export function stopOrderSyncTask() {
  return scheduler.stopTask('orderSync');
}

/**
 * 启动折扣同步定时任务
 * @param {string} schedule - Cron表达式，默认为每10分钟执行一次
 * @returns {Object} 任务信息
 */
export function startDiscountSyncTask(schedule = '*/10 * * * *') {
  return scheduler.startTask(
    'discountSync',
    discountSyncManager.getTaskHandler(),
    schedule
  );
}

/**
 * 停止折扣同步定时任务
 * @returns {boolean} 是否成功停止
 */
export function stopDiscountSyncTask() {
  return scheduler.stopTask('discountSync');
}

/**
 * 停止特定商店的所有同步任务
 * 当商店卸载应用时，调用此方法停止该商店的所有同步任务
 * @param {string} shop - 商店域名
 * @returns {Promise<boolean>} 是否成功停止
 */
export async function stopShopSyncTasks(shop) {
  if (!shop) {
    console.warn('尝试停止任务时未提供商店域名');
    return false;
  }

  console.log(`停止商店 ${shop} 的所有同步任务`);

  // 停止针对该商店的特定任务（如果有）
  // 例如：shopSpecificTaskIds是一个映射，存储商店与其专用任务的关系
  const shopSpecificTaskIds = [];
  
  try {
    // 获取与此商店相关的所有任务ID
    // 这里需要根据您的应用架构实现具体逻辑
    // 例如，您可能有一个任务命名约定，如 `${shop}-productSync`
    
    // 获取所有活跃任务
    const allTaskIds = scheduler.getAllTaskIds();
    
    // 筛选出与此商店相关的任务
    for (const taskId of allTaskIds) {
      if (taskId.startsWith(shop) || taskId.includes(shop)) {
        shopSpecificTaskIds.push(taskId);
      }
    }
    
    // 停止所有相关任务
    for (const taskId of shopSpecificTaskIds) {
      console.log(`停止商店 ${shop} 的任务: ${taskId}`);
      scheduler.stopTask(taskId);
    }
    
    console.log(`已停止商店 ${shop} 的 ${shopSpecificTaskIds.length} 个任务`);
    return true;
  } catch (error) {
    console.error(`停止商店 ${shop} 的任务时出错:`, error);
    return false;
  }
}

/**
 * 初始化所有Cron任务
 */
export function initializeCronTasks() {
  // 检查环境变量是否启用了数据同步
  const enableDataSync = process.env.ENABLE_DATA_SYNC !== 'false';
  
  if (enableDataSync) {
    // 默认为每5分钟执行一次
    const dataSyncSchedule = process.env.DATA_SYNC_SCHEDULE || '*/5 * * * *';
    startDataSyncTask(dataSyncSchedule);
    console.log('数据同步任务已启动 dataSyncSchedule = ', dataSyncSchedule);
    
    // 可以按需启动单独的同步任务
    // const productSyncSchedule = process.env.PRODUCT_SYNC_SCHEDULE || '*/7 * * * *';
    // startProductSyncTask(productSyncSchedule);
    
    // const orderSyncSchedule = process.env.ORDER_SYNC_SCHEDULE || '*/10 * * * *';
    // startOrderSyncTask(orderSyncSchedule);
    
    // const discountSyncSchedule = process.env.DISCOUNT_SYNC_SCHEDULE || '*/10 * * * *';
    // startDiscountSyncTask(discountSyncSchedule);
  } else {
    console.log('数据自动同步功能已禁用，可通过设置环境变量 ENABLE_DATA_SYNC=true 启用');
  }
}

/**
 * 关闭所有Cron任务
 */
export function shutdownCronTasks() {
  scheduler.stopAllTasks();
} 