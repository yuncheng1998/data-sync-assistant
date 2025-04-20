/**
 * 产品数据库服务
 */
import prisma from '../../db.server.js';

/**
 * 保存产品数据到数据库
 * @param {Array} products - 产品数据数组
 * @returns {Promise} 操作结果
 */
export async function saveProducts(products) {
  console.log(`开始保存 ${products.length} 个产品到数据库...`);
  
  try {
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // 获取所有产品ID列表，用于批量检查现有产品
    const productIds = products.map(p => p.id);
    
    // 批量获取已存在的产品，减少数据库查询次数
    const existingProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      },
      include: {
        images: true,
        variants: true
      }
    });
    
    // 将现有产品转换为Map，便于快速查找
    const existingProductsMap = new Map();
    existingProducts.forEach(product => {
      existingProductsMap.set(product.id, product);
    });
    
    console.log(`发现 ${existingProducts.length} 个已存在的产品，需要比对更新`);
    
    // 每批处理的产品数量
    const BATCH_SIZE = 10;
    const CONCURRENCY_LIMIT = 3; // 并发处理的批次数量
    
    // 分批处理产品
    for (let i = 0; i < products.length; i += BATCH_SIZE * CONCURRENCY_LIMIT) {
      const batchPromises = [];
      
      // 创建多个批次的并发Promise
      for (let j = 0; j < CONCURRENCY_LIMIT; j++) {
        const startIdx = i + (j * BATCH_SIZE);
        if (startIdx < products.length) {
          const endIdx = Math.min(startIdx + BATCH_SIZE, products.length);
          const batch = products.slice(startIdx, endIdx);
          
          batchPromises.push(processBatch(
            batch, 
            existingProductsMap, 
            result => {
              createdCount += result.created;
              updatedCount += result.updated;
              unchangedCount += result.unchanged;
            }
          ));
        }
      }
      
      // 并发执行批次处理
      await Promise.all(batchPromises);
      
      // 每组批次之间稍作暂停，避免连接压力
      if (i + BATCH_SIZE * CONCURRENCY_LIMIT < products.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`数据库操作完成: 新增 ${createdCount} 个产品, 更新 ${updatedCount} 个产品, 无变化 ${unchangedCount} 个产品`);
    return {
      success: true,
      createdCount,
      updatedCount,
      unchangedCount,
      totalCount: createdCount + updatedCount + unchangedCount
    };
  } catch (error) {
    console.error('保存产品数据失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 处理单个批次的产品
 * @param {Array} batch - 产品批次
 * @param {Map} existingProductsMap - 现有产品映射
 * @param {Function} updateCounters - 更新计数器回调
 * @returns {Promise<Object>} 批次处理结果
 */
async function processBatch(batch, existingProductsMap, updateCounters) {
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  // 逐个处理产品
  for (const product of batch) {
    // 提取关联数据
    const { images, variants, ...productData } = product;
    
    try {
      // 检查产品是否存在
      const existingProduct = existingProductsMap.get(product.id);
      
      if (existingProduct) {
        // 产品存在，检查是否需要更新（比对关键字段）
        if (needsUpdate(existingProduct, productData, images, variants)) {
          // 删除现有图片
          await prisma.productImage.deleteMany({
            where: { productId: product.id }
          });
          
          // 删除现有变体
          await prisma.productVariant.deleteMany({
            where: { productId: product.id }
          });
          
          // 更新产品
          await prisma.product.update({
            where: { id: product.id },
            data: {
              title: productData.title,
              description: productData.description,
              vendor: productData.vendor,
              productType: productData.productType,
              status: productData.status,
              handle: productData.handle,
              publishedAt: productData.publishedAt,
              createdAt: productData.createdAt,
              updatedAt: productData.updatedAt,
              tags: productData.tags,
              options: productData.options,
              metafields: productData.metafields,
              shop: productData.shop,
              syncedAt: new Date()
            }
          });
          
          // 批量创建图片
          if (images?.length > 0) {
            await prisma.productImage.createMany({
              data: images.map(image => ({
                ...image,
                productId: product.id
              })),
              skipDuplicates: true
            });
          }
          
          // 批量创建变体
          if (variants?.length > 0) {
            await prisma.productVariant.createMany({
              data: variants.map(variant => ({
                ...variant,
                productId: product.id
              })),
              skipDuplicates: true
            });
          }
          
          updated++;
        } else {
          // 产品没有变化，仅更新同步时间
          await prisma.product.update({
            where: { id: product.id },
            data: { syncedAt: new Date() }
          });
          
          unchanged++;
        }
      } else {
        // 产品不存在，批量创建
        await prisma.product.create({
          data: {
            id: productData.id,
            title: productData.title,
            description: productData.description,
            vendor: productData.vendor,
            productType: productData.productType,
            status: productData.status,
            handle: productData.handle,
            publishedAt: productData.publishedAt,
            createdAt: productData.createdAt,
            updatedAt: productData.updatedAt,
            tags: productData.tags,
            options: productData.options,
            metafields: productData.metafields,
            shop: productData.shop,
            images: {
              create: images || []
            },
            variants: {
              create: variants || []
            }
          }
        });
        
        created++;
      }
    } catch (err) {
      console.error(`处理产品 ${product.id} 时出错:`, err);
      // 继续处理下一个产品，而不是让整个批次失败
    }
  }

  // 更新计数器
  updateCounters({ created, updated, unchanged });
  
  return { created, updated, unchanged };
}

/**
 * 判断产品是否需要更新
 * @param {Object} existingProduct - 现有产品
 * @param {Object} newProductData - 新产品数据
 * @param {Array} newImages - 新产品图片
 * @param {Array} newVariants - 新产品变体
 * @returns {boolean} 是否需要更新
 */
function needsUpdate(existingProduct, newProductData, newImages, newVariants) {
  // 基础字段比较
  if (
    existingProduct.title !== newProductData.title ||
    existingProduct.status !== newProductData.status ||
    existingProduct.vendor !== newProductData.vendor ||
    existingProduct.productType !== newProductData.productType ||
    JSON.stringify(existingProduct.tags) !== JSON.stringify(newProductData.tags) ||
    JSON.stringify(existingProduct.options) !== JSON.stringify(newProductData.options) ||
    JSON.stringify(existingProduct.metafields) !== JSON.stringify(newProductData.metafields)
  ) {
    return true;
  }
  
  // 富文本字段可能包含HTML，需要规范化比较
  if (normalizeText(existingProduct.description) !== normalizeText(newProductData.description)) {
    return true;
  }
  
  // 检查图片数量变化
  if ((existingProduct.images?.length || 0) !== (newImages?.length || 0)) {
    return true;
  }
  
  // 检查变体数量变化
  if ((existingProduct.variants?.length || 0) !== (newVariants?.length || 0)) {
    return true;
  }
  
  // 检查最后更新时间，如果API数据更新了，则需要更新
  if (new Date(newProductData.updatedAt) > new Date(existingProduct.updatedAt)) {
    return true;
  }
  
  // 如果变体价格发生变化，需要更新
  if (existingProduct.variants && newVariants) {
    const existingVariantsMap = new Map();
    existingProduct.variants.forEach(variant => {
      existingVariantsMap.set(variant.id, variant);
    });
    
    for (const newVariant of newVariants) {
      const existingVariant = existingVariantsMap.get(newVariant.id);
      if (existingVariant) {
        if (
          existingVariant.price !== newVariant.price ||
          existingVariant.compareAtPrice !== newVariant.compareAtPrice ||
          existingVariant.inventoryQuantity !== newVariant.inventoryQuantity
        ) {
          return true;
        }
      } else {
        // 新增变体
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 规范化文本内容，用于比较
 * @param {string} text - 输入文本
 * @returns {string} 规范化后的文本
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

/**
 * 获取所有数据库中的产品
 * @param {string} shop - 店铺域名 (可选)
 * @returns {Promise<Array>} 产品数据数组
 */
export async function getProducts(shop = null) {
  try {
    const whereClause = shop ? { shop } : {};
    
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        images: true,
        variants: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    return products;
  } catch (error) {
    console.error('获取产品数据失败:', error);
    throw error;
  }
}

/**
 * 获取产品总数
 * @param {string} shop - 店铺域名 (可选)
 * @returns {Promise<number>} 产品总数
 */
export async function getProductCount(shop = null) {
  try {
    const whereClause = shop ? { shop } : {};
    
    const count = await prisma.product.count({
      where: whereClause
    });
    
    return count;
  } catch (error) {
    console.error('获取产品总数失败:', error);
    throw error;
  }
}

/**
 * 执行产品同步，从Shopify获取产品数据并保存到数据库
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function executeProductSync(options = {}) {
  try {
    console.log('开始执行产品同步，选项:', options);
    
    // 导入产品同步服务
    const { syncAllShopsProducts } = await import('../sync/productSync.js');
    
    // 准备同步选项
    const syncOptions = {
      // 增量同步选项
      useIncrementalSync: options.useIncrementalSync !== false,
      syncModifiedOnly: options.syncModifiedOnly !== false,
      // 批量大小
      batchSize: options.batchSize || 50,
      // 是否包含元字段
      includeMetafields: options.includeMetafields !== false,
      // 是否删除过时产品
      deleteStaleProducts: options.deleteStaleProducts || false,
      // 是否全量同步
      fullSync: options.useIncrementalSync === false
    };
    
    // 执行同步
    const result = await syncAllShopsProducts(syncOptions);
    
    return {
      success: result.success,
      count: result.products || 0,
      message: result.message || '产品同步已完成',
      details: result.details || []
    };
  } catch (error) {
    console.error('执行产品同步失败:', error);
    return {
      success: false,
      error: error.message,
      count: 0
    };
  }
} 