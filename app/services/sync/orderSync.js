/**
 * 订单同步服务
 */
import { 
  getAllOrders, 
  getRecentlyUpdatedOrders, 
  getIncrementalOrders 
} from '../shopify/apiClient.js';
import { saveOrders, prisma, TaskType } from '../database/index.js';
import shopify from '../../shopify.server.js';

/**
 * 同步指定店铺的订单数据
 * @param {string} shop - Shopify 店铺域名
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShopOrders(shop, options = {}) {
  console.log(`开始为店铺 ${shop} 同步订单数据...`);
  
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
          taskType: TaskType.ORDER,
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
      }
    }
    
    // 根据同步策略选择合适的API调用
    let orders;
    if (options.fullSync) {
      // 全量同步
      console.log(`执行全量同步所有订单...`);
      orders = await getAllOrders(shop, validSession.accessToken, options);
    } else if (options.recentOnly) {
      // 仅同步最近订单（默认7天）
      const days = options.days || 7;
      console.log(`仅同步最近 ${days} 天更新的订单...`);
      orders = await getRecentlyUpdatedOrders(shop, validSession.accessToken, days);
    } else if (lastSyncTime) {
      // 增量同步
      console.log(`执行增量同步，获取 ${lastSyncTime.toISOString()} 后更新的订单...`);
      orders = await getIncrementalOrders(shop, validSession.accessToken, lastSyncTime);
    } else {
      // 默认获取最近30天的订单
      console.log(`执行默认同步（最近30天的订单）...`);
      orders = await getRecentlyUpdatedOrders(shop, validSession.accessToken, 30);
    }
    
    if (!orders || orders.length === 0) {
      console.log(`店铺 ${shop} 没有需要同步的订单数据`);
      return { success: true, message: '没有订单数据需要同步', count: 0 };
    }
    
    // 保存订单数据到数据库
    console.log(`获取到 ${orders.length} 个订单，正在保存到数据库...`);
    const result = await saveOrders(orders);
    
    // 返回同步结果
    return {
      success: true,
      message: `成功同步 ${orders.length} 个订单`,
      count: orders.length,
      details: result
    };
  } catch (error) {
    console.error(`订单同步失败:`, error);
    return {
      success: false,
      message: `订单同步失败: ${error.message}`,
      error: error.stack,
      count: 0
    };
  }
}

/**
 * 同步所有店铺的订单数据
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllShopsOrders(options = {}) {
  console.log(`开始同步所有店铺的订单数据...`);
  
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
        orders: 0 
      };
    }
    
    // 同步每个店铺的订单
    const results = [];
    let totalOrders = 0;
    let allSuccess = true;
    
    for (const shop of uniqueShops) {
      const result = await syncShopOrders(shop, options);
      results.push({ shop, ...result });
      
      if (!result.success) {
        allSuccess = false;
      }
      
      if (result.success && result.count) {
        totalOrders += result.count;
      }
    }
    
    // 返回同步结果
    const message = allSuccess
      ? `已同步 ${uniqueShops.length} 个店铺的 ${totalOrders} 个订单`
      : `部分店铺同步失败，已成功同步 ${totalOrders} 个订单`;
      
    return {
      success: allSuccess,
      message,
      shops: uniqueShops.length,
      orders: totalOrders,
      details: results
    };
  } catch (error) {
    console.error(`同步所有店铺订单失败:`, error);
    return {
      success: false,
      message: `同步所有店铺订单失败: ${error.message}`,
      error: error.stack,
      shops: 0,
      orders: 0
    };
  }
}

/**
 * 同步指定店铺的订单数据（简化接口，仅需ID和Token）
 * @param {string} shopId - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function syncOrdersForShop(shopId, accessToken, options = {}) {
  console.log(`开始为店铺 ${shopId} 同步订单数据...`);
  
  try {
    if (!shopId || !accessToken) {
      throw new Error('店铺ID和访问令牌都是必需的');
    }
    
    // 根据同步策略选择合适的API调用
    let orders;
    if (options.fullSync) {
      // 全量同步
      console.log(`执行全量同步所有订单...`);
      orders = await getAllOrders(shopId, accessToken, options);
    } else if (options.recentOnly) {
      // 仅同步最近订单（默认7天）
      const days = options.days || 7;
      console.log(`仅同步最近 ${days} 天更新的订单...`);
      orders = await getRecentlyUpdatedOrders(shopId, accessToken, days);
    } else {
      // 默认获取最近30天的订单
      console.log(`执行默认同步（最近30天的订单）...`);
      orders = await getRecentlyUpdatedOrders(shopId, accessToken, 30);
    }
    
    if (!orders || orders.length === 0) {
      console.log(`店铺 ${shopId} 没有需要同步的订单数据`);
      return { success: true, message: '没有订单数据需要同步', count: 0 };
    }
    
    // 保存订单数据到数据库
    console.log(`获取到 ${orders.length} 个订单，正在保存到数据库...`);
    const result = await saveOrders(orders);
    
    // 返回同步结果
    return {
      success: true,
      message: `成功同步 ${orders.length} 个订单`,
      count: orders.length,
      details: result
    };
  } catch (error) {
    console.error(`订单同步失败:`, error);
    return {
      success: false,
      message: `订单同步失败: ${error.message}`,
      error: error.stack,
      count: 0
    };
  }
} 