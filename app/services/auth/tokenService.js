/**
 * 令牌验证服务
 * 处理 JWT 验证相关功能
 */
import jwt from 'jsonwebtoken';

// JWT密钥 - 从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * 验证JWT令牌
 * @param {string} token - 待验证的令牌
 * @returns {Object|null} 解码后的令牌内容或null（验证失败时）
 */
export function verifyToken(token) {
  if (!token) return null;
  
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.warn(`JWT验证失败: ${error.message}`);
    return null;
  }
}

/**
 * 从请求头中提取令牌
 * @param {string} authHeader - Authorization请求头
 * @returns {string|null} 提取的令牌或null
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // 移除 "Bearer " 前缀
}

/**
 * 从请求中提取并验证用户
 * @param {Request} request - HTTP请求
 * @returns {Object} 包含用户信息和认证状态
 */
export function getUserFromRequest(request) {
  try {
    // 获取Authorization头
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return { isAuthenticated: false, error: '缺少Authorization头' };
    }
    
    // 提取令牌
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return { isAuthenticated: false, error: '无效的Authorization格式，应为Bearer token' };
    }
    
    // 验证令牌
    const decoded = verifyToken(token);
    if (!decoded) {
      return { isAuthenticated: false, error: '无效或已过期的令牌' };
    }
    
    // 返回用户信息
    return {
      isAuthenticated: true,
      user: {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      },
      token
    };
  } catch (error) {
    console.error('令牌验证过程失败:', error);
    return { isAuthenticated: false, error: '令牌验证过程中出错' };
  }
}

export default {
  verifyToken,
  extractTokenFromHeader,
  getUserFromRequest
}; 