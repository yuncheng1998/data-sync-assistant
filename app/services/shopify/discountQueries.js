/**
 * Shopify GraphQL 查询 - 折扣相关
 */

// 获取价格规则列表的GraphQL查询
export const GET_PRICE_RULES_QUERY = `
  query GetPriceRules($first: Int!, $after: String, $query: String) {
    priceRules(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          startsAt
          endsAt
          valueV2 {
            ... on MoneyV2 {
              amount
              currencyCode
            }
            ... on PricingPercentageValue {
              percentage
            }
          }
          oncePerCustomer
          usageLimit
          customerSelection {
            forAllCustomers
          }
          target
          allocationMethod
          discountClass
          summary
          createdAt
          status
          discountCodes(first: 20) {
            edges {
              node {
                id
                code
                usageCount
              }
            }
          }
        }
      }
    }
  }
`;

// 解析 GraphQL 响应数据为 Prisma 可用格式
export function parsePriceRuleData(priceRuleNode, shop) {
  // 去除 GraphQL ID 前缀 "gid://shopify/PriceRule/"
  const idParts = priceRuleNode.id.split("/");
  const id = idParts[idParts.length - 1];

  // 处理折扣码
  const discountCodes = [];
  if (priceRuleNode.discountCodes && priceRuleNode.discountCodes.edges) {
    priceRuleNode.discountCodes.edges.forEach(edge => {
      const discountNode = edge.node;
      // 提取折扣码ID
      const discountIdParts = discountNode.id.split("/");
      const discountId = discountIdParts[discountIdParts.length - 1];
      
      discountCodes.push({
        id: discountId,
        priceRuleId: id,
        code: discountNode.code,
        usageCount: discountNode.usageCount || 0,
        createdAt: new Date(), // 使用当前时间作为创建时间
        updatedAt: new Date()  // 使用当前时间作为更新时间
      });
    });
  }

  // 确定客户选择类型
  let customerSelectionType = "all";
  if (priceRuleNode.customerSelection) {
    if (priceRuleNode.customerSelection.forAllCustomers === false) {
      customerSelectionType = "specific";
    }
  }

  // 确定折扣类型和目标类型
  let valueType = "fixed_amount";
  let value = "0";
  
  // 处理valueV2以提取正确的折扣值
  if (priceRuleNode.valueV2) {
    if (priceRuleNode.valueV2.percentage) {
      valueType = "percentage";
      value = priceRuleNode.valueV2.percentage.toString();
    } else if (priceRuleNode.valueV2.amount) {
      value = priceRuleNode.valueV2.amount.toString();
    }
  }
  
  // 确定目标类型
  let targetType = "line_item";
  if (priceRuleNode.target) {
    if (priceRuleNode.target === "SHIPPING_LINE") {
      targetType = "shipping_line";
    } else if (priceRuleNode.target === "ORDER") {
      targetType = "order";
    }
  }

  // 格式化价格规则数据
  return {
    id,
    shop,
    title: priceRuleNode.title,
    startsAt: priceRuleNode.startsAt,
    endsAt: priceRuleNode.endsAt,
    valueType: valueType,
    value: value,
    targetType: targetType,
    oncePerCustomer: priceRuleNode.oncePerCustomer || false,
    usageLimit: priceRuleNode.usageLimit,
    customerSelection: customerSelectionType,
    status: priceRuleNode.status?.toLowerCase() || "active",
    createdAt: priceRuleNode.createdAt,
    updatedAt: new Date(), // 使用当前时间作为更新时间
    discountCodes
  };
} 