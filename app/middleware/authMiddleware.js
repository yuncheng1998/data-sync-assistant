/**
 * 认证中间件
 * 封装Shopify认证方法，添加自定义钩子
 */
import { authenticate } from '../shopify.server.js';
import { logStoreAuthentication, logAuthenticationFailure } from '../hooks/useAuthHooks.js';

/**
 * 增强版认证中间件
 * 包装原始的authenticate.admin方法，并添加认证日志记录功能
 */
export const enhancedAuthentication = {
  /**
   * 商店管理员认证
   * @param {Request} request - 请求对象
   * @returns {Promise<{session: Object}>} 认证成功的会话
   */
  async admin(request) {
    try {
      // 调用原始Shopify认证方法
      const result = await authenticate.admin(request);
      
      // 如果认证成功，记录认证信息
      if (result && result.session) {
        // 异步记录认证信息，不阻塞主流程
        logStoreAuthentication(result.session, request).catch(error => 
          console.error('记录认证信息失败:', error)
        );
      }
      
      return result;
    } catch (error) {
      // 提取商店信息（如果可能）
      let shop = null;
      try {
        const url = new URL(request.url);
        shop = url.searchParams.get('shop') || null;
      } catch (e) {
        // 忽略URL解析错误
      }
      
      // 记录认证失败（如果有商店信息）
      if (shop) {
        logAuthenticationFailure(shop, error.message || '认证过程中发生未知错误', request).catch(err => 
          console.error('记录认证失败信息失败:', err)
        );
      }
      
      // 重新抛出原始错误
      throw error;
    }
  },
  
  // 保留原始认证方法的其他属性
  public: authenticate.public,
  webhook: authenticate.webhook
}; 