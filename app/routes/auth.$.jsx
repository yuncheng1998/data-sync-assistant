/**
 * 通用认证路由处理
 * 处理来自Shopify的所有OAuth回调
 */
import { enhancedAuthentication } from "../middleware/authMiddleware";
import { json } from "@remix-run/node";

/**
 * 处理所有认证请求，包括OAuth回调
 */
export const loader = async ({ request }) => {
  console.log(`[Auth.*] 收到认证回调请求，URL: ${request.url}`);
  
  try {
    // 提取URL参数
    const url = new URL(request.url);
    const params = {};
    url.searchParams.forEach((value, key) => {
      // 敏感参数处理
      if (['code', 'state'].includes(key)) {
        params[key] = value ? '存在但已脱敏' : '未提供';
      } else {
        params[key] = value;
      }
    });
    console.log(`[Auth.*] 请求参数:`, JSON.stringify(params));
    
    const shop = url.searchParams.get('shop');
    if (shop) {
      console.log(`[Auth.*] 商店: ${shop}`);
    }
  
    console.log(`[Auth.*] 开始调用 enhancedAuthentication.admin...`);
    // 使用增强版的认证中间件
    const result = await enhancedAuthentication.admin(request);
    console.log(`[Auth.*] enhancedAuthentication.admin 处理完成，结果类型: ${typeof result}`);
    
    // 如果是重定向响应，记录目标
    if (result instanceof Response && result.status >= 300 && result.status < 400) {
      const location = result.headers.get('Location');
      console.log(`[Auth.*] 返回重定向到: ${location}`);
    }
    
    return result;
  } catch (error) {
    console.error(`[Auth.*] 认证处理过程中出错:`, error);
    console.error(`[Auth.*] 错误类型: ${error.constructor.name}`);
    console.error(`[Auth.*] 错误消息: ${error.message}`);
    console.error(`[Auth.*] 错误堆栈: ${error.stack}`);
    
    // 检查环境变量配置
    console.log(`[Auth.*] 环境变量检查: SHOPIFY_API_KEY=${process.env.SHOPIFY_API_KEY ? '已设置' : '未设置'}, SHOPIFY_API_SECRET=${process.env.SHOPIFY_API_SECRET ? '已设置' : '未设置'}, HOST=${process.env.HOST ? '已设置' : '未设置'}`);
    
    // 返回友好的错误响应
    return json({
      error: true,
      message: `认证处理失败: ${error.message}`,
      detail: process.env.NODE_ENV !== 'production' ? error.stack : '请查看服务器日志以获取详细信息'
    }, { status: 500 });
  }
};
