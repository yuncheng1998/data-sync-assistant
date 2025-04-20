/**
 * 同步任务服务 - 用于记录和追踪同步任务的执行情况
 */
import prisma from '../../db.server.js';

/**
 * 任务类型枚举
 */
export const TaskType = {
  PRODUCT: 'PRODUCT',
  ORDER: 'ORDER',
  CUSTOMER: 'CUSTOMER'
};

/**
 * 任务状态枚举
 */
export const TaskStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * 创建一个新的同步任务记录
 * @param {string} taskType - 任务类型
 * @param {string} shopId - 商店ID，如果为 'all' 则表示同步所有商店
 * @returns {Object} 创建的任务记录
 */
export async function createSyncTask(taskType, shopId = 'all') {
  const now = new Date();
  
  // 使用Prisma创建任务
  const task = await prisma.syncTask.create({
    data: {
      taskType,
      shopId,
      status: TaskStatus.PENDING,
      startTime: now,
      createdAt: now,
      updatedAt: now
    }
  });
  
  console.log(`创建了新的${taskType}同步任务记录，ID: ${task.id}`);
  return task;
}

/**
 * 完成一个同步任务
 * @param {number} taskId - 任务ID
 * @param {boolean} success - 是否成功
 * @param {Object} resultData - 任务执行结果数据
 * @returns {Object} 更新后的任务记录
 */
export async function completeSyncTask(taskId, success, resultData = {}) {
  const now = new Date();
  
  // 获取任务
  const task = await prisma.syncTask.findUnique({
    where: { id: taskId }
  });
  
  if (!task) {
    throw new Error(`任务ID不存在: ${taskId}`);
  }
  
  // 计算持续时间（毫秒）
  const duration = now.getTime() - task.startTime.getTime();
  
  // 更新任务
  const updatedTask = await prisma.syncTask.update({
    where: { id: taskId },
    data: {
      status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
      endTime: now,
      duration,
      resultData: resultData,
      updatedAt: now
    }
  });
  
  console.log(`同步任务已${success ? '成功' : '失败'}完成，ID: ${taskId}，持续时间: ${duration}毫秒`);
  return updatedTask;
}

/**
 * 根据ID获取任务记录
 * @param {number} taskId - 任务ID
 * @returns {Object|null} 任务记录或null（如果不存在）
 */
export async function getTaskById(taskId) {
  const task = await prisma.syncTask.findUnique({
    where: { id: taskId }
  });
  
  return task;
}

/**
 * 获取最近的同步任务
 * @param {string} taskType - 任务类型
 * @param {string} shopId - 商店ID，默认为null（不过滤）
 * @param {number} limit - 限制返回的记录数
 * @returns {Array} 任务记录数组
 */
export async function getRecentTasks(taskType = null, shopId = null, limit = 10) {
  const whereClause = {};
  
  if (taskType) {
    whereClause.taskType = taskType;
  }
  
  if (shopId) {
    whereClause.shopId = shopId;
  }
  
  const tasks = await prisma.syncTask.findMany({
    where: whereClause,
    orderBy: {
      startTime: 'desc'
    },
    take: limit
  });
  
  return tasks;
}

/**
 * 获取最后一次成功的同步任务
 * @param {string} taskType - 任务类型
 * @param {string} shopId - 商店ID
 * @returns {Object|null} 任务记录或null（如果不存在）
 */
export async function getLastSuccessfulTask(taskType, shopId = 'all') {
  const task = await prisma.syncTask.findFirst({
    where: {
      taskType,
      shopId,
      status: TaskStatus.COMPLETED
    },
    orderBy: {
      endTime: 'desc'
    }
  });
  
  return task;
}

/**
 * 获取任务统计数据
 * @returns {Object} 统计数据
 */
export async function getTaskStats() {
  // 获取总任务数
  const totalTasks = await prisma.syncTask.count();
  
  // 获取各状态任务数
  const pendingTasks = await prisma.syncTask.count({
    where: { status: TaskStatus.PENDING }
  });
  
  const completedTasks = await prisma.syncTask.count({
    where: { status: TaskStatus.COMPLETED }
  });
  
  const failedTasks = await prisma.syncTask.count({
    where: { status: TaskStatus.FAILED }
  });
  
  // 按任务类型分组
  const productTasks = await prisma.syncTask.count({
    where: { taskType: TaskType.PRODUCT }
  });
  
  const orderTasks = await prisma.syncTask.count({
    where: { taskType: TaskType.ORDER }
  });
  
  const customerTasks = await prisma.syncTask.count({
    where: { taskType: TaskType.CUSTOMER }
  });
  
  // 最近成功的任务
  const recentSuccessful = await prisma.syncTask.findMany({
    where: { status: TaskStatus.COMPLETED },
    orderBy: { endTime: 'desc' },
    take: 5
  });
  
  // 最近失败的任务
  const recentFailed = await prisma.syncTask.findMany({
    where: { status: TaskStatus.FAILED },
    orderBy: { endTime: 'desc' },
    take: 5
  });
  
  return {
    total: totalTasks,
    byStatus: {
      pending: pendingTasks,
      completed: completedTasks,
      failed: failedTasks
    },
    byType: {
      product: productTasks,
      order: orderTasks,
      customer: customerTasks
    },
    recentSuccessful,
    recentFailed
  };
}

/**
 * 获取最后同步时间
 * @param {string} taskType - 任务类型
 * @param {string} shopId - 商店ID
 * @returns {Date|null} 最后同步时间或null
 */
export async function getLastSyncTime(taskType, shopId = 'all') {
  const lastTask = await getLastSuccessfulTask(taskType, shopId);
  return lastTask ? lastTask.endTime : null;
}

/**
 * 清理旧任务数据
 * @param {number} daysToKeep - 保留天数
 * @returns {number} 清理的记录数
 */
export async function cleanupOldTasks(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await prisma.syncTask.deleteMany({
    where: {
      updatedAt: {
        lt: cutoffDate
      }
    }
  });
  
  console.log(`已清理 ${result.count} 条旧任务记录`);
  return result.count;
} 