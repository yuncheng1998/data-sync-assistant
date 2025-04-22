/**
 * Shopify GraphQL API 客户端
 */
import { GraphQLClient } from 'graphql-request';
import { GET_PRODUCTS_QUERY, parseProductData } from './productQueries.js';
import { 
  GET_ORDERS_QUERY, 
  GET_RECENTLY_UPDATED_ORDERS_QUERY, 
  parseOrderData,
  buildOrderQueryFilter
} from './orderQueries.js';
import { GET_PRICE_RULES_QUERY, parsePriceRuleData } from './discountQueries.js';

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
 * @param {Object} options - 查询选项
 * @returns {Promise<Array>} 产品数据数组
 */
export async function getAllProducts(shop, accessToken, options = {}) {
  const client = createGraphQLClient(shop, accessToken);
  const products = [];
  
  let hasNextPage = true;
  let cursor = null;
  const batchSize = options.batchSize || 50; // 每批次获取的商品数量
  
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
        
        // 如果设置了产品数量限制，检查是否达到限制
        if (options.limit && products.length >= options.limit) {
          console.log(`已达到产品获取限制 ${options.limit}`);
          hasNextPage = false;
          break;
        }
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
 * @param {Object} options - 查询选项
 * @returns {Promise<Array>} 订单数据数组
 */
export async function getAllOrders(shop, accessToken, options = {}) {
  const client = createGraphQLClient(shop, accessToken);
  const orders = [];
  
  let hasNextPage = true;
  let cursor = null;
  const batchSize = options.batchSize || 50; // 每批次获取的订单数量
  const queryFilter = options.queryFilter || buildOrderQueryFilter(options);
  
  // 确定使用的查询
  const queryToUse = options.recentOnly 
    ? GET_RECENTLY_UPDATED_ORDERS_QUERY 
    : GET_ORDERS_QUERY;
  
  console.log(`开始从 ${shop} 获取订单数据${queryFilter ? `，使用过滤条件: ${queryFilter}` : ''}...`);
  
  try {
    while (hasNextPage) {
      // 查询变量
      const variables = {
        first: batchSize,
        after: cursor,
        query: queryFilter
      };
      
      // 执行 GraphQL 查询
      const data = await client.request(queryToUse, variables);
      
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
        
        // 如果设置了订单数量限制，检查是否达到限制
        if (options.limit && orders.length >= options.limit) {
          console.log(`已达到订单获取限制 ${options.limit}`);
          hasNextPage = false;
          break;
        }
      } else {
        hasNextPage = false;
      }
    }
    
    console.log(`成功获取 ${shop} 的订单数据，共 ${orders.length} 个订单`);
    return orders;
  } catch (error) {
    console.error(`获取订单数据失败:`, error);
    throw error;
  }
}

/**
 * 获取最近更新的订单
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @param {number} days - 最近天数，默认7天
 * @returns {Promise<Array>} 订单数据数组
 */
export async function getRecentlyUpdatedOrders(shop, accessToken, days = 7) {
  // 计算过滤日期
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  const options = {
    updatedAfter: date.toISOString().split('T')[0],
    recentOnly: true
  };
  
  return getAllOrders(shop, accessToken, options);
}

/**
 * 增量同步订单
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @param {Date} lastSyncDate - 上次同步时间
 * @returns {Promise<Array>} 订单数据数组
 */
export async function getIncrementalOrders(shop, accessToken, lastSyncDate) {
  // 如果没有提供上次同步时间，使用7天前
  if (!lastSyncDate) {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    lastSyncDate = date;
  }
  
  const options = {
    updatedAfter: lastSyncDate.toISOString().split('T')[0]
  };
  
  return getAllOrders(shop, accessToken, options);
}

/**
 * 获取所有价格规则（折扣）
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @param {Object} options - 查询选项
 * @returns {Promise<Array>} 价格规则数据数组
 */
export async function getAllPriceRules(shop, accessToken, options = {}) {
  const client = createGraphQLClient(shop, accessToken);
  const priceRules = [];
  
  let hasNextPage = true;
  let cursor = null;
  const batchSize = options.batchSize || 50; // 每批次获取的规则数量
  
  // 构建查询过滤器
  let queryFilter = '';
  if (options.updatedAfter) {
    queryFilter = `updated_at:>=${options.updatedAfter}`;
  }
  
  console.log(`开始从 ${shop} 获取价格规则${queryFilter ? `，使用过滤条件: ${queryFilter}` : ''}...`);
  
  try {
    while (hasNextPage) {
      // 查询变量
      const variables = {
        first: batchSize,
        after: cursor,
        query: queryFilter || undefined
      };
      
      // 执行 GraphQL 查询
      const data = await client.request(GET_PRICE_RULES_QUERY, variables);
      
      // 提取价格规则数据
      const { priceRules: priceRulesData } = data;
      
      if (priceRulesData && priceRulesData.edges && priceRulesData.edges.length > 0) {
        // 解析价格规则数据
        const parsedPriceRules = priceRulesData.edges.map(edge => parsePriceRuleData(edge.node, shop));
        priceRules.push(...parsedPriceRules);
        
        // 更新分页信息
        hasNextPage = priceRulesData.pageInfo.hasNextPage;
        cursor = priceRulesData.pageInfo.endCursor;
        
        console.log(`已获取 ${priceRules.length} 个价格规则`);
        
        // 如果设置了数量限制，检查是否达到限制
        if (options.limit && priceRules.length >= options.limit) {
          console.log(`已达到价格规则获取限制 ${options.limit}`);
          hasNextPage = false;
          break;
        }
      } else {
        hasNextPage = false;
      }
    }
    
    console.log(`成功获取 ${shop} 的所有价格规则，共 ${priceRules.length} 个规则`);
    return priceRules;
  } catch (error) {
    console.error(`获取价格规则数据失败:`, error);
    throw error;
  }
}

/**
 * 获取最近更新的价格规则
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @param {number} days - 最近天数，默认7天
 * @returns {Promise<Array>} 价格规则数据数组
 */
export async function getRecentlyUpdatedPriceRules(shop, accessToken, days = 7) {
  // 计算过滤日期
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  const options = {
    updatedAfter: date.toISOString().split('T')[0],
  };
  
  return getAllPriceRules(shop, accessToken, options);
}

/**
 * 增量同步价格规则
 * @param {string} shop - Shopify 店铺域名
 * @param {string} accessToken - 访问令牌
 * @param {Date} lastSyncDate - 上次同步时间
 * @returns {Promise<Array>} 价格规则数据数组
 */
export async function getIncrementalPriceRules(shop, accessToken, lastSyncDate) {
  // 如果没有提供上次同步时间，使用7天前
  if (!lastSyncDate) {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    lastSyncDate = date;
  }
  
  const options = {
    updatedAfter: lastSyncDate.toISOString().split('T')[0]
  };
  
  return getAllPriceRules(shop, accessToken, options);
} 