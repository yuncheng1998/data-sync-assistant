/**
 * Shopify GraphQL API 客户端
 */
import { GraphQLClient } from 'graphql-request';
import { GET_PRODUCTS_QUERY, parseProductData } from './productQueries.js';
import { GET_ORDERS_QUERY, parseOrderData } from './orderQueries.js';

// GraphQL API URL
const SHOPIFY_GRAPHQL_URL = (shop) => `https://${shop}/admin/api/2023-07/graphql.json`;

/**
 * 创建 GraphQL 客户端
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @returns {GraphQLClient} GraphQL 客户端实例
 */
export function createGraphQLClient(shop, accessToken) {
  return new GraphQLClient(SHOPIFY_GRAPHQL_URL(shop), {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 获取所有产品
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @returns {Promise<Array>} 产品数据数组
 */
export async function getAllProducts(shop, accessToken) {
  const client = createGraphQLClient(shop, accessToken);
  const products = [];
  
  let hasNextPage = true;
  let cursor = null;
  const batchSize = 50; // 每批次获取的商品数量
  
  console.log(`开始从 ${shop} 获取产品数据...`);
  
  try {
    while (hasNextPage) {
      // 查询变量
      const variables = {
        first: batchSize,
        after: cursor,
      };
      
      // 执行 GraphQL 查询
      const data = await client.request(GET_PRODUCTS_QUERY, variables);
      
      // 提取产品数据
      const { products: productsData } = data;
      
      if (productsData && productsData.edges && productsData.edges.length > 0) {
        // 解析产品数据
        const parsedProducts = productsData.edges.map(edge => parseProductData(edge.node, shop));
        products.push(...parsedProducts);
        
        // 更新分页信息
        hasNextPage = productsData.pageInfo.hasNextPage;
        cursor = productsData.pageInfo.endCursor;
        
        console.log(`已获取 ${products.length} 个产品`);
      } else {
        hasNextPage = false;
      }
    }
    
    console.log(`成功获取 ${shop} 的所有产品数据，共 ${products.length} 个产品`);
    return products;
  } catch (error) {
    console.error(`获取产品数据失败:`, error);
    throw error;
  }
}

/**
 * 获取所有订单
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @returns {Promise<Array>} 订单数据数组
 */
export async function getAllOrders(shop, accessToken) {
  const client = createGraphQLClient(shop, accessToken);
  const orders = [];
  
  let hasNextPage = true;
  let cursor = null;
  const batchSize = 50; // 每批次获取的订单数量
  
  console.log(`开始从 ${shop} 获取订单数据...`);
  
  try {
    while (hasNextPage) {
      // 查询变量
      const variables = {
        first: batchSize,
        after: cursor,
      };
      
      // 执行 GraphQL 查询
      const data = await client.request(GET_ORDERS_QUERY, variables);
      
      // 提取订单数据
      const { orders: ordersData } = data;
      
      if (ordersData && ordersData.edges && ordersData.edges.length > 0) {
        // 解析订单数据
        const parsedOrders = ordersData.edges.map(edge => parseOrderData(edge.node, shop));
        orders.push(...parsedOrders);
        
        // 更新分页信息
        hasNextPage = ordersData.pageInfo.hasNextPage;
        cursor = ordersData.pageInfo.endCursor;
        
        console.log(`已获取 ${orders.length} 个订单`);
      } else {
        hasNextPage = false;
      }
    }
    
    console.log(`成功获取 ${shop} 的所有订单数据，共 ${orders.length} 个订单`);
    return orders;
  } catch (error) {
    console.error(`获取订单数据失败:`, error);
    throw error;
  }
} 