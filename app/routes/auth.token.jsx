/**
 * JWT 令牌认证接口
 * 提供基于用户名密码的认证，返回JWT令牌
 */
import { json } from '@remix-run/node';
import jwt from 'jsonwebtoken';
import authConfig from '../../config/auth.js';

// 是否为开发环境
const IS_DEV = authConfig.isDev;

// 有效用户列表
const VALID_USERS = authConfig.users;

// JWT配置
const JWT_SECRET = authConfig.jwt.secret;
const TOKEN_EXPIRES_IN = authConfig.jwt.expiresIn;

/**
 * 验证用户凭据
 * @param {string} email - 邮箱地址
 * @param {string} password - 密码
 * @returns {Object|null} 用户信息或null（验证失败）
 */
function validateCredentials(email, password) {
  if (IS_DEV) {
    console.log(`尝试验证用户: ${email}`);
  }

  const user = VALID_USERS.find(user => user.email === email && user.password === password);
  
  if (!user && IS_DEV) {
    console.log(`验证失败: 用户 ${email} 凭据无效`);
    
    // 检查是否有匹配的邮箱但密码错误
    const userWithSameEmail = VALID_USERS.find(u => u.email === email);
    if (userWithSameEmail) {
      console.log(`提示: 邮箱 ${email} 存在，但密码不匹配`);
      console.log(`输入的密码: ${password}`);
      console.log(`期望的密码: ${userWithSameEmail.password}`);
    } else {
      console.log(`提示: 没有找到邮箱为 ${email} 的用户`);
      if (VALID_USERS.length > 0) {
        console.log('当前配置的用户邮箱:');
        VALID_USERS.forEach((u, i) => console.log(`  [${i + 1}] ${u.email}`));
      }
    }
  } else if (user && IS_DEV) {
    console.log(`验证成功: 用户 ${email} (${user.role})`);
  }
  
  return user || null;
}

/**
 * 生成JWT令牌
 * @param {Object} user - 用户信息
 * @returns {string} JWT令牌
 */
function generateToken(user) {
  const payload = {
    userId: user.userId,
    email: user.email,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

/**
 * 令牌认证处理 - POST请求
 */
export async function action({ request }) {
  // 仅处理POST请求
  if (request.method !== 'POST') {
    return json({ error: '仅支持POST请求' }, { status: 405 });
  }
  
  // 如果没有配置用户，直接返回错误
  if (VALID_USERS.length === 0) {
    return json({ 
      success: false,
      error: '系统未配置有效用户',
      message: '请在环境变量中配置USER_INFO'
    }, { status: 500 });
  }
  
  let data;
  try {
    // 解析请求体
    const contentType = request.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      data = await request.json();
    } else {
      // 尝试作为表单数据处理
      const formData = await request.formData();
      data = {
        email: formData.get('email'),
        password: formData.get('password')
      };
    }
    
    // 记录请求数据（仅开发模式）
    if (IS_DEV) {
      console.log('收到认证请求:');
      console.log(`  邮箱: ${data.email}`);
      console.log(`  密码: ${data.password ? '******' : '未提供'}`);
    }
    
    // 验证请求参数
    if (!data || !data.email || !data.password) {
      return json({ 
        success: false,
        error: '缺少必要的认证信息',
        required: ['email', 'password']
      }, { status: 400 });
    }
    
    // 验证凭据
    const user = validateCredentials(data.email, data.password);
    if (!user) {
      // 认证失败，返回401
      return json({ 
        success: false,
        error: '无效的用户名或密码' 
      }, { status: 401 });
    }
    
    // 生成JWT令牌
    const token = generateToken(user);
    
    // 设置响应头，允许跨域
    const headers = new Headers();
    headers.append('Access-Control-Allow-Origin', '*');
    headers.append('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.append('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 返回令牌
    return json({ 
      success: true,
      token,
      tokenType: 'Bearer',
      expiresIn: TOKEN_EXPIRES_IN,
      user: {
        userId: user.userId,
        email: user.email,
        role: user.role
      }
    }, { 
      status: 200,
      headers
    });
    
  } catch (error) {
    console.error('认证过程中出错:', error);
    return json({ 
      success: false,
      error: '认证处理失败', 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * 处理OPTIONS请求 - 支持CORS预检请求
 */
export async function loader({ request }) {
  // 处理OPTIONS请求，支持CORS
  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    headers.append('Access-Control-Allow-Origin', '*');
    headers.append('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.append('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return new Response(null, { status: 204, headers });
  }
  
  // 如果没有配置用户
  if (VALID_USERS.length === 0) {
    return json({
      success: false,
      message: '认证API - 未配置用户',
      error: '系统未配置有效用户，请在环境变量中设置USER_INFO'
    });
  }
  
  // 其他GET请求返回API信息
  const userExamples = VALID_USERS.map(u => ({ email: u.email }));
  
  return json({
    success: true,
    message: '认证API',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        email: '示例: ' + (userExamples.length > 0 ? userExamples[0].email : 'user@example.com'),
        password: '您的密码'
      },
      response: {
        token: 'jwt_token'
      }
    },
    // 仅在开发环境中显示可用账号列表
    ...(IS_DEV && { availableUsers: userExamples })
  });
} 