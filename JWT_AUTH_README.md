# JWT 认证系统使用说明

本文档详细介绍了基于 JWT 的认证系统的使用方法，以及如何使用该系统访问 GraphQL API。

## 1. 认证流程

### 1.1 获取 JWT 令牌

**请求：**

```http
POST /auth/token
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "123456"
}
```

**响应：**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": "24h",
  "user": {
    "userId": "user-1",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### 1.2 使用令牌访问 GraphQL API

**请求：**

```http
POST /graphql
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "query": "query { me { userId email role } }"
}
```

**响应：**

```json
{
  "data": {
    "me": {
      "userId": "user-1",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

## 2. 测试账号

系统内置了以下测试账号：

| 邮箱              | 密码     | 角色  |
| ----------------- | -------- | ----- |
| user@example.com  | 123456   | user  |
| admin@example.com | admin123 | admin |

## 3. Python 客户端使用方法

### 3.1 安装依赖

```bash
pip install requests
```

### 3.2 使用 Python 客户端

```bash
# 基本使用
python graphql_client.py -u http://localhost:3000 --verbose

# 自定义查询
python graphql_client.py -u http://localhost:3000 --query-file query_examples.graphql 

# 自定义参数
python graphql_client.py -u http://localhost:3000 \
  --email admin@example.com \
  --password admin123 \
  --variables '{"limit": 10, "offset": 0}'
```

### 3.3 完整参数说明

```
-u, --url             API 基础 URL（必需）
--email               用户邮箱（默认: user@example.com）
--password            密码（默认: 123456）
--auth-endpoint       认证接口路径（默认: /auth/token）
--graphql-endpoint    GraphQL 接口路径（默认: /graphql）
--query               GraphQL 查询字符串
--query-file          包含 GraphQL 查询的文件
--variables           GraphQL 查询变量 (JSON 格式)
--verbose             显示详细日志
```

## 4. 在应用中集成

### 4.1 使用 fetch API

```javascript
// 获取令牌
async function login(email, password) {
  const response = await fetch('http://localhost:3000/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  return data.token;
}

// 执行 GraphQL 查询
async function executeQuery(token, query, variables) {
  const response = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  
  return await response.json();
}
```

### 4.2 使用 Apollo Client

```javascript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// 创建 HTTP 链接
const httpLink = createHttpLink({
  uri: 'http://localhost:3000/graphql',
});

// 添加认证信息
const authLink = setContext((_, { headers }) => {
  // 从本地存储获取令牌
  const token = localStorage.getItem('token');
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

// 创建 Apollo Client
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});
```

## 5. 安全建议

1. 在生产环境中，确保使用 HTTPS 传输所有请求
2. 设置合理的令牌有效期，避免长期有效的令牌
3. 定期轮换 JWT 密钥
4. 实现令牌刷新机制，避免用户频繁登录
5. 考虑在令牌中添加指纹信息，防止令牌被盗用
6. 实现令牌吊销机制，用于处理安全事件
