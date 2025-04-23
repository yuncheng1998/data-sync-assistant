/**
 * 数据库服务统一导出
 */

// 导出 Prisma 客户端
export { default as prisma } from '../../db.server.js';

// 导出产品服务
export * from './productService.js';

// 导出订单服务
export * from './orderService.js';

// 导出同步任务服务
export * from './syncTaskService.js';

// 导出折扣服务
export * from './discountService.js';

// 导出商店服务
export * from './storeService.js'; 