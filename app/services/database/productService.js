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
    
    // 每批处理的产品数量
    const BATCH_SIZE = 10;
    
    // 分批处理产品
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      console.log(`处理第 ${i/BATCH_SIZE + 1} 批产品，共 ${batch.length} 个产品`);
      
      // 使用事务处理每一批的操作
      await prisma.$transaction(async (tx) => {
        for (const product of batch) {
          // 提取关联数据
          const { images, variants, ...productData } = product;
          
          // 使用 upsert 操作 - 如果存在则更新，不存在则创建
          const result = await tx.product.upsert({
            where: { id: product.id },
            update: {
              ...productData,
              syncedAt: new Date(),
              // 删除并重新创建关联数据
              images: {
                deleteMany: {},
                create: images
              },
              variants: {
                deleteMany: {},
                create: variants
              }
            },
            create: {
              ...productData,
              images: {
                create: images
              },
              variants: {
                create: variants
              }
            },
            include: {
              images: true,
              variants: true
            }
          });
          
          if (result) {
            if (result.syncedAt === result.createdAt) {
              createdCount++;
            } else {
              updatedCount++;
            }
          }
        }
      }, {
        // 增加事务超时时间为 30 秒
        timeout: 30000
      });
    }
    
    console.log(`数据库操作完成: 新增 ${createdCount} 个产品, 更新 ${updatedCount} 个产品`);
    return { createdCount, updatedCount };
  } catch (error) {
    console.error('保存产品数据失败:', error);
    throw error;
  }
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