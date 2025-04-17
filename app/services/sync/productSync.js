/**
 * 产品同步服务
 */
import { getAllProducts } from '../shopify/apiClient.js';
import { saveProducts } from '../database/productService.js';
import shopify from '../../shopify.server.js';

/**
 * 同步指定店铺的产品数据
 * @param {string} shop - Shopify 店铺域名
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShopProducts(shop) {
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
    
    // 获取产品数据
    console.log(`正在从 Shopify API 获取 ${shop} 的产品数据...`);
    const products = await getAllProducts(shop, validSession.accessToken);
    
    if (!products || products.length === 0) {
      console.log(`店铺 ${shop} 没有产品数据`);
      return { success: true, message: '没有产品数据需要同步', count: 0 };
    }
    
    // 保存产品数据到数据库
    console.log(`获取到 ${products.length} 个产品，正在保存到数据库...`);
    const result = await saveProducts(products);
    
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
      error: error.stack
    };
  }
}

/**
 * 同步所有店铺的产品数据
 * @returns {Promise<Object>} 同步结果
 */
export async function syncAllShopsProducts() {
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
    
    for (const shop of uniqueShops) {
      const result = await syncShopProducts(shop);
      results.push({ shop, ...result });
      
      if (result.success && result.count) {
        totalProducts += result.count;
      }
    }
    
    // 返回同步结果
    return {
      success: true,
      message: `已同步 ${uniqueShops.length} 个店铺的 ${totalProducts} 个产品`,
      shops: uniqueShops.length,
      products: totalProducts,
      details: results
    };
  } catch (error) {
    console.error(`同步所有店铺产品失败:`, error);
    return {
      success: false,
      message: `同步所有店铺产品失败: ${error.message}`,
      error: error.stack
    };
  }
} 