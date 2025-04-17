/**
 * GraphQL API 路由
 * 处理 /graphql 路径的请求
 */
import { json } from '@remix-run/node';
import { createHandler } from '../graphql/index.js';

// 创建全局 handler 实例
let handlerPromise = null;

/**
 * 获取或创建 GraphQL handler
 */
async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = createHandler();
  }
  return await handlerPromise;
}

// 处理 GET 请求
export async function loader({ request }) {
  if (request.method === 'GET') {
    try {
      // 获取 handler 并处理请求
      const handler = await getHandler();
      return await handler(request);
    } catch (error) {
      console.error('GraphQL GET 处理错误:', error);
      return json({ errors: [{ message: 'GraphQL 处理出错' }] }, { status: 500 });
    }
  }
  
  return json({ error: 'Method not allowed' }, { status: 405 });
}

// 处理 POST 请求
export async function action({ request }) {
  if (request.method === 'POST') {
    try {
      // 获取 handler 并处理请求
      const handler = await getHandler();
      return await handler(request);
    } catch (error) {
      console.error('GraphQL POST 处理错误:', error);
      return json({ errors: [{ message: 'GraphQL 处理出错' }] }, { status: 500 });
    }
  }
  
  return json({ error: 'Method not allowed' }, { status: 405 });
} 