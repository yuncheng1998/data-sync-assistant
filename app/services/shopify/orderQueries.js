/**
 * Shopify GraphQL 查询 - 订单相关
 */

// 获取订单列表的 GraphQL 查询
export const GET_ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String) {
    orders(first: $first, after: $after) {
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