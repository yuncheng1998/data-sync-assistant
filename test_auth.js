/**
 * JWT 认证测试脚本
 * 
 * 用法：
 * 1. 在浏览器控制台中运行
 * 2. 使用 Node.js 运行: node test_auth.js
 */

// API 基础 URL
const API_BASE_URL = 'http://localhost:3000';

// 测试用户凭证
const TEST_USER = { email: 'user@example.com', password: '123456' };

/**
 * 获取 JWT 令牌
 */
async function getToken(email, password) {
  try {
    console.log(`尝试获取令牌，用户: ${email}`);
    
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✓ 认证成功!');
      console.log(`令牌: ${result.token.substring(0, 20)}...`);
      console.log(`用户: ${result.user.email} (${result.user.role})`);
      return result.token;
    } else {
      console.error(`✗ 认证失败: ${result.error || '未知错误'}`);
      return null;
    }
  } catch (error) {
    console.error(`✗ 请求异常: ${error.message}`);
    return null;
  }
}

/**
 * 获取用户信息
 */
async function getUserInfo(token) {
  try {
    console.log('尝试获取用户信息...');
    
    const response = await fetch(`${API_BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: `{
          me {
            userId
            email
            role
          }
        }`
      })
    });
    
    const result = await response.json();
    
    if (response.ok && !result.errors) {
      console.log('✓ 查询成功!');
      console.log('用户信息:', result.data?.me);
      return result.data?.me;
    } else {
      console.error(`✗ 查询失败:`, result.errors || result);
      return null;
    }
  } catch (error) {
    console.error(`✗ 请求异常: ${error.message}`);
    return null;
  }
}

/**
 * 运行测试
 */
async function runTest() {
  console.log('=== JWT 认证测试 ===');
  
  // 1. 获取令牌
  const token = await getToken(TEST_USER.email, TEST_USER.password);
  if (!token) return;
  
  // 2. 使用令牌获取用户信息
  const userInfo = await getUserInfo(token);
  if (!userInfo) return;
  
  console.log('=== 测试完成 ===');
}

// 检查是否在 Node.js 环境中
if (typeof window === 'undefined') {
  // 导入 node-fetch (如果在 Node.js 中)
  if (!globalThis.fetch) {
    console.log('在 Node.js 环境中运行需要安装 node-fetch:');
    console.log('npm install node-fetch');
    process.exit(1);
  }
  
  // 运行测试
  runTest().catch(err => console.error('测试失败:', err));
} else {
  // 在浏览器环境中运行
  console.log('在浏览器控制台中运行测试...');
  runTest().catch(err => console.error('测试失败:', err));
} 