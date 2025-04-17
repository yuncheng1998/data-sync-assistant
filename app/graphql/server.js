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
    const contentType = request.headers.get('content-type') || '';

    // 获取请求体
    let body = {};
    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch (error) {
        return new Response(JSON.stringify({ errors: [{ message: '无效的 JSON 请求体' }] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 构建上下文
    const context = await buildContext({ request });

    // 执行 GraphQL 查询
    const result = await server.executeOperation({
      query: body.query,
      variables: body.variables,
      operationName: body.operationName,
    }, {
      contextValue: context
    });

    // 返回响应
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
}

export default server; 