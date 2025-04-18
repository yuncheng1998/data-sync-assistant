/**
 * 订单数据库服务
 */
import prisma from '../../db.server.js';

/**
 * 保存订单数据到数据库
 * @param {Array} orders - 订单数据数组
 * @returns {Promise} 操作结果
 */
export async function saveOrders(orders) {
  console.log(`开始保存 ${orders.length} 个订单到数据库...`);
  
  try {
    let createdCount = 0;
    let updatedCount = 0;
    
    // 每批处理的订单数量
    const BATCH_SIZE = 5;
    
    // 分批处理订单
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      console.log(`处理第 ${Math.floor(i/BATCH_SIZE) + 1} 批订单，共 ${batch.length} 个订单`);
      
      // 逐个处理订单，不使用事务
      for (const order of batch) {
        // 提取关联数据和准备数据
        const { lineItems, ...orderData } = order;
        
        try {
          // 先删除现有的行项目（如果存在）
          const existingOrder = await prisma.order.findUnique({
            where: { id: order.id },
            include: { lineItems: true }
          });
          
          if (existingOrder) {
            // 订单存在，先删除行项目然后更新
            await prisma.orderLineItem.deleteMany({
              where: { orderId: order.id }
            });
            
            // 更新订单
            await prisma.order.update({
              where: { id: order.id },
              data: {
                id: orderData.id,
                shop: orderData.shop,
                name: orderData.name,
                email: orderData.email,
                createdAt: orderData.createdAt,
                updatedAt: orderData.updatedAt,
                totalPrice: orderData.totalPrice,
                currencyCode: orderData.currencyCode,
                financialStatus: orderData.financialStatus,
                fulfillmentStatus: orderData.fulfillmentStatus,
                customerData: orderData.customerData,
                syncedAt: new Date()
              }
            });
            
            // 创建新行项目
            for (const lineItem of lineItems) {
              await prisma.orderLineItem.create({
                data: {
                  ...lineItem,
                  orderId: order.id
                }
              });
            }
            
            updatedCount++;
          } else {
            // 订单不存在，创建新订单
            const newOrder = await prisma.order.create({
              data: {
                id: orderData.id,
                shop: orderData.shop,
                name: orderData.name,
                email: orderData.email,
                createdAt: orderData.createdAt,
                updatedAt: orderData.updatedAt,
                totalPrice: orderData.totalPrice,
                currencyCode: orderData.currencyCode,
                financialStatus: orderData.financialStatus,
                fulfillmentStatus: orderData.fulfillmentStatus,
                customerData: orderData.customerData
              }
            });
            
            // 创建行项目
            for (const lineItem of lineItems) {
              await prisma.orderLineItem.create({
                data: {
                  ...lineItem,
                  orderId: order.id
                }
              });
            }
            
            createdCount++;
          }
        } catch (err) {
          console.error(`处理订单 ${order.id} 时出错:`, err);
          // 继续处理下一个订单，而不是让整个批次失败
        }
      }
      
      // 每批订单之间稍作暂停，避免连接压力
      if (i + BATCH_SIZE < orders.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return {
      success: true,
      createdCount,
      updatedCount,
      totalCount: createdCount + updatedCount
    };
  } catch (error) {
    console.error('保存订单数据失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取所有数据库中的订单
 * @param {string} shop - 店铺域名 (可选)
 * @returns {Promise<Array>} 订单数据数组
 */
export async function getOrders(shop = null) {
  try {
    const whereClause = shop ? { shop } : {};
    
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        lineItems: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    return orders;
  } catch (error) {
    console.error('获取订单数据失败:', error);
    throw error;
  }
}

/**
 * 获取订单数量
 * @param {string} shop - 店铺域名 (可选)
 * @returns {Promise<number>} 订单数量
 */
export async function getOrderCount(shop = null) {
  try {
    const whereClause = shop ? { shop } : {};
    
    return await prisma.order.count({
      where: whereClause
    });
  } catch (error) {
    console.error('获取订单数量失败:', error);
    throw error;
  }
}