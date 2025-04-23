/**
 * 订单同步服务
 */
import { 
  getAllOrders, 
  getRecentlyUpdatedOrders, 
  getIncrementalOrders 
} from '../shopify/apiClient.js';
import { saveOrders, TaskType } from '../database/index.js';
import { SyncService } from './syncBase.js';

// 创建订单同步服务实例
const orderSyncService = new SyncService(
  '订单',
  TaskType.ORDER,
  getAllOrders,
  getRecentlyUpdatedOrders,
  getIncrementalOrders,
  saveOrders
);

/**
 * 同步指定店铺的订单数据
 * @param {string} shop - Shopify 店铺域名
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShopOrders(shop, options = {}) {
  return orderSyncService.syncShopData(shop, options);
}

/**
 * 同步所有店铺的订单数据
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllShopsOrders(options = {}) {
  return orderSyncService.syncAllShopsData(options);
}