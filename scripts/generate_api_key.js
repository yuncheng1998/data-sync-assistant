#!/usr/bin/env node

/**
 * API密钥生成脚本
 * 
 * 此脚本生成随机的API密钥，可用于GraphQL API身份验证
 * 
 * 使用方法:
 * node scripts/generate_api_key.js [length]
 * 
 * 参数:
 * length - 可选，密钥长度（默认为32字符）
 */

const crypto = require('crypto');

// 从命令行获取密钥长度参数
const args = process.argv.slice(2);
const keyLength = args[0] ? parseInt(args[0], 10) : 32;

if (isNaN(keyLength) || keyLength < 8) {
  console.error('错误: 密钥长度必须是一个至少为8的数字');
  process.exit(1);
}

// 生成随机API密钥
function generateApiKey(length) {
  return crypto.randomBytes(Math.ceil(length * 0.75))
    .toString('base64')
    .slice(0, length)
    .replace(/[+/]/g, '_'); // 替换一些特殊字符，使其更适合URL
}

// 生成并显示API密钥
const apiKey = generateApiKey(keyLength);
console.log('\n生成的API密钥 (长度: %d):', keyLength);
console.log('\x1b[32m%s\x1b[0m', apiKey);

// 显示.env文件中的使用示例
console.log('\n添加到.env文件的示例:');
console.log('\x1b[33m%s\x1b[0m', 'ALLOWED_API_KEYS=' + apiKey);

// 显示如何在请求中使用
console.log('\n在请求中使用此API密钥:');
console.log('\x1b[36m%s\x1b[0m', 'curl -X POST http://localhost:3000/graphql \\');
console.log('\x1b[36m%s\x1b[0m', '  -H "Content-Type: application/json" \\');
console.log('\x1b[36m%s\x1b[0m', '  -H "X-API-Key: ' + apiKey + '" \\');
console.log('\x1b[36m%s\x1b[0m', '  -d \'{"query":"{\\n  products(pagination: {limit: 2}) {\\n    items {\\n      id\\n      title\\n    }\\n    totalCount\\n  }\\n}"}\'');

console.log('\n记得将此密钥添加到环境变量ALLOWED_API_KEYS中，多个密钥用逗号分隔\n'); 