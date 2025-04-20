/**
 * 产品同步服务
 */
import { getAllProducts } from '../shopify/apiClient.js';
import { saveProducts, prisma, TaskType } from '../database/index.js';
import shopify from '../../shopify.server.js';

/**
 * 同步指定店铺的产品数据
 * @param {string} shop - Shopify 店铺域名
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShopProducts(shop, options = {}) {
  console.log(`开始为店铺 ${shop} 同步产品数据...`);
  
  try {
    // 获取店铺会话
    const session = await shopify.sessionStorage.findSessionsByShop(shop);
    
    if (!session || session.length === 0) {
      throw new Error(`未找到店铺 ${shop} 的有效会话`);
    }
    
    // 使用最新的有效会话
    const validSession = session.find(s => s.accessToken && (!s.expires || new Date(s.expires) > new Date()));
    
    if (!validSession) {
      throw new Error(`店铺 ${shop} 没有有效的访问令牌`);
    }
    
    // 获取上次同步时间，用于增量同步
    let lastSyncTime = null;
    if (options.incremental !== false) { // 默认进行增量同步
      const lastSyncTask = await prisma.syncTask.findFirst({
        where: {
          shopId: shop,
          taskType: TaskType.PRODUCT,
          status: 'completed'
        },
        orderBy: {
          endTime: 'desc'
        }
      });
      
      if (lastSyncTask?.endTime) {
        // 设置增量同步时间（从上次同步前1天开始，避免遗漏）
        lastSyncTime = new Date(lastSyncTask.endTime);
        lastSyncTime.setDate(lastSyncTime.getDate() - 1); // 往前1天，确保不会遗漏边界数据
        
        console.log(`使用增量同步，上次同步时间: ${lastSyncTime.toISOString()}`);
        
        // 为API请求添加更新时间筛选
        options.updatedAfter = lastSyncTime.toISOString().split('T')[0];
      }
    }
    
    // 获取产品数据
    console.log(`正在从 Shopify API 获取 ${shop} 的产品数据...`);
    const products = await getAllProducts(shop, validSession.accessToken, options);
    
    if (!products || products.length === 0) {
      console.log(`店铺 ${shop} 没有需要同步的产品数据`);
      return { success: true, message: '没有产品数据需要同步', count: 0 };
    }
    
    // 保存产品数据到数据库
    console.log(`获取到 ${products.length} 个产品，正在保存到数据库...`);
    const result = await saveProducts(products);
    
    // 检查保存结果中是否有错误
    if (!result.success) {
      return {
        success: false,
        message: `产品保存失败: ${result.error}`,
        error: result.error,
        count: 0
      };
    }
    
    // 返回同步结果
    return {
      success: true,
      message: `成功同步 ${products.length} 个产品`,
      count: products.length,
      details: result
    };
  } catch (error) {
    console.error(`产品同步失败:`, error);
    return {
      success: false,
      message: `产品同步失败: ${error.message}`,
      error: error.stack,
      count: 0
    };
  }
}

/**
 * 同步所有店铺的产品数据
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllShopsProducts(options = {}) {
  console.log(`开始同步所有店铺的产品数据...`);
  
  try {
    // 获取所有店铺会话
    const allSessions = await shopify.sessionStorage.findSessionsByShop();
    const uniqueShops = [];
    
    // 获取唯一店铺列表
    allSessions.forEach(session => {
      if (!uniqueShops.includes(session.shop)) {
        uniqueShops.push(session.shop);
      }
    });
    
    console.log(`找到 ${uniqueShops.length} 个店铺需要同步`);
    
    if (uniqueShops.length === 0) {
      return { 
        success: true, 
        message: '没有找到需要同步的店铺', 
        shops: 0, 
        products: 0 
      };
    }
    
    // 同步每个店铺的产品
    const results = [];
    let totalProducts = 0;
    let allSuccess = true;
    
    for (const shop of uniqueShops) {
      const result = await syncShopProducts(shop, options);
      results.push({ shop, ...result });
      
      if (!result.success) {
        allSuccess = false;
      }
      
      if (result.success && result.count) {
        totalProducts += result.count;
      }
    }
    
    // 检查是否有同步失败的情况
    const message = allSuccess
      ? `已同步 ${uniqueShops.length} 个店铺的 ${totalProducts} 个产品`
      : `部分店铺同步失败，已成功同步 ${totalProducts} 个产品`;
    
    // 返回同步结果
    return {
      success: allSuccess,
      message,
      shops: uniqueShops.length,
      products: totalProducts,
      details: results
    };
  } catch (error) {
    console.error(`同步所有店铺产品失败:`, error);
    return {
      success: false,
      message: `同步所有店铺产品失败: ${error.message}`,
      error: error.stack,
      shops: 0,
      products: 0
    };
  }
} 