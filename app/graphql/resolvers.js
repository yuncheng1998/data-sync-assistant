/**
 * GraphQL Resolvers
 * 处理查询请求并获取数据
 */

/**
 * 构建 Prisma 查询条件
 * @param {Object} filter - 过滤条件
 * @returns {Object} Prisma 查询条件
 */
function buildWhereClause(filter = {}) {
  const where = {};
  const { status, vendor, productType, minInventory, maxInventory, searchQuery, shop } = filter;

  // 添加基本过滤条件
  if (shop) {
    where.shop = shop;
  }

  if (vendor) {
    where.vendor = vendor;
  }

  if (productType) {
    where.productType = productType;
  }

  // 将枚举状态转换为数据库中存储的字符串
  if (status) {
    where.status = status.toLowerCase();
  }

  // 搜索查询 - 匹配标题或描述
  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      { description: { contains: searchQuery, mode: 'insensitive' } }
    ];
  }

  // 处理库存范围过滤
  // 注意：库存过滤需要关联到变体，这里使用 some 操作
  if (minInventory !== undefined || maxInventory !== undefined) {
    where.variants = {
      some: {}
    };

    if (minInventory !== undefined) {
      where.variants.some.inventoryQuantity = {
        gte: minInventory
      };
    }

    if (maxInventory !== undefined) {
      where.variants.some.inventoryQuantity = {
        ...(where.variants.some.inventoryQuantity || {}),
        lte: maxInventory
      };
    }
  }

  return where;
}

/**
 * 构建排序条件
 * @param {Object} sort - 排序参数
 * @returns {Array} Prisma 排序条件
 */
function buildOrderByClause(sort) {
  if (!sort) {
    // 默认按更新时间降序排序
    return [{ updatedAt: 'desc' }];
  }

  const { field, direction } = sort;
  const dir = direction.toLowerCase();

  // 处理特殊字段排序
  switch (field) {
    case 'TOTAL_INVENTORY':
      // 按库存排序需要关联到变体，这里使用了一种简化方法
      // 实际项目中可能需要更复杂的排序逻辑
      return [{ variants: { _count: dir } }];
    case 'PRICE':
      // 按价格排序（按第一个变体的价格排序）
      return [{ variants: { price: dir } }];
    case 'TITLE':
      return [{ title: dir }];
    case 'CREATED_AT':
      return [{ createdAt: dir }];
    case 'UPDATED_AT':
    default:
      return [{ updatedAt: dir }];
  }
}

/**
 * 计算产品的派生字段
 * @param {Object} product - 产品对象
 * @returns {Object} 计算后的字段
 */
function calculateProductFields(product) {
  // 如果没有变体，返回默认值
  if (!product.variants || product.variants.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      totalInventory: 0,
      imageUrl: null
    };
  }

  // 计算价格范围
  const prices = product.variants
    .map(v => parseFloat(v.price || '0'))
    .filter(p => !isNaN(p));

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // 计算总库存
  const totalInventory = product.variants.reduce((sum, variant) => {
    return sum + (variant.inventoryQuantity || 0);
  }, 0);

  // 获取主图URL
  const imageUrl = product.images && product.images.length > 0 
    ? product.images[0].src 
    : null;

  return {
    minPrice,
    maxPrice,
    totalInventory,
    imageUrl
  };
}

// 定义 resolvers
export const resolvers = {
  // 查询入口
  Query: {
    /**
     * 获取产品列表
     */
    products: async (_, { pagination, filter, sort }, { prisma }) => {
      const { limit = 20, offset = 0 } = pagination || {};
      
      // 构建查询条件
      const where = buildWhereClause(filter);
      const orderBy = buildOrderByClause(sort);
      
      // 查询数据
      const items = await prisma.product.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          images: true,
          variants: true,
        },
      });
      
      // 查询总数
      const totalCount = await prisma.product.count({ where });
      
      // 构建返回结果
      return {
        items: items.map(product => ({
          ...product,
          ...calculateProductFields(product),
          status: product.status?.toUpperCase() || null
        })),
        totalCount,
        hasNextPage: offset + items.length < totalCount,
      };
    },
    
    /**
     * 获取单个产品
     */
    product: async (_, { id }, { prisma }) => {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          images: true,
          variants: true,
        },
      });
      
      if (!product) {
        return null;
      }
      
      return {
        ...product,
        ...calculateProductFields(product),
        status: product.status?.toUpperCase() || null
      };
    },
  },
  
  // 日期时间标量类型解析
  DateTime: {
    serialize: (date) => date instanceof Date ? date.toISOString() : date,
    parseValue: (value) => new Date(value),
    parseLiteral: (ast) => new Date(ast.value),
  },
};

export default resolvers; 