/**
 * Shopify 认证主路由
 * 处理初始认证请求以及错误情况
 */
import { json } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import shopify from '../shopify.server.js';

/**
 * 处理GET请求
 */
export async function loader({ request }) {
  // 解析请求URL
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  
  console.log(`[Auth路由] 收到认证请求, URL: ${request.url}`);
  console.log(`[Auth路由] 商店参数: ${shop || '未提供'}`);
  
  // 1. 验证请求参数
  if (!shop) {
    console.error('[Auth路由] 缺少必要的shop参数');
    return json(
      { error: '缺少必要的shop参数' },
      { status: 400 }
    );
  }
  
  try {
    // 2. 验证shop格式
    if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)) {
      console.error(`[Auth路由] 无效的shop格式: ${shop}`);
      return json(
        { error: '无效的商店域名格式，请确保使用完整的myshopify.com域名' },
        { status: 400 }
      );
    }
    
    console.log(`[Auth路由] 开始redirect到登录页面...`);
    // 3. 重定向到登录页面
    return redirect(`/auth/login?shop=${shop}`);
    
  } catch (error) {
    // 记录详细错误信息
    console.error(`[Auth路由] 处理认证请求时发生错误:`, error);
    console.error(`[Auth路由] 错误类型: ${error.constructor.name}`);
    console.error(`[Auth路由] 错误消息: ${error.message}`);
    console.error(`[Auth路由] 错误堆栈: ${error.stack}`);
    
    // 检查环境变量
    console.log(`[Auth路由] 环境变量检查: SHOPIFY_API_KEY=${process.env.SHOPIFY_API_KEY ? '已设置' : '未设置'}, SHOPIFY_API_SECRET=${process.env.SHOPIFY_API_SECRET ? '已设置' : '未设置'}, HOST=${process.env.HOST ? process.env.HOST : '未设置'}`);
    
    // 返回详细错误信息
    return json(
      { 
        error: `商店认证失败: ${shop}`,
        message: error.message || '认证过程中发生未知错误',
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 