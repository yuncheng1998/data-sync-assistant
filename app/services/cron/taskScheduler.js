/**
 * 任务调度器
 * 负责管理各种定时任务的启动和停止
 */
import cron from 'node-cron';

/**
 * 任务调度器类
 */
export class TaskScheduler {
  constructor() {
    // 存储所有活跃的任务
    this.activeTasks = new Map();
  }

  /**
   * 启动定时任务
   * @param {string} taskId - 任务ID
   * @param {Function} handler - 任务处理函数
   * @param {string} schedule - Cron表达式
   * @param {Object} options - 调度选项
   * @returns {Object} 任务信息
   */
  startTask(taskId, handler, schedule, options = {}) {
    // 检查任务是否已经在运行
    if (this.activeTasks.has(taskId)) {
      console.warn(`任务 ${taskId} 已经在运行中`);
      return {
        taskId,
        running: true,
        message: `任务 ${taskId} 已经在运行中`
      };
    }
    
    // 验证cron表达式是否有效
    if (!cron.validate(schedule)) {
      throw new Error(`无效的cron表达式: ${schedule}`);
    }
    
    console.log(`启动任务 ${taskId}，调度: ${schedule}`);
    
    // 创建任务调度选项
    const schedulerOptions = {
      scheduled: true,
      timezone: options.timezone || 'Asia/Shanghai' // 默认使用中国时区
    };
    
    // 创建并启动任务
    const task = cron.schedule(schedule, async () => {
      try {
        await handler(options.fullSync);
      } catch (error) {
        console.error(`任务 ${taskId} 执行失败:`, error);
      }
    }, schedulerOptions);
    
    // 存储任务引用
    this.activeTasks.set(taskId, {
      task,
      schedule,
      startTime: new Date(),
      options
    });
    
    return {
      taskId,
      running: true,
      schedule,
      startTime: new Date(),
      options
    };
  }

  /**
   * 停止定时任务
   * @param {string} taskId - 任务ID
   * @returns {boolean} 是否成功停止
   */
  stopTask(taskId) {
    if (!this.activeTasks.has(taskId)) {
      console.warn(`任务 ${taskId} 未在运行`);
      return false;
    }
    
    const taskInfo = this.activeTasks.get(taskId);
    taskInfo.task.stop();
    this.activeTasks.delete(taskId);
    
    const runTime = Date.now() - taskInfo.startTime.getTime();
    console.log(`任务 ${taskId} 已停止，运行时间: ${runTime}ms`);
    return true;
  }

  /**
   * 获取任务信息
   * @param {string} taskId - 任务ID
   * @returns {Object|null} 任务信息或null（如果任务不存在）
   */
  getTaskInfo(taskId) {
    if (!this.activeTasks.has(taskId)) {
      return null;
    }
    
    const taskInfo = this.activeTasks.get(taskId);
    return {
      taskId,
      running: true,
      schedule: taskInfo.schedule,
      startTime: taskInfo.startTime,
      runTime: Date.now() - taskInfo.startTime.getTime(),
      options: taskInfo.options
    };
  }

  /**
   * 获取所有活跃任务的ID
   * @returns {Array<string>} 任务ID数组
   */
  getAllTaskIds() {
    return Array.from(this.activeTasks.keys());
  }

  /**
   * 停止所有任务
   */
  stopAllTasks() {
    for (const [taskId, taskInfo] of this.activeTasks.entries()) {
      console.log(`停止任务: ${taskId}`);
      taskInfo.task.stop();
    }
    
    this.activeTasks.clear();
    console.log('所有定时任务已停止');
  }
} 