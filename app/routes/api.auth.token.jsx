/**
 * JWT 令牌生成 API
 * 仅用于开发/测试 - 生产环境应使用更安全的方式生成令牌
 */
import { json } from '@remix-run/node';
import { authenticate } from '../shopify.server.js';
import jwt from 'jsonwebtoken';
import authConfig from '../../config/auth.js';

// 是否为开发环境
const IS_DEV = authConfig.isDev;

// JWT配置
const JWT_SECRET = authConfig.jwt.secret;
const TOKEN_EXPIRES_IN = authConfig.jwt.expiresIn;

/**
 * 生成JWT令牌
 * @param {Object} payload - 令牌载荷
 * @returns {string} JWT令牌
 */
function generateJWT(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

/**
 * 生成测试令牌（仅用于开发/测试）
 * @param {Object} data - 令牌数据
 * @returns {string} 测试令牌
 */
function generateTestToken(data) {
  return generateJWT({
    ...data,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时
  });
}

/**
 * 获取当前令牌信息（GET 请求）
 */
export async function loader({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    
    // 返回当前会话信息
    return json({
      success: true,
      message: '当前会话信息',
      session: {
        shop: session.shop,
        accessToken: session.accessToken
      },
      bearer: `Bearer ${session.accessToken}`,
      shopHeader: `X-Shopify-Shop-Domain: ${session.shop}`
    });
  } catch (error) {
    return json({
      success: false,
      error: '获取会话信息失败',
      message: error.message
    }, { status: 401 });
  }
}

/**
 * 生成测试令牌（POST 请求）
 */
export async function action({ request }) {
  try {
    // 只在开发环境中启用
    if (!IS_DEV) {
      return json({
        success: false,
        error: '此端点仅在开发环境中可用'
      }, { status: 403 });
    }
    
    // 验证身份
    const { session } = await authenticate.admin(request);
    
    // 获取请求数据
    const formData = await request.formData();
    const tokenType = formData.get('type') || 'shopify';
    
    let token;
    
    if (tokenType === 'jwt') {
      // 生成JWT令牌
      token = generateJWT({
        userId: session.id || 'test-user',
        email: `admin@${session.shop}`, // 使用基于店铺的邮箱作为默认值
        shop: session.shop,
        role: 'admin'
      });
      
      if (IS_DEV) {
        console.log(`已为店铺 ${session.shop} 生成JWT令牌`);
      }
    } else {
      // 返回Shopify访问令牌
      token = session.accessToken;
      
      if (IS_DEV) {
        console.log(`已返回店铺 ${session.shop} 的Shopify访问令牌`);
      }
    }
    
    // 返回令牌
    return json({
      success: true,
      tokenType,
      token,
      shop: session.shop,
      bearer: `Bearer ${token}`,
      shopHeader: `X-Shopify-Shop-Domain: ${session.shop}`,
      expiresIn: TOKEN_EXPIRES_IN,
      curlExample: `curl -X POST \\
  ${request.url.substring(0, request.url.lastIndexOf('/'))}'/graphql' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'X-Shopify-Shop-Domain: ${session.shop}' \\
  -d '{"query":"{\\n  products(pagination: {limit: 3}) {\\n    items {\\n      id\\n      title\\n    }\\n    totalCount\\n  }\\n}"}'`
    });
  } catch (error) {
    console.error("生成令牌时出错:", error);
    return json({
      success: false,
      error: '生成令牌失败',
      message: error.message
    }, { status: 500 });
  }
} 