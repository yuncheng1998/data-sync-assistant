/**
 * Shopify APP卸载Webhook处理
 * 当商店卸载应用时，Shopify会发送webhook通知
 */
import { json } from '@remix-run/node';
import { authenticate } from '../../../shopify.server.js';
import prisma from '../../../db.server.js';
import { markStoreAsUninstalled } from '../../../services/database/storeService.js';

/**
 * 处理POST请求 - Shopify webhooks总是POST请求
 */
export async function action({ request }) {
  try {
    console.log('接收到APP卸载webhook请求');

    // 使用Shopify SDK验证webhook请求
    const { topic, shop, body } = await authenticate.webhook(request);

    // 确认是app/uninstalled事件
    if (topic !== 'app/uninstalled') {
      console.warn(`收到非预期的webhook主题: ${topic}，期望主题为 app/uninstalled`);
      return json({ message: `Webhook主题不匹配` }, { status: 400 });
    }

    console.log(`商店 ${shop} 已卸载应用`);

    // 清理数据库中的会话记录
    await handleAppUninstalled(shop);

    // 成功响应 - Shopify期望一个简单的成功响应
    return json({ success: true });
  } catch (error) {
    console.error('处理APP卸载webhook失败:', error);
    return json(
      { message: '无效的webhook请求', error: error.message },
      { status: 401 }
    );
  }
}

/**
 * 处理应用卸载后的逻辑
 * @param {string} shop - 商店域名 
 */
async function handleAppUninstalled(shop) {
  try {
    console.log(`开始清理商店 ${shop} 的数据`);

    // 删除该商店的会话数据
    const sessionsDeleted = await prisma.session.deleteMany({
      where: { shop }
    });
    console.log(`已删除 ${sessionsDeleted.count} 个会话记录`);

    // 更新商店状态
    try {
      await markStoreAsUninstalled(shop);
      console.log(`已将商店 ${shop} 状态更新为UNINSTALLED`);
    } catch (err) {
      console.error(`更新商店状态失败: ${err.message}`);
      // 继续处理，不要中断流程
    }

    // 停止针对该商店的所有同步任务（如果有）
    try {
      // 导入cron服务模块
      const cronService = await import('../../../services/cron/cronService.js');
      
      // 停止商店相关的同步任务
      if (typeof cronService.stopShopSyncTasks === 'function') {
        await cronService.stopShopSyncTasks(shop);
        console.log(`已停止商店 ${shop} 的所有同步任务`);
      }
    } catch (err) {
      console.log(`停止同步任务失败: ${err.message}`);
      // 继续处理，不要中断流程
    }

    console.log(`商店 ${shop} 的清理工作已完成`);
  } catch (error) {
    console.error(`清理商店 ${shop} 数据时出错:`, error);
    throw error;
  }
}

/**
 * 支持GET请求，用于验证webhook端点
 */
export async function loader({ request }) {
  return json({ message: 'Shopify App卸载Webhook端点正常' });
} 