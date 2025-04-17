import { json } from '@remix-run/node';
import { authenticate } from '../shopify.server.js';
import { syncShopProducts, syncAllShopsProducts } from '../services/sync/productSync.js';

/**
 * 手动触发产品同步 API
 */
export async function action({ request }) {
  try {
    // 验证请求
    const { session } = await authenticate.admin(request);
    const { shop } = session;
    
    // 解析请求数据
    const formData = await request.formData();
    const syncType = formData.get('syncType') || 'current';
    
    let result;
    if (syncType === 'all') {
      // 同步所有店铺的产品
      console.log('手动触发: 同步所有店铺的产品');
      result = await syncAllShopsProducts();
    } else {
      // 只同步当前店铺的产品
      console.log(`手动触发: 同步店铺 ${shop} 的产品`);
      result = await syncShopProducts(shop);
    }
    
    return json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('同步 API 调用失败:', error);
    
    return json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * 响应 OPTIONS 请求 (用于 CORS 预检)
 */
export async function loader({ request }) {
  // 直接返回当前状态，不执行同步
  return json({
    success: true,
    message: '使用 POST 请求触发产品同步',
    timestamp: new Date().toISOString()
  });
} 