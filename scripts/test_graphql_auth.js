#!/usr/bin/env node

/**
 * GraphQL API 身份验证测试脚本
 * 
 * 此脚本测试以下认证场景:
 * 1. 无认证请求 (应当返回401错误)
 * 2. 使用JWT令牌认证
 * 3. 使用API密钥认证
 * 
 * 使用方法:
 * node scripts/test_graphql_auth.js [options]
 * 
 * 选项:
 * --host <url>  API主机地址 (默认: http://localhost:3000)
 * --jwt <token> JWT令牌 (如未提供将尝试使用API生成)
 * --api-key <key> API密钥 (如未提供将使用环境变量中的第一个密钥)
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');
const { exit } = require('process');

// 加载环境变量
dotenv.config();

// 解析命令行参数
const args = process.argv.slice(2);
let host = 'http://localhost:3000';
let jwt = null;
let apiKey = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host' && args[i + 1]) {
    host = args[i + 1];
    i++;
  } else if (args[i] === '--jwt' && args[i + 1]) {
    jwt = args[i + 1];
    i++;
  } else if (args[i] === '--api-key' && args[i + 1]) {
    apiKey = args[i + 1];
    i++;
  }
}

// 如果没有提供API密钥，尝试从环境变量中获取
if (!apiKey && process.env.ALLOWED_API_KEYS) {
  const keys = process.env.ALLOWED_API_KEYS.split(',').map(k => k.trim());
  if (keys.length > 0) {
    apiKey = keys[0];
  }
}

// 简单的GraphQL查询示例
const PRODUCTS_QUERY = `
  query {
    products(pagination: {limit: 2}) {
      items {
        id
        title
      }
      totalCount
    }
  }
`;

// 设置颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 控制台输出
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

// 分隔线
function divider() {
  log('\n' + '-'.repeat(80) + '\n', colors.blue);
}

// 测试GraphQL请求
async function testGraphQLRequest(description, headers = {}) {
  log(`测试场景: ${description}`, colors.cyan);
  
  try {
    // 记录请求信息
    log('请求头:', colors.yellow);
    Object.entries(headers).forEach(([key, value]) => {
      // 对令牌进行掩码处理，只显示前10个字符
      const displayValue = (key === 'Authorization' || key === 'X-API-Key') && value.length > 10
        ? value.substring(0, 10) + '...'
        : value;
      log(`  ${key}: ${displayValue}`);
    });

    const response = await fetch(`${host}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        query: PRODUCTS_QUERY
      })
    });

    const data = await response.json();
    
    log(`状态码: ${response.status}`, response.ok ? colors.green : colors.red);
    log('响应数据:', colors.yellow);
    log(JSON.stringify(data, null, 2));
    
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    log(`请求失败: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

// 尝试获取JWT令牌
async function getJwtToken() {
  try {
    log('从API获取JWT令牌...', colors.yellow);
    
    const response = await fetch(`${host}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'type=jwt'
    });
    
    if (!response.ok) {
      throw new Error(`获取令牌失败: HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.token) {
      throw new Error('API返回的响应中没有令牌');
    }
    
    log('成功获取JWT令牌', colors.green);
    return data.token;
  } catch (error) {
    log(`获取JWT令牌失败: ${error.message}`, colors.red);
    return null;
  }
}

// 主测试函数
async function runTests() {
  log('开始测试GraphQL API身份验证...\n', colors.green);
  
  // 测试1: 无身份验证 (应该返回401错误)
  divider();
  const noAuthResult = await testGraphQLRequest('无身份验证请求');
  
  if (noAuthResult.status === 401) {
    log('✅ 测试通过: 无身份验证请求返回了预期的401状态码', colors.green);
  } else {
    log(`❌ 测试失败: 无身份验证请求返回了意外的状态码 ${noAuthResult.status}，应该是401`, colors.red);
  }
  
  // 获取JWT令牌(如果未提供)
  if (!jwt) {
    divider();
    jwt = await getJwtToken();
    if (!jwt) {
      log('警告: 无法获取JWT令牌，将跳过JWT认证测试', colors.yellow);
    }
  }
  
  // 测试2: JWT认证
  if (jwt) {
    divider();
    const jwtResult = await testGraphQLRequest('使用JWT令牌认证', {
      'Authorization': `Bearer ${jwt}`
    });
    
    if (jwtResult.success) {
      log('✅ 测试通过: JWT认证请求成功', colors.green);
    } else {
      log('❌ 测试失败: JWT认证请求不成功', colors.red);
    }
  }
  
  // 测试3: API密钥认证
  if (apiKey) {
    divider();
    const apiKeyResult = await testGraphQLRequest('使用API密钥认证', {
      'X-API-Key': apiKey
    });
    
    if (apiKeyResult.success) {
      log('✅ 测试通过: API密钥认证请求成功', colors.green);
    } else {
      log('❌ 测试失败: API密钥认证请求不成功', colors.red);
    }
  } else {
    divider();
    log('警告: 未提供API密钥，跳过API密钥认证测试', colors.yellow);
  }
  
  divider();
  log('测试完成', colors.green);
}

// 运行测试
runTests().catch(error => {
  log(`测试运行时出错: ${error.message}`, colors.red);
  exit(1);
}); 