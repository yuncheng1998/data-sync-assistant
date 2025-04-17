/**
 * GraphQL 上下文构建器
 * 提供执行上下文，包括数据库连接和身份验证信息
 */
import prisma from '../db.server.js';
import { getUserFromRequest } from '../services/auth/tokenService.js';

/**
 * 构建 GraphQL 上下文
 * @param {Object} options - 上下文选项
 * @param {Request} options.request - HTTP请求
 * @returns {Promise<Object>} GraphQL上下文
 */
export async function buildContext({ request }) {
  try {
    // 验证请求中的令牌，获取用户信息
    const authResult = getUserFromRequest(request);
    
    // 如果用户未通过身份验证，但仍需继续处理请求（GraphiQL等）
    if (!authResult.isAuthenticated) {
      console.warn(`未经授权的GraphQL请求: ${authResult.error}`);
    } else {
      console.log(`已验证身份的GraphQL请求，用户: ${authResult.user.email}`);
    }
    
    // 构建并返回上下文
    return {
      prisma,
      user: authResult.user || null,
      isAuthenticated: authResult.isAuthenticated,
      authError: authResult.error || null
    };
  } catch (error) {
    console.error('构建 GraphQL 上下文时出错:', error);
    // 返回基本上下文
    return { 
      prisma,
      user: null,
      isAuthenticated: false,
      authError: '身份验证过程失败'
    };
  }
}

export default buildContext; 