/**
 * Shopify GraphQL 查询 - 产品相关
 */

// 获取产品列表的 GraphQL 查询
export const GET_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          vendor
          productType
          status
          handle
          publishedAt
          createdAt
          updatedAt
          tags
          options {
            id
            name
            values
          }
          metafields(first: 10) {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                id
                src
                altText
                width
                height
              }
            }
          }
          variants(first: 25) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                sku
                position
                inventoryPolicy
                inventoryQuantity
                weightUnit
                weight
                requiresShipping
                barcode
                image {
                  id
                }
                inventoryItem {
                  id
                  tracked
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
export function parseProductData(productNode, shop) {
  // 去除 GraphQL ID 前缀 "gid://shopify/Product/"
  const idParts = productNode.id.split("/");
  const id = idParts[idParts.length - 1];

  // 处理 metafields
  const metafields = {};
  if (productNode.metafields && productNode.metafields.edges) {
    productNode.metafields.edges.forEach(edge => {
      const node = edge.node;
      if (!metafields[node.namespace]) {
        metafields[node.namespace] = {};
      }
      metafields[node.namespace][node.key] = node.value;
    });
  }

  // 转换 images
  const images = productNode.images.edges.map(edge => {
    const imageNode = edge.node;
    const imageIdParts = imageNode.id.split("/");
    const imageId = imageIdParts[imageIdParts.length - 1];
    
    return {
      id: imageId,
      src: imageNode.src,
      altText: imageNode.altText,
      width: imageNode.width,
      height: imageNode.height
    };
  });

  // 转换 variants
  const variants = productNode.variants.edges.map(edge => {
    const variantNode = edge.node;
    const variantIdParts = variantNode.id.split("/");
    const variantId = variantIdParts[variantIdParts.length - 1];
    
    let imageId = null;
    if (variantNode.image && variantNode.image.id) {
      const imageIdParts = variantNode.image.id.split("/");
      imageId = imageIdParts[imageIdParts.length - 1];
    }

    // 处理 inventoryItem
    let inventoryItem = null;
    if (variantNode.inventoryItem) {
      inventoryItem = {
        id: variantNode.inventoryItem.id,
        tracked: variantNode.inventoryItem.tracked
      };
    }

    return {
      id: variantId,
      title: variantNode.title,
      price: variantNode.price,
      compareAtPrice: variantNode.compareAtPrice,
      sku: variantNode.sku,
      position: variantNode.position,
      inventoryPolicy: variantNode.inventoryPolicy,
      inventoryQuantity: variantNode.inventoryQuantity,
      weightUnit: variantNode.weightUnit,
      weight: variantNode.weight,
      requiresShipping: variantNode.requiresShipping,
      barcode: variantNode.barcode,
      imageId: imageId,
      inventoryItem: inventoryItem
    };
  });

  // 处理 options
  const options = productNode.options ? productNode.options : [];

  // 格式化最终产品数据
  return {
    id,
    shop,
    title: productNode.title,
    description: productNode.description,
    vendor: productNode.vendor,
    productType: productNode.productType,
    status: productNode.status,
    handle: productNode.handle,
    publishedAt: productNode.publishedAt,
    createdAt: productNode.createdAt,
    updatedAt: productNode.updatedAt,
    tags: productNode.tags,
    options: options,
    metafields: metafields,
    images,
    variants,
  };
} 