/**
 * GraphQL API 客户端示例
 * 
 * 此示例展示如何使用JWT令牌或API密钥认证调用GraphQL API
 * 也可以用于测试GraphQL服务的连通性
 */

const fetch = require('node-fetch');

/**
 * GraphQL 客户端类
 */
class GraphQLClient {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.endpoint - GraphQL端点URL
   * @param {string} options.token - JWT令牌或API密钥
   * @param {string} options.authType - 认证类型，'jwt'或'api-key'
   * @param {string} options.shop - 店铺域名(JWT认证时需要)
   */
  constructor({ endpoint, token, authType = 'jwt', shop = null }) {
    this.endpoint = endpoint;
    this.token = token;
    this.authType = authType;
    this.shop = shop;
  }

  /**
   * 执行GraphQL查询
   * @param {string} query - GraphQL查询字符串
   * @param {Object} variables - 查询变量
   * @returns {Promise<Object>} - 查询结果
   */
  async query(query, variables = {}) {
    // 构建请求头
    const headers = {
      'Content-Type': 'application/json',
    };

    // 根据认证类型添加相应的认证头
    if (this.authType === 'jwt') {
      if (!this.token) {
        throw new Error('使用JWT认证需要提供令牌');
      }
      headers['Authorization'] = `Bearer ${this.token}`;
      
      // 如果提供了店铺域名，添加到请求头
      if (this.shop) {
        headers['X-Shopify-Shop-Domain'] = this.shop;
      }
    } else if (this.authType === 'api-key') {
      if (!this.token) {
        throw new Error('使用API密钥认证需要提供密钥');
      }
      headers['X-API-Key'] = this.token;
    } else {
      throw new Error(`不支持的认证类型: ${this.authType}`);
    }

    try {
      // 发送请求
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables
        })
      });

      // 解析响应
      const data = await response.json();

      // 检查GraphQL错误
      if (data.errors) {
        throw new Error(
          `GraphQL错误: ${data.errors.map(e => e.message).join(', ')}`
        );
      }

      return data;
    } catch (error) {
      console.error('GraphQL请求失败:', error);
      throw error;
    }
  }
}

/**
 * 使用示例
 */
async function example() {
  // 配置参数
  const endpoint = process.env.GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql';
  const token = process.env.AUTH_TOKEN || 'your-jwt-token-or-api-key';
  const authType = process.env.AUTH_TYPE || 'jwt'; // 'jwt' 或 'api-key'
  const shop = process.env.SHOP_DOMAIN;

  // 创建客户端实例
  const client = new GraphQLClient({
    endpoint,
    token,
    authType,
    shop
  });

  // 示例查询 - 获取产品列表
  const productsQuery = `
    query GetProducts($limit: Int!, $sort: ProductSortInput) {
      products(pagination: { limit: $limit }, sort: $sort) {
        items {
          id
          title
          status
          totalInventory
          minPrice
          maxPrice
        }
        totalCount
      }
    }
  `;

  try {
    // 执行查询
    const result = await client.query(productsQuery, {
      limit: 5,
      sort: { field: "TITLE", direction: "ASC" }
    });

    console.log('查询成功:');
    console.log(JSON.stringify(result, null, 2));
    
    // 显示产品总数
    if (result.data && result.data.products) {
      console.log(`\n共找到 ${result.data.products.totalCount} 个产品`);
      
      // 显示产品列表
      if (result.data.products.items && result.data.products.items.length > 0) {
        console.log('\n产品列表:');
        result.data.products.items.forEach((product, index) => {
          console.log(`${index + 1}. ${product.title} (ID: ${product.id})`);
          console.log(`   状态: ${product.status}, 库存: ${product.totalInventory}`);
          console.log(`   价格: ${product.minPrice} - ${product.maxPrice}`);
        });
      }
    }
  } catch (error) {
    console.error('执行查询时出错:', error.message);
  }
}

// 如果直接运行此文件则执行示例
if (require.main === module) {
  example().catch(error => {
    console.error('运行示例时出错:', error);
    process.exit(1);
  });
}

// 导出客户端类，以便在其他模块中使用
module.exports = GraphQLClient; 