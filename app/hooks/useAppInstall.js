/**
 * 应用安装钩子
 * 处理应用安装/重新安装时的逻辑
 */
import { markStoreAsActive } from '../services/database/storeService.js';

/**
 * 处理应用安装/重新安装
 * @param {Object} session - 会话对象
 * @returns {Promise<void>}
 */
export async function handleAppInstalled(session) {
  if (!session || !session.shop) {
    console.warn('处理应用安装时缺少会话信息');
    return;
  }
  
  const { shop } = session;
  
  try {
    console.log(`应用被安装/重新安装到商店: ${shop}`);
    
    // 记录/更新商店信息
    const storeData = {
      status: 'ACTIVE',
      locale: session.locale,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      country: session.country,
      lastLogin: new Date()
    };
    
    const updatedStore = await markStoreAsActive(shop);
    console.log(`商店 ${shop} 状态已更新为活跃: ${JSON.stringify(updatedStore)}`);
    
    // 这里可以添加其他安装时的逻辑，例如：
    // 1. 初始化店铺数据
    // 2. 创建默认设置
    // 3. 发送欢迎邮件
    // 4. 开始首次数据同步
    
  } catch (error) {
    console.error(`处理应用安装时出错:`, error);
    // 不抛出错误，避免中断主流程
  }
} 