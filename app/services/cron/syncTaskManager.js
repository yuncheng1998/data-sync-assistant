/**
 * 同步任务管理器
 * 为各种实体的同步任务提供统一管理
 */
import { formatISO } from 'date-fns';
import { createSyncTask, completeSyncTask, getLastSyncTime } from '../database/index.js';

/**
 * 同步任务管理器类
 * 负责管理不同类型数据的同步任务
 */
export class SyncTaskManager {
  /**
   * 构造函数
   * @param {string} entityType - 实体类型名称
   * @param {string} taskType - 同步任务类型
   * @param {Function} executeSyncFn - 执行同步的函数
   * @param {Object} defaultOptions - 默认同步选项
   */
  constructor(entityType, taskType, executeSyncFn, defaultOptions) {
    this.entityType = entityType;
    this.taskType = taskType;
    this.executeSync = executeSyncFn;
    this.defaultOptions = defaultOptions || {};
  }

  /**
   * 执行同步任务
   * @param {Object} options - 同步选项，默认使用增量同步
   * @returns {Promise<Object>} 同步结果
   */
  async executeWithTask(options = null) {
    // 选择同步选项
    const syncOptions = options || this.defaultOptions.incremental;
    if (!syncOptions) {
      throw new Error(`未提供同步选项且默认选项不可用`);
    }

    // 创建同步任务记录
    const task = await createSyncTask(this.taskType);
    console.log(`开始${this.entityType}同步任务 (ID: ${task.id}), 策略: ${syncOptions.incremental !== false ? '增量' : '全量'}`);
    
    try {
      // 如果启用了增量同步，获取上次同步时间
      if (syncOptions.incremental !== false) {
        const lastSyncTime = await getLastSyncTime(this.taskType);
        if (lastSyncTime) {
          console.log(`使用上次同步时间: ${new Date(lastSyncTime).toISOString()}`);
          syncOptions.modifiedSince = new Date(lastSyncTime);
        } else {
          console.log(`没有找到上次同步时间记录，将执行全量同步`);
          syncOptions.incremental = false;
        }
      }
      
      // 执行同步
      const result = await this.executeSync(syncOptions);
      
      // 更新任务状态为完成
      await completeSyncTask(task.id, true, {
        strategy: syncOptions.incremental !== false ? 'incremental' : 'full',
        count: result.count,
        syncTime: formatISO(new Date())
      });
      
      return result;
    } catch (error) {
      console.error(`${this.entityType}同步失败:`, error);
      
      // 更新任务状态为失败
      await completeSyncTask(task.id, false, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * 返回同步处理器函数
   * 用于定时任务调度
   * @returns {Function} 同步处理器函数
   */
  getTaskHandler() {
    return async (fullSync = false) => {
      console.log(`执行定时${this.entityType}同步，时间: ${new Date().toISOString()}`);
      try {
        const options = fullSync 
          ? this.defaultOptions.full 
          : this.defaultOptions.incremental;
          
        const result = await this.executeWithTask(options);
        console.log(`${this.entityType}同步完成，同步了 ${result.count} 个${this.entityType}`);
        return result;
      } catch (error) {
        console.error(`${this.entityType}同步任务执行失败:`, error);
        throw error;
      }
    };
  }
} 