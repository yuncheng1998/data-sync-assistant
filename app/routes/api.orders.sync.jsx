import { json } from '@remix-run/node';
import { enhancedAuthentication } from '../middleware/authMiddleware.js';
import { syncShopOrders, syncAllShopsOrders } from '../services/sync/orderSync.js';
import { createSyncTask, completeSyncTask, TaskType } from '../services/database/syncTaskService.js';

/**
 * 手动触发订单同步 API
 */
export async function action({ request }) {
  try {
    // 验证请求
    const { session } = await enhancedAuthentication.admin(request);
    const { shop } = session;
    
    // 解析请求数据
    const formData = await request.formData();
    const syncType = formData.get('syncType') || 'current';
    
    let result;
    let taskShop = syncType === 'all' ? 'all' : shop;
    // 创建同步任务记录
    const taskRecord = await createSyncTask(TaskType.ORDER, taskShop);
    
    try {
      if (syncType === 'all') {
        // 同步所有店铺的订单
        console.log('手动触发: 同步所有店铺的订单');
        result = await syncAllShopsOrders();
      } else {
        // 只同步当前店铺的订单
        console.log(`手动触发: 同步店铺 ${shop} 的订单`);
        result = await syncShopOrders(shop);
      }
      
      // 更新任务记录
      await completeSyncTask(taskRecord.id, result.success, result);
    } catch (error) {
      console.error('订单同步 API 执行失败:', error);
      
      // 更新任务记录为失败
      await completeSyncTask(taskRecord.id, false, {
        success: false,
        message: `订单同步失败: ${error.message}`,
        error: error.stack
      });
      
      throw error;
    }
    
    return json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('订单同步 API 调用失败:', error);
    
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
    message: '使用 POST 请求触发订单同步',
    timestamp: new Date().toISOString()
  });
} 