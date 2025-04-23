/**
 * 认证钩子
 * 处理应用认证相关的逻辑
 */
import { 
  recordAuthLog, 
  recordAuthError, 
  updateLastAuthenticated 
} from '../services/database/authLogService.js';

/**
 * 记录商店认证信息
 * @param {Object} session - Shopify会话对象
 * @param {Object} request - 请求对象（可选）
 * @returns {Promise<void>}
 */
export async function logStoreAuthentication(session, request = null) {
  if (!session || !session.shop) {
    console.warn('记录认证信息时缺少会话数据');
    return;
  }
  
  const { shop } = session;
  
  try {
    console.log(`商店认证成功: ${shop}`);
    
    // 提取请求信息（如果可用）
    let ipAddress = null;
    let userAgent = null;
    
    if (request) {
      // 尝试获取IP地址
      ipAddress = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') ||
                  'unknown';
      
      // 尝试获取UserAgent
      userAgent = request.headers.get('user-agent') || 'unknown';
    }
    
    // 记录认证信息
    await recordAuthLog({
      shop,
      authenticatedAt: new Date(),
      accessScopes: session.scope || '',
      userType: session.onlineAccessInfo?.staff_member ? 'STAFF' : 'OWNER',
      userEmail: session.onlineAccessInfo?.email || session.email || null,
      userName: [
        session.onlineAccessInfo?.first_name || session.firstName || '', 
        session.onlineAccessInfo?.last_name || session.lastName || ''
      ].filter(Boolean).join(' ').trim() || null,
      ipAddress,
      userAgent
    });
    
    // 更新商店的最后认证时间
    await updateLastAuthenticated(shop);
    
  } catch (error) {
    console.error(`记录商店认证信息时出错:`, error);
    // 不抛出错误，避免中断主认证流程
  }
}

/**
 * 记录认证失败信息
 * @param {string} shop - 商店域名
 * @param {string} errorMessage - 错误信息
 * @param {Object} request - 请求对象（可选）
 * @returns {Promise<void>}
 */
export async function logAuthenticationFailure(shop, errorMessage, request = null) {
  if (!shop) {
    console.warn('记录认证失败信息时缺少商店数据');
    return;
  }
  
  try {
    console.log(`商店认证失败: ${shop}，原因: ${errorMessage}`);
    
    // 提取请求信息（如果可用）
    let ipAddress = null;
    let userAgent = null;
    
    if (request) {
      // 尝试获取IP地址
      ipAddress = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') ||
                  'unknown';
      
      // 尝试获取UserAgent
      userAgent = request.headers.get('user-agent') || 'unknown';
    }
    
    // 记录认证失败信息
    await recordAuthError({
      shop,
      errorAt: new Date(),
      errorMessage: errorMessage || '未知错误',
      ipAddress,
      userAgent
    });
    
  } catch (error) {
    console.error(`记录商店认证失败信息时出错:`, error);
  }
} 