/**
 * 产品同步服务
 */
import { getAllProducts } from '../shopify/apiClient.js';
import { saveProducts, TaskType } from '../database/index.js';
import { SyncService } from './syncBase.js';

// 创建产品同步服务实例
const productSyncService = new SyncService(
  '产品', 
  TaskType.PRODUCT,
  getAllProducts,
  (shop, accessToken, days) => {
    // 目前暂无专门的近期产品API，使用标准API+时间范围
    const date = new Date();
    date.setDate(date.getDate() - days);
    const options = { updatedAfter: date.toISOString().split('T')[0] };
    return getAllProducts(shop, accessToken, options);
  },
  (shop, accessToken, lastSyncTime) => {
    // 增量同步，传递更新时间
    const options = { updatedAfter: lastSyncTime.toISOString().split('T')[0] };
    return getAllProducts(shop, accessToken, options);
  },
  saveProducts
);

/**
 * 同步指定店铺的产品数据
 * @param {string} shop - Shopify 店铺域名
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShopProducts(shop, options = {}) {
  return productSyncService.syncShopData(shop, options);
}

/**
 * 同步所有店铺的产品数据
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllShopsProducts(options = {}) {
  return productSyncService.syncAllShopsData(options);
} 