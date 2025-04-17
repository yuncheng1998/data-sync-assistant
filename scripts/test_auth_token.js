#!/usr/bin/env node

/**
 * /auth/token 接口测试脚本
 * 
 * 用于测试用户认证接口是否正常工作，提供详细的调试信息
 * 
 * 使用方法：
 * node scripts/test_auth_token.js [--host URL] [--email EMAIL] [--password PASSWORD]
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 解析命令行参数
const args = process.argv.slice(2);
let host = 'http://localhost:3000';
let email = null;
let password = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host' && args[i + 1]) {
    host = args[i + 1];
    i++;
  } else if (args[i] === '--email' && args[i + 1]) {
    email = args[i + 1];
    i++;
  } else if (args[i] === '--password' && args[i + 1]) {
    password = args[i + 1];
    i++;
  }
}

// 设置颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// 控制台输出
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

// 分隔线
function divider() {
  log('\n' + '-'.repeat(80) + '\n', colors.blue);
}

/**
 * 测试接口信息 (GET请求)
 */
async function testApiInfo() {
  log('测试API信息 (GET /auth/token)', colors.cyan);
  
  try {
    const response = await fetch(`${host}/auth/token`);
    const data = await response.json();
    
    log(`状态码: ${response.status}`, response.ok ? colors.green : colors.red);
    log('响应数据:', colors.yellow);
    log(JSON.stringify(data, null, 2));
    
    // 提取示例用户
    if (data.availableUsers && data.availableUsers.length > 0) {
      const exampleUser = data.availableUsers[0];
      if (!email) {
        email = exampleUser.email;
        log(`使用示例用户邮箱: ${email}`, colors.magenta);
      }
    }
    
    return { success: response.ok, data };
  } catch (error) {
    log(`请求失败: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

/**
 * 测试用户认证 (POST请求)
 */
async function testAuthentication(email, password) {
  log(`测试用户认证: ${email}`, colors.cyan);
  
  // 如果缺少凭据
  if (!email || !password) {
    log('错误: 缺少邮箱或密码', colors.red);
    log('使用: node scripts/test_auth_token.js --email YOUR_EMAIL --password YOUR_PASSWORD', colors.yellow);
    return { success: false, error: '缺少认证信息' };
  }
  
  try {
    log('请求详情:', colors.yellow);
    log(`  URL: ${host}/auth/token`);
    log(`  方法: POST`);
    log(`  邮箱: ${email}`);
    log(`  密码: ${'*'.repeat(password.length)}`);
    
    const response = await fetch(`${host}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    const success = response.ok && data.success;
    
    if (success) {
      log(`✅ 认证成功!`, colors.green);
      log(`令牌: ${data.token.substring(0, 20)}...`, colors.green);
      log(`用户信息:`, colors.yellow);
      log(`  ID: ${data.user.userId}`);
      log(`  邮箱: ${data.user.email}`);
      log(`  角色: ${data.user.role}`);
      log(`  过期时间: ${data.expiresIn}`);
    } else {
      log(`❌ 认证失败: ${data.error || '未知错误'}`, colors.red);
      
      // 尝试提供更详细的调试信息
      if (response.status === 401) {
        log(`可能的原因:`, colors.yellow);
        log('1. 用户名或密码错误');
        log('2. 环境变量中的USER_INFO配置有误');
        log('3. 密码中包含特殊字符，在环境变量中未正确转义');
        
        log(`\n调试建议:`, colors.yellow);
        log('- 检查.env文件中的USER_INFO是否包含正确的用户信息');
        log('- 确保JSON格式正确，特殊字符已转义');
        log('- 尝试简化密码，避免使用特殊字符进行测试');
      }
    }
    
    log('\n响应详情:', colors.yellow);
    log(`状态码: ${response.status}`);
    log('响应数据:');
    log(JSON.stringify(data, null, 2));
    
    return { success, data, status: response.status };
  } catch (error) {
    log(`请求异常: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

/**
 * 运行测试
 */
async function runTests() {
  divider();
  log('开始测试 /auth/token 接口', colors.green);
  log(`目标服务器: ${host}`, colors.yellow);
  
  // 测试API信息
  divider();
  await testApiInfo();
  
  // 测试用户认证
  divider();
  const authResult = await testAuthentication(email, password);
  
  // 如果认证成功，可以尝试使用令牌请求其他API
  if (authResult.success && authResult.data.token) {
    const token = authResult.data.token;
    divider();
    log('令牌可用于以下请求:', colors.cyan);
    log(`curl -X POST ${host}/graphql \\`, colors.yellow);
    log(`  -H 'Content-Type: application/json' \\`, colors.yellow);
    log(`  -H 'Authorization: Bearer ${token}' \\`, colors.yellow);
    log(`  -d '{"query":"{\\n  products(pagination: {limit: 3}) {\\n    items {\\n      id\\n      title\\n    }\\n    totalCount\\n  }\\n}"}'`, colors.yellow);
  }
  
  divider();
  log('测试完成', colors.green);
}

// 如果没有提供邮箱和密码，尝试从环境变量获取
try {
  if (!email || !password) {
    const userInfo = JSON.parse(process.env.USER_INFO || '[]');
    if (userInfo.length > 0) {
      if (!email) email = userInfo[0].email;
      if (!password) password = userInfo[0].password;
      log(`从环境变量加载测试用户: ${email}`, colors.magenta);
    }
  }
} catch (error) {
  log(`解析环境变量中的用户信息失败: ${error.message}`, colors.red);
}

// 运行测试
runTests().catch(error => {
  log(`测试过程中出错: ${error.message}`, colors.red);
  process.exit(1);
}); 