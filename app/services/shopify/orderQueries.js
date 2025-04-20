/**
 * Shopify GraphQL 查询 - 订单相关
 */

// 获取订单列表的 GraphQL 查询
export const GET_ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          currencyCode
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          displayFinancialStatus
          displayFulfillmentStatus
          email
          customer {
            email
            firstName
            lastName
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variant {
                  id
                  price
                  sku
                }
              }
            }
          }
        }
      }
    }
  }
`;

// 获取最近更新的订单查询
export const GET_RECENTLY_UPDATED_ORDERS_QUERY = `
  query GetRecentlyUpdatedOrders($first: Int!, $after: String) {
    orders(first: $first, after: $after, query: "updated_at:>-30d", sortKey: UPDATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          currencyCode
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          displayFinancialStatus
          displayFulfillmentStatus
          email
          customer {
            email
            firstName
            lastName
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variant {
                  id
                  price
                  sku
                }
              }
            }
          }
        }
      }
    }
  }
`;

// 解析 GraphQL 响应数据为 Prisma 可用格式
export function parseOrderData(orderNode, shop) {
  // 去除 GraphQL ID 前缀 "gid://shopify/Order/"
  const idParts = orderNode.id.split("/");
  const id = idParts[idParts.length - 1];

  // 解析客户信息
  let customerData = null;
  if (orderNode.customer) {
    customerData = {
      email: orderNode.customer.email,
      firstName: orderNode.customer.firstName,
      lastName: orderNode.customer.lastName
    };
  }

  // 转换 lineItems
  const lineItems = orderNode.lineItems.edges.map(edge => {
    const lineItemNode = edge.node;
    const lineItemIdParts = lineItemNode.id.split("/");
    const lineItemId = lineItemIdParts[lineItemIdParts.length - 1];
    
    let variantId = null;
    if (lineItemNode.variant && lineItemNode.variant.id) {
      const variantIdParts = lineItemNode.variant.id.split("/");
      variantId = variantIdParts[variantIdParts.length - 1];
    }

    return {
      id: lineItemId,
      title: lineItemNode.title,
      quantity: lineItemNode.quantity,
      price: lineItemNode.variant?.price,
      sku: lineItemNode.variant?.sku,
      variantId: variantId
    };
  });

  // 格式化最终订单数据
  return {
    id,
    shop,
    name: orderNode.name,
    createdAt: orderNode.createdAt,
    updatedAt: orderNode.updatedAt,
    currencyCode: orderNode.currencyCode,
    totalPrice: orderNode.totalPriceSet.shopMoney.amount,
    email: orderNode.email,
    customerData: customerData,
    financialStatus: orderNode.displayFinancialStatus,
    fulfillmentStatus: orderNode.displayFulfillmentStatus,
    lineItems,
  };
}

/**
 * 判断订单是否处于终态（不会再变化）
 * @param {Object} order - 订单对象
 * @returns {boolean} 是否处于终态
 */
export function isOrderInFinalState(order) {
  // 已完成且已支付的订单
  if (
    order.fulfillmentStatus === 'FULFILLED' && 
    order.financialStatus === 'PAID'
  ) {
    // 如果订单更新时间超过30天，认为是终态
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (new Date(order.updatedAt) < thirtyDaysAgo) {
      return true;
    }
  }
  
  // 已取消的订单
  if (order.fulfillmentStatus === 'CANCELLED') {
    return true;
  }
  
  // 已退款的订单
  if (order.financialStatus === 'REFUNDED') {
    return true;
  }
  
  return false;
}

/**
 * 构建用于订单查询的过滤条件
 * @param {Object} options - 查询选项
 * @returns {string} 查询过滤字符串
 */
export function buildOrderQueryFilter(options = {}) {
  const filters = [];
  
  // 根据更新时间过滤
  if (options.updatedAfter) {
    const date = options.updatedAfter instanceof Date 
      ? options.updatedAfter.toISOString().split('T')[0]
      : options.updatedAfter;
    filters.push(`updated_at:>=${date}`);
  }
  
  // 根据创建时间过滤
  if (options.createdAfter) {
    const date = options.createdAfter instanceof Date 
      ? options.createdAfter.toISOString().split('T')[0]
      : options.createdAfter;
    filters.push(`created_at:>=${date}`);
  }
  
  // 根据状态过滤
  if (options.financialStatus) {
    filters.push(`financial_status:${options.financialStatus}`);
  }
  
  if (options.fulfillmentStatus) {
    filters.push(`fulfillment_status:${options.fulfillmentStatus}`);
  }
  
  // 忽略已关闭和已取消的订单
  if (options.activeOnly) {
    filters.push(`status:open`);
  }
  
  // 仅同步活跃状态订单（排除取消、退款等）
  if (options.excludeFinalState) {
    filters.push(`NOT (financial_status:refunded OR fulfillment_status:cancelled)`);
  }
  
  return filters.join(' AND ');
} 