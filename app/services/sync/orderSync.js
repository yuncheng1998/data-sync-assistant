/**
 * 订单同步服务
 */
import { getAllOrders } from '../shopify/apiClient.js';
import { saveOrders } from '../database/orderService.js';
import shopify from '../../shopify.server.js';

/**
 * 同步指定店铺的订单数据
 * @param {string} shop - Shopify 店铺域名
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShopOrders(shop) {
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
    
    // 获取订单数据
    console.log(`正在从 Shopify API 获取 ${shop} 的订单数据...`);
    const orders = await getAllOrders(shop, validSession.accessToken);
    
    if (!orders || orders.length === 0) {
      console.log(`店铺 ${shop} 没有订单数据`);
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
      error: error.stack
    };
  }
}

/**
 * 同步所有店铺的订单数据
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllShopsOrders() {
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
    
    for (const shop of uniqueShops) {
      const result = await syncShopOrders(shop);
      results.push({ shop, ...result });
      
      if (result.success && result.count) {
        totalOrders += result.count;
      }
    }
    
    // 返回同步结果
    return {
      success: true,
      message: `已同步 ${uniqueShops.length} 个店铺的 ${totalOrders} 个订单`,
      shops: uniqueShops.length,
      orders: totalOrders,
      details: results
    };
  } catch (error) {
    console.error(`同步所有店铺订单失败:`, error);
    return {
      success: false,
      message: `同步所有店铺订单失败: ${error.message}`,
      error: error.stack
    };
  }
}

/**
 * 同步指定店铺的订单数据（简化接口，仅需ID和Token）
 * @param {string} shopId - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @returns {Promise<Object>} 同步结果
 */
export async function syncOrdersForShop(shopId, accessToken) {
  console.log(`开始为店铺 ${shopId} 同步订单数据...`);
  
  try {
    if (!shopId || !accessToken) {
      throw new Error('店铺ID和访问令牌都是必需的');
    }
    
    // 获取订单数据
    console.log(`正在从 Shopify API 获取 ${shopId} 的订单数据...`);
    const orders = await getAllOrders(shopId, accessToken);
    
    if (!orders || orders.length === 0) {
      console.log(`店铺 ${shopId} 没有订单数据`);
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
      error: error.stack
    };
  }
} 