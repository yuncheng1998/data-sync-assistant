/**
 * 折扣同步服务
 */
import { 
  getAllPriceRules, 
  getRecentlyUpdatedPriceRules, 
  getIncrementalPriceRules 
} from '../shopify/apiClient.js';
import { savePriceRules, TaskType } from '../database/index.js';
import { SyncService } from './syncBase.js';

// 创建折扣同步服务实例
const discountSyncService = new SyncService(
  '折扣',
  TaskType.DISCOUNT,
  getAllPriceRules,
  getRecentlyUpdatedPriceRules,
  getIncrementalPriceRules,
  savePriceRules
);

/**
 * 同步指定店铺的折扣数据
 * @param {string} shop - Shopify 店铺域名
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShopDiscounts(shop, options = {}) {
  return discountSyncService.syncShopData(shop, options);
}

/**
 * 同步所有店铺的折扣数据
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllShopsDiscounts(options = {}) {
  return discountSyncService.syncAllShopsData(options);
} 