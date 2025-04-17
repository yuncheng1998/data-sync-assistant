/**
 * GraphQL 上下文构建器
 * 提供执行上下文，包括数据库连接和身份验证信息
 */
import prisma from '../db.server.js';
import shopify from '../shopify.server.js';

/**
 * 构建 GraphQL 上下文
 * @param {Object} request - HTTP请求对象
 * @returns {Promise<Object>} GraphQL上下文
 */
export async function buildContext({ request }) {
  try {
    // 尝试获取会话（可选）
    // 这允许将来基于用户或店铺进行权限控制
    let session = null;
    
    try {
      const authHeader = request.headers.get('Authorization');
      const shopHeader = request.headers.get('X-Shopify-Shop-Domain');
      
      if (authHeader && authHeader.startsWith('Bearer ') && shopHeader) {
        const token = authHeader.substring(7);
        
        // 为店铺查找会话
        const sessions = await shopify.sessionStorage.findSessionsByShop(shopHeader);
        session = sessions.find(s => s.accessToken === token);
      }
    } catch (error) {
      console.warn('GraphQL 上下文构建中的身份验证警告:', error.message);
      // 继续，因为身份验证是可选的（取决于查询）
    }
    
    // 返回上下文对象
    return {
      prisma,
      session,
      shop: session?.shop || null
    };
  } catch (error) {
    console.error('构建 GraphQL 上下文时出错:', error);
    // 返回基本上下文
    return { prisma };
  }
}

export default buildContext; 