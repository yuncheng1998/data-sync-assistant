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
    // 提取商店信息
    let shop = null;
    try {
      const url = new URL(request.url);
      shop = url.searchParams.get('shop') || null;
      console.log(`[认证流程] 开始认证过程, 请求URL: ${request.url}`);
      console.log(`[认证流程] 商店参数: ${shop || '未提供'}`);
      console.log(`[认证流程] 请求方法: ${request.method}`);
      
      // 记录主要请求头
      const headers = {};
      ['user-agent', 'referer', 'origin', 'host'].forEach(header => {
        headers[header] = request.headers.get(header) || '未提供';
      });
      console.log(`[认证流程] 关键请求头:`, JSON.stringify(headers));
      
      // 记录查询参数
      const params = {};
      url.searchParams.forEach((value, key) => {
        // 敏感参数处理
        if (['code', 'state'].includes(key)) {
          params[key] = value ? '存在但已脱敏' : '未提供';
        } else {
          params[key] = value;
        }
      });
      console.log(`[认证流程] 查询参数:`, JSON.stringify(params));
    } catch (e) {
      console.error(`[认证流程] 提取请求信息时出错:`, e);
    }
    
    try {
      console.log(`[认证流程] 调用Shopify认证方法...`);
      // 调用原始Shopify认证方法
      const result = await authenticate.admin(request);
      
      // 如果认证成功，记录认证信息
      if (result && result.session) {
        console.log(`[认证流程] 认证成功, 商店: ${result.session.shop}`);
        console.log(`[认证流程] 会话信息: scopes=${result.session.scope}, accessToken=${result.session.accessToken ? '已存在' : '未存在'}`);
        
        // 异步记录认证信息，不阻塞主流程
        logStoreAuthentication(result.session, request).catch(error => 
          console.error('[认证流程] 记录认证信息失败:', error)
        );
      } else {
        console.log(`[认证流程] 认证处理完成，但未返回会话信息`);
      }
      
      return result;
    } catch (error) {
      // 详细记录错误信息
      console.error(`[认证流程] 认证失败:`, error);
      console.error(`[认证流程] 错误类型: ${error.constructor.name}`);
      console.error(`[认证流程] 错误消息: ${error.message}`);
      console.error(`[认证流程] 错误堆栈: ${error.stack}`);
      
      // 检查是否有错误代码或特定返回值
      if (error.code || error.statusCode) {
        console.error(`[认证流程] 错误代码: ${error.code || error.statusCode}`);
      }
      
      // 检查环境变量配置
      console.log(`[认证流程] 环境变量检查: SHOPIFY_API_KEY=${process.env.SHOPIFY_API_KEY ? '已设置' : '未设置'}, SHOPIFY_API_SECRET=${process.env.SHOPIFY_API_SECRET ? '已设置' : '未设置'}, HOST=${process.env.HOST ? '已设置' : '未设置'}`);
      
      // 记录认证失败（如果有商店信息）
      if (shop) {
        const errorMessage = error.message || '认证过程中发生未知错误';
        console.log(`[认证流程] 记录商店 ${shop} 认证失败信息: ${errorMessage}`);
        
        logAuthenticationFailure(shop, errorMessage, request).catch(err => 
          console.error('[认证流程] 记录认证失败信息失败:', err)
        );
      }
      
      // 重新抛出丰富的错误信息
      const enhancedError = new Error(`商店认证失败${shop ? `: ${shop}` : ''}, 原因: ${error.message || '认证过程中发生未知错误'}`);
      enhancedError.originalError = error;
      enhancedError.stack = error.stack;
      enhancedError.shopDomain = shop;
      throw enhancedError;
    }
  },
  
  // 保留原始认证方法的其他属性
  public: authenticate.public,
  webhook: authenticate.webhook
}; 