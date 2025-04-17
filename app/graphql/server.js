/**
 * GraphQL 服务器配置
 * 集成 Apollo Server 与应用
 */
import { ApolloServer } from '@apollo/server';
import typeDefs from './schema.js';
import resolvers from './resolvers.js';
import { buildContext } from './context.js';

// 创建 Apollo Server 实例
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // 允许 API 探索（生产环境可以考虑关闭）
  formatError: (error) => {
    // 日志错误但不暴露内部细节
    console.error('GraphQL 错误:', error);
    
    // 在生产环境中可能需要屏蔽某些错误详情
    return {
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: error.extensions || {}
    };
  },
});

/**
 * 创建 GraphQL 处理函数
 * @returns {Function} 请求处理函数
 */
export async function createHandler() {
  // 启动服务器
  await server.start();
  
  // 返回请求处理函数
  return async function handler(request) {
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    // 仅支持POST请求
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        errors: [{ message: '仅支持POST请求' }]
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const contentType = request.headers.get('content-type') || '';

    // 获取请求体
    let body = {};
    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch (error) {
        return new Response(JSON.stringify({ 
          errors: [{ message: '无效的 JSON 请求体' }] 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 构建上下文（包含身份验证）
    const context = await buildContext({ request });
    
    // 检查身份验证状态（除非是内省查询）
    const isIntrospectionQuery = 
      body.query && 
      (body.query.includes('__schema') || body.query.includes('__type'));
    
    // 对非内省查询强制要求身份验证
    if (!isIntrospectionQuery && !context.isAuthenticated) {
      // 返回401未授权响应
      return new Response(JSON.stringify({
        errors: [{
          message: context.authError || '未经授权的访问',
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        }]
      }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer' 
        }
      });
    }

    // 执行 GraphQL 查询
    const result = await server.executeOperation({
      query: body.query,
      variables: body.variables,
      operationName: body.operationName,
    }, {
      contextValue: context
    });

    // 检查是否有身份验证或授权错误
    if (result.errors && result.errors.some(err => 
        err.extensions?.code === 'UNAUTHENTICATED' || 
        err.extensions?.code === 'FORBIDDEN')) {
      // 设置适当的HTTP状态码
      const statusCode = result.errors.some(err => 
        err.extensions?.code === 'UNAUTHENTICATED') ? 401 : 403;
      
      // 返回带有适当状态码的响应
      return new Response(JSON.stringify(result), {
        status: statusCode,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 返回正常响应
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  };
}

export default server; 