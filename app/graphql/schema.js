import gql from 'graphql-tag';

/**
 * GraphQL Schema 定义
 * 主要定义了 Product 类型和相关查询
 */
export const typeDefs = gql`
  """
  日期时间类型
  """
  scalar DateTime

  """
  产品状态枚举
  """
  enum ProductStatus {
    """活跃状态，可用于销售"""
    ACTIVE
    """草稿状态，尚未发布"""
    DRAFT
    """已归档状态，不再销售"""
    ARCHIVED
  }

  """
  排序方向枚举
  """
  enum SortDirection {
    """升序排列"""
    ASC
    """降序排列"""
    DESC
  }

  """
  产品排序字段枚举
  """
  enum ProductSortField {
    """按标题排序"""
    TITLE
    """按更新时间排序"""
    UPDATED_AT
    """按创建时间排序"""
    CREATED_AT
    """按库存数量排序"""
    TOTAL_INVENTORY
    """按价格排序"""
    PRICE
  }

  """
  产品排序输入
  """
  input ProductSortInput {
    """排序字段"""
    field: ProductSortField!
    """排序方向"""
    direction: SortDirection!
  }

  """
  产品过滤条件输入
  """
  input ProductFilterInput {
    """按状态过滤"""
    status: ProductStatus
    """按供应商名称过滤"""
    vendor: String
    """按产品类型过滤"""
    productType: String
    """最小库存量过滤"""
    minInventory: Int
    """最大库存量过滤"""
    maxInventory: Int
    """关键词搜索（匹配标题、描述等）"""
    searchQuery: String
    """店铺名称过滤"""
    shop: String
  }

  """
  分页输入
  """
  input PaginationInput {
    """结果数量限制"""
    limit: Int
    """偏移量（跳过的结果数）"""
    offset: Int
  }

  """
  产品变体类型
  """
  type ProductVariant {
    """变体唯一标识"""
    id: ID!
    """变体标题"""
    title: String!
    """变体价格"""
    price: String
    """比较价格"""
    compareAtPrice: String
    """SKU编码"""
    sku: String
    """库存数量"""
    inventoryQuantity: Int
    """是否需要物流配送"""
    requiresShipping: Boolean
    """条形码"""
    barcode: String
    """产品ID"""
    productId: ID!
    """创建时间"""
    createdAt: DateTime!
    """最后更新时间"""
    updatedAt: DateTime!
  }

  """
  产品图片类型
  """
  type ProductImage {
    """图片唯一标识"""
    id: ID!
    """图片URL地址"""
    src: String!
    """图片替代文本"""
    altText: String
    """图片宽度"""
    width: Int
    """图片高度"""
    height: Int
    """图片位置"""
    position: Int
    """产品ID"""
    productId: ID!
    """创建时间"""
    createdAt: DateTime!
    """最后更新时间"""
    updatedAt: DateTime!
  }

  """
  产品类型
  """
  type Product {
    """产品唯一标识"""
    id: ID!
    """所属店铺"""
    shop: String!
    """产品标题"""
    title: String!
    """产品描述"""
    description: String
    """供应商"""
    vendor: String
    """产品类型"""
    productType: String
    """状态（active/draft/archived）"""
    status: ProductStatus
    """产品句柄（用于URL）"""
    handle: String
    """发布时间"""
    publishedAt: DateTime
    """创建时间"""
    createdAt: DateTime!
    """最后更新时间"""
    updatedAt: DateTime!
    """产品标签"""
    tags: [String!]
    """最低价格"""
    minPrice: Float!
    """最高价格"""
    maxPrice: Float!
    """总库存量"""
    totalInventory: Int!
    """主图URL"""
    imageUrl: String
    """所有图片"""
    images: [ProductImage!]!
    """产品变体"""
    variants: [ProductVariant!]!
    """最后同步时间"""
    syncedAt: DateTime
  }

  """
  分页结果类型
  """
  type ProductConnection {
    """产品列表"""
    items: [Product!]!
    """总数"""
    totalCount: Int!
    """是否有下一页"""
    hasNextPage: Boolean!
  }

  """
  用户信息类型
  """
  type User {
    """用户ID"""
    userId: ID!
    """用户邮箱"""
    email: String!
    """用户角色"""
    role: String!
  }

  """
  查询根类型
  """
  type Query {
    """
    获取产品列表
    支持分页、过滤和排序
    """
    products(
      """分页参数"""
      pagination: PaginationInput
      """过滤条件"""
      filter: ProductFilterInput
      """排序参数"""
      sort: ProductSortInput
    ): ProductConnection!

    """
    根据ID获取单个产品
    """
    product(
      """产品ID"""
      id: ID!
    ): Product

    """
    获取用户信息
    """
    me: User
  }
`;

export default typeDefs; 