/**
 * 认证配置
 * 
 * 此文件包含与认证相关的全局配置项，提供统一的配置点
 */

// 是否为开发环境
const IS_DEV = process.env.NODE_ENV !== 'production';

// 初始化默认用户配置
let DEFAULT_USERS = [];

try {
  // 尝试从环境变量读取用户信息
  if (process.env.USER_INFO) {
    DEFAULT_USERS = JSON.parse(process.env.USER_INFO);
    
    // 基本验证
    if (!Array.isArray(DEFAULT_USERS)) {
      console.error('错误: USER_INFO环境变量必须是一个数组');
      DEFAULT_USERS = [];
    } else {
      // 验证每个用户对象是否包含必要的字段
      DEFAULT_USERS = DEFAULT_USERS.filter(user => {
        const valid = user && user.email && user.password && user.userId && user.role;
        if (!valid && IS_DEV) {
          console.warn(`警告: 忽略无效的用户配置: ${JSON.stringify(user)}`);
        }
        return valid;
      });
      
      if (IS_DEV) {
        console.log(`已加载 ${DEFAULT_USERS.length} 个用户配置`);
      }
    }
  } else if (IS_DEV) {
    console.warn('警告: 未定义USER_INFO环境变量，认证系统将使用空用户列表');
  }
} catch (error) {
  console.error(`解析USER_INFO环境变量失败: ${error.message}`);
  console.error('USER_INFO格式示例: [{"email":"user@example.com","password":"password","userId":"user-1","role":"user"}]');
  DEFAULT_USERS = [];
}

// JWT配置
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  expiresIn: process.env.TOKEN_EXPIRES_IN || '24h',
  algorithm: 'HS256'
};

// 如果未指定JWT密钥，显示警告
if (!process.env.JWT_SECRET && IS_DEV) {
  console.warn('警告: 未定义JWT_SECRET环境变量，使用默认密钥（不安全）');
}

// API密钥配置
let API_KEYS = [];

try {
  if (process.env.ALLOWED_API_KEYS) {
    API_KEYS = process.env.ALLOWED_API_KEYS.split(',').map(key => key.trim());
    
    if (IS_DEV) {
      console.log(`已加载 ${API_KEYS.length} 个API密钥`);
    }
  } else if (IS_DEV) {
    console.warn('警告: 未定义ALLOWED_API_KEYS环境变量，API密钥认证将不可用');
  }
} catch (error) {
  console.error(`解析ALLOWED_API_KEYS环境变量失败: ${error.message}`);
  API_KEYS = [];
}

// 导出配置
const authConfig = {
  users: DEFAULT_USERS,
  jwt: JWT_CONFIG,
  apiKeys: API_KEYS,
  isDev: IS_DEV
};

export default authConfig; 