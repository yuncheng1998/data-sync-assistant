/**
 * Cron服务 - 管理定时任务
 */
import cron from 'node-cron';
import { formatISO } from 'date-fns';
import { 
  executeProductSync, 
  executeOrderSync,
  executeDiscountSync,
  createSyncTask, 
  completeSyncTask, 
  TaskType,
  getLastSyncTime 
} from '../database/index.js';

// 存储所有活跃的任务
const activeTasks = new Map();

// 默认同步选项
export const DEFAULT_SYNC_OPTIONS = {
  product: {
    // 增量同步选项
    incremental: {
      useIncrementalSync: true,
      syncModifiedOnly: true,
      batchSize: 50,
      includeMetafields: true
    },
    // 全量同步选项
    full: {
      useIncrementalSync: false,
      syncModifiedOnly: false,
      batchSize: 100,
      includeMetafields: true,
      deleteStaleProducts: true
    }
  },
  order: {
    // 增量同步选项
    incremental: {
      useIncrementalSync: true,
      syncModifiedOnly: true,
      batchSize: 25,
      includeLineItems: true
    },
    // 全量同步选项
    full: {
      useIncrementalSync: false,
      syncModifiedOnly: false,
      batchSize: 50,
      includeLineItems: true,
      includeCustomer: true
    }
  },
  discount: {
    // 增量同步选项
    incremental: {
      useIncrementalSync: true,
      syncModifiedOnly: true,
      batchSize: 50
    },
    // 全量同步选项
    full: {
      useIncrementalSync: false,
      syncModifiedOnly: false,
      batchSize: 100
    }
  }
};

/**
 * 执行产品同步
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
async function executeProductSyncWithTask(options = DEFAULT_SYNC_OPTIONS.product.incremental) {
  // 创建同步任务记录
  const task = await createSyncTask(TaskType.PRODUCT);
  console.log(`开始产品同步任务 (ID: ${task.id}), 策略: ${options.useIncrementalSync ? '增量' : '全量'}`);
  
  try {
    // 如果启用了增量同步，获取上次同步时间
    if (options.useIncrementalSync) {
      const lastSyncTime = await getLastSyncTime(TaskType.PRODUCT);
      if (lastSyncTime) {
        console.log(`使用上次同步时间: ${new Date(lastSyncTime).toISOString()}`);
        options.modifiedSince = new Date(lastSyncTime);
      } else {
        console.log(`没有找到上次同步时间记录，将执行全量同步`);
        options.useIncrementalSync = false;
      }
    }
    
    // 执行同步
    const result = await executeProductSync(options);
    
    // 更新任务状态为完成
    await completeSyncTask(task.id, true, {
      strategy: options.useIncrementalSync ? 'incremental' : 'full',
      count: result.count,
      syncTime: formatISO(new Date())
    });
    
    return result;
  } catch (error) {
    console.error('产品同步失败:', error);
    
    // 更新任务状态为失败
    await completeSyncTask(task.id, false, {
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * 执行订单同步
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
async function executeOrderSyncWithTask(options = DEFAULT_SYNC_OPTIONS.order.incremental) {
  // 创建同步任务记录
  const task = await createSyncTask(TaskType.ORDER);
  console.log(`开始订单同步任务 (ID: ${task.id}), 策略: ${options.useIncrementalSync ? '增量' : '全量'}`);
  
  try {
    // 如果启用了增量同步，获取上次同步时间
    if (options.useIncrementalSync) {
      const lastSyncTime = await getLastSyncTime(TaskType.ORDER);
      if (lastSyncTime) {
        console.log(`使用上次同步时间: ${new Date(lastSyncTime).toISOString()}`);
        options.modifiedSince = new Date(lastSyncTime);
      } else {
        console.log(`没有找到上次同步时间记录，将执行全量同步`);
        options.useIncrementalSync = false;
      }
    }
    
    // 执行同步
    const result = await executeOrderSync(options);
    
    // 更新任务状态为完成
    await completeSyncTask(task.id, true, {
      strategy: options.useIncrementalSync ? 'incremental' : 'full',
      count: result.count,
      syncTime: formatISO(new Date())
    });
    
    return result;
  } catch (error) {
    console.error('订单同步失败:', error);
    
    // 更新任务状态为失败
    await completeSyncTask(task.id, false, {
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * 执行折扣同步
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
async function executeDiscountSyncWithTask(options = DEFAULT_SYNC_OPTIONS.discount.incremental) {
  // 创建同步任务记录
  const task = await createSyncTask(TaskType.DISCOUNT);
  console.log(`开始折扣同步任务 (ID: ${task.id}), 策略: ${options.useIncrementalSync ? '增量' : '全量'}`);
  
  try {
    // 如果启用了增量同步，获取上次同步时间
    if (options.useIncrementalSync) {
      const lastSyncTime = await getLastSyncTime(TaskType.DISCOUNT);
      if (lastSyncTime) {
        console.log(`使用上次同步时间: ${new Date(lastSyncTime).toISOString()}`);
        options.modifiedSince = new Date(lastSyncTime);
      } else {
        console.log(`没有找到上次同步时间记录，将执行全量同步`);
        options.useIncrementalSync = false;
      }
    }
    
    // 执行同步
    const result = await executeDiscountSync(options);
    
    // 更新任务状态为完成
    await completeSyncTask(task.id, true, {
      strategy: options.useIncrementalSync ? 'incremental' : 'full',
      count: result.count,
      syncTime: formatISO(new Date())
    });
    
    return result;
  } catch (error) {
    console.error('折扣同步失败:', error);
    
    // 更新任务状态为失败
    await completeSyncTask(task.id, false, {
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

/**
 * 判断是否应该执行全量同步
 * 策略：每周日或每月1日执行全量同步，其他时间执行增量同步
 * @returns {boolean} 是否需要执行全量同步
 */
function shouldPerformFullSync() {
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
  const productOptions = fullSync 
    ? DEFAULT_SYNC_OPTIONS.product.full 
    : DEFAULT_SYNC_OPTIONS.product.incremental;
  
  const orderOptions = fullSync 
    ? DEFAULT_SYNC_OPTIONS.order.full 
    : DEFAULT_SYNC_OPTIONS.order.incremental;
  
  const discountOptions = fullSync 
    ? DEFAULT_SYNC_OPTIONS.discount.full 
    : DEFAULT_SYNC_OPTIONS.discount.incremental;
  
  console.log(`同步策略: ${fullSync ? '全量同步' : '增量同步'}`);
  
  // 执行同步
  try {
    // 先同步产品
    const productResult = await executeProductSyncWithTask(productOptions);
    console.log(`产品同步完成，同步了 ${productResult.count} 个产品`);
    
    // 再同步订单
    const orderResult = await executeOrderSyncWithTask(orderOptions);
    console.log(`订单同步完成，同步了 ${orderResult.count} 个订单`);
    
    // 最后同步折扣
    const discountResult = await executeDiscountSyncWithTask(discountOptions);
    console.log(`折扣同步完成，同步了 ${discountResult.count} 个折扣`);
    
    return {
      success: true,
      product: productResult,
      order: orderResult,
      discount: discountResult
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
  if (activeTasks.has('dataSync')) {
    console.warn('数据同步任务已经在运行中');
    return {
      taskId: 'dataSync',
      running: true,
      message: '数据同步任务已经在运行中'
    };
  }
  
  // 验证cron表达式是否有效
  if (!cron.validate(schedule)) {
    throw new Error(`无效的cron表达式: ${schedule}`);
  }
  
  console.log(`启动数据同步定时任务，调度: ${schedule}`);
  
  // 创建并启动任务
  const task = cron.schedule(schedule, syncAllData, {
    scheduled: true,
    timezone: 'Asia/Shanghai' // 使用中国时区
  });
  
  // 存储任务引用
  activeTasks.set('dataSync', {
    task,
    schedule,
    startTime: new Date()
  });
  
  return {
    taskId: 'dataSync',
    running: true,
    schedule,
    startTime: new Date()
  };
}

/**
 * 停止数据同步定时任务
 * @returns {boolean} 是否成功停止
 */
export function stopDataSyncTask() {
  if (!activeTasks.has('dataSync')) {
    console.warn('数据同步任务未在运行');
    return false;
  }
  
  const taskInfo = activeTasks.get('dataSync');
  taskInfo.task.stop();
  activeTasks.delete('dataSync');
  
  console.log(`数据同步定时任务已停止，运行时间: ${Date.now() - taskInfo.startTime.getTime()}ms`);
  return true;
}

/**
 * 启动折扣同步定时任务
 * @param {string} schedule - Cron表达式，默认为每10分钟执行一次
 * @returns {Object} 任务信息
 */
export function startDiscountSyncTask(schedule = '*/10 * * * *') {
  if (activeTasks.has('discountSync')) {
    console.warn('折扣同步任务已经在运行中');
    return {
      taskId: 'discountSync',
      running: true,
      message: '折扣同步任务已经在运行中'
    };
  }
  
  // 验证cron表达式是否有效
  if (!cron.validate(schedule)) {
    throw new Error(`无效的cron表达式: ${schedule}`);
  }
  
  console.log(`启动折扣同步定时任务，调度: ${schedule}`);
  
  // 创建并启动任务
  const task = cron.schedule(schedule, async () => {
    console.log(`执行定时折扣同步，时间: ${new Date().toISOString()}`);
    try {
      const options = shouldPerformFullSync() 
        ? DEFAULT_SYNC_OPTIONS.discount.full 
        : DEFAULT_SYNC_OPTIONS.discount.incremental;
        
      const result = await executeDiscountSyncWithTask(options);
      console.log(`折扣同步完成，同步了 ${result.count} 个折扣`);
      return result;
    } catch (error) {
      console.error('折扣同步任务执行失败:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai' // 使用中国时区
  });
  
  // 存储任务引用
  activeTasks.set('discountSync', {
    task,
    schedule,
    startTime: new Date()
  });
  
  return {
    taskId: 'discountSync',
    running: true,
    schedule,
    startTime: new Date()
  };
}

/**
 * 停止折扣同步定时任务
 * @returns {boolean} 是否成功停止
 */
export function stopDiscountSyncTask() {
  if (!activeTasks.has('discountSync')) {
    console.warn('折扣同步任务未在运行');
    return false;
  }
  
  const taskInfo = activeTasks.get('discountSync');
  taskInfo.task.stop();
  activeTasks.delete('discountSync');
  
  console.log(`折扣同步定时任务已停止，运行时间: ${Date.now() - taskInfo.startTime.getTime()}ms`);
  return true;
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
    
    // 折扣同步默认每10分钟执行一次
    // const discountSyncSchedule = process.env.DISCOUNT_SYNC_SCHEDULE || '*/10 * * * *';
    // startDiscountSyncTask(discountSyncSchedule);
  } else {
    console.log('数据自动同步功能已禁用，可通过设置环境变量 ENABLE_DATA_SYNC=true 启用');
  }
  
  // 未来可以在这里添加其他定时任务
}

/**
 * 关闭所有Cron任务
 */
export function shutdownCronTasks() {
  for (const [taskId, taskInfo] of activeTasks.entries()) {
    console.log(`停止任务: ${taskId}`);
    taskInfo.task.stop();
  }
  
  activeTasks.clear();
  console.log('所有定时任务已停止');
} 