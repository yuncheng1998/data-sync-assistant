#!/usr/bin/env node

/**
 * JWT令牌测试脚本
 * 
 * 此脚本用于测试JWT令牌的生成和验证
 * 
 * 使用方法:
 * node scripts/test_jwt.js
 */

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { exit } = require('process');

// 加载环境变量
dotenv.config();

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

// 获取JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// 测试JWT令牌功能
async function testJWT() {
  divider();
  log('开始测试JWT令牌功能', colors.green);
  
  // 1. 测试生成令牌
  const payload = {
    userId: 'test-user-123',
    shop: 'test-shop.myshopify.com',
    role: 'admin'
  };
  
  log('测试负载:', colors.yellow);
  log(JSON.stringify(payload, null, 2));
  
  let token;
  try {
    token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    log('\n✅ 成功生成JWT令牌', colors.green);
    log('令牌:', colors.yellow);
    log(token);
  } catch (error) {
    log(`\n❌ 生成JWT令牌失败: ${error.message}`, colors.red);
    return;
  }
  
  // 2. 测试验证令牌
  divider();
  log('测试验证JWT令牌', colors.green);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    log('\n✅ 成功验证JWT令牌', colors.green);
    log('解码后的负载:', colors.yellow);
    log(JSON.stringify(decoded, null, 2));
    
    // 验证负载字段
    let fieldsValid = true;
    for (const key in payload) {
      if (decoded[key] !== payload[key]) {
        log(`\n❌ 字段不匹配: ${key}`, colors.red);
        log(`  预期: ${payload[key]}`, colors.yellow);
        log(`  实际: ${decoded[key]}`, colors.yellow);
        fieldsValid = false;
      }
    }
    
    if (fieldsValid) {
      log('\n✅ 所有负载字段都匹配', colors.green);
    }
    
    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = decoded.exp - now;
    log(`\n令牌将在 ${timeLeft} 秒后过期 (约 ${Math.floor(timeLeft / 60)} 分钟)`, colors.cyan);
  } catch (error) {
    log(`\n❌ 验证JWT令牌失败: ${error.message}`, colors.red);
    return;
  }
  
  // 3. 测试使用错误密钥验证
  divider();
  log('测试使用错误密钥验证JWT令牌', colors.green);
  
  try {
    const wrongSecret = JWT_SECRET + 'wrong';
    jwt.verify(token, wrongSecret);
    log('\n❌ 测试失败: 使用错误密钥验证应当失败，但却成功了', colors.red);
  } catch (error) {
    log(`\n✅ 测试通过: 使用错误密钥验证失败，错误: ${error.message}`, colors.green);
  }
  
  divider();
  log('JWT令牌测试完成', colors.green);
}

// 运行测试
testJWT().catch(error => {
  log(`测试运行时出错: ${error.message}`, colors.red);
  exit(1);
}); 