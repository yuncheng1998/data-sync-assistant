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
    let unchangedCount = 0;
    let skippedCount = 0;
    
    // 获取所有订单ID列表
    const orderIds = orders.map(o => o.id);
    
    // 批量获取已存在的订单，减少数据库查询次数
    const existingOrders = await prisma.order.findMany({
      where: {
        id: { in: orderIds }
      },
      include: {
        lineItems: true
      }
    });
    
    // 将现有订单转换为Map，便于快速查找
    const existingOrdersMap = new Map();
    existingOrders.forEach(order => {
      existingOrdersMap.set(order.id, order);
    });
    
    console.log(`发现 ${existingOrders.length} 个已存在的订单，需要比对更新`);
    
    // 每批处理的订单数量和并发数
    const BATCH_SIZE = 10;
    const CONCURRENCY_LIMIT = 3;
    
    // 分批处理订单
    for (let i = 0; i < orders.length; i += BATCH_SIZE * CONCURRENCY_LIMIT) {
      const batchPromises = [];
      
      // 创建多个批次的并发Promise
      for (let j = 0; j < CONCURRENCY_LIMIT; j++) {
        const startIdx = i + (j * BATCH_SIZE);
        if (startIdx < orders.length) {
          const endIdx = Math.min(startIdx + BATCH_SIZE, orders.length);
          const batch = orders.slice(startIdx, endIdx);
          
          batchPromises.push(processOrderBatch(
            batch, 
            existingOrdersMap, 
            result => {
              createdCount += result.created;
              updatedCount += result.updated;
              unchangedCount += result.unchanged;
              skippedCount += result.skipped;
            }
          ));
        }
      }
      
      // 并发执行批次处理
      await Promise.all(batchPromises);
      
      // 每组批次之间稍作暂停，避免连接压力
      if (i + BATCH_SIZE * CONCURRENCY_LIMIT < orders.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`数据库操作完成: 新增 ${createdCount} 个订单, 更新 ${updatedCount} 个订单, 无变化 ${unchangedCount} 个订单, 跳过 ${skippedCount} 个订单`);
    return {
      success: true,
      createdCount,
      updatedCount,
      unchangedCount,
      skippedCount,
      totalCount: createdCount + updatedCount + unchangedCount + skippedCount
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
 * 处理单个批次的订单
 * @param {Array} batch - 订单批次
 * @param {Map} existingOrdersMap - 现有订单映射
 * @param {Function} updateCounters - 更新计数器回调
 * @returns {Promise<Object>} 批次处理结果
 */
async function processOrderBatch(batch, existingOrdersMap, updateCounters) {
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  // 逐个处理订单
  for (const order of batch) {
    // 提取关联数据
    const { lineItems, ...orderData } = order;
    
    try {
      // 检查订单是否应该被跳过（已经完成/取消且数据库中存在）
      const existingOrder = existingOrdersMap.get(order.id);
      
      if (existingOrder && shouldSkipOrderUpdate(existingOrder, orderData)) {
        // 更新最后同步时间，但不更改内容
        await prisma.order.update({
          where: { id: order.id },
          data: { syncedAt: new Date() }
        });
        skipped++;
        continue;
      }
      
      if (existingOrder) {
        // 订单存在，检查是否需要更新
        if (needsOrderUpdate(existingOrder, orderData, lineItems)) {
          // 删除现有的行项目
          await prisma.orderLineItem.deleteMany({
            where: { orderId: order.id }
          });
          
          // 更新订单
          await prisma.order.update({
            where: { id: order.id },
            data: {
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
          
          // 批量创建新行项目
          if (lineItems?.length > 0) {
            await prisma.orderLineItem.createMany({
              data: lineItems.map(item => ({
                ...item,
                orderId: order.id
              })),
              skipDuplicates: true
            });
          }
          
          updated++;
        } else {
          // 订单没有变化，仅更新同步时间
          await prisma.order.update({
            where: { id: order.id },
            data: { syncedAt: new Date() }
          });
          
          unchanged++;
        }
      } else {
        // 订单不存在，创建新订单
        await prisma.order.create({
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
            lineItems: {
              create: lineItems || []
            }
          }
        });
        
        created++;
      }
    } catch (err) {
      console.error(`处理订单 ${order.id} 时出错:`, err);
      // 继续处理下一个订单
    }
  }

  // 更新计数器
  updateCounters({ created, updated, unchanged, skipped });
  
  return { created, updated, unchanged, skipped };
}

/**
 * 判断订单是否应该跳过更新
 * @param {Object} existingOrder - 现有订单
 * @param {Object} newOrderData - 新订单数据
 * @returns {boolean} 是否应该跳过
 */
function shouldSkipOrderUpdate(existingOrder, newOrderData) {
  // 已完成且已支付的订单通常不会有变化
  if (
    existingOrder.fulfillmentStatus === 'FULFILLED' && 
    existingOrder.financialStatus === 'PAID' &&
    newOrderData.fulfillmentStatus === 'FULFILLED' && 
    newOrderData.financialStatus === 'PAID'
  ) {
    // 如果订单最后更新日期相同或新订单更新时间较旧，则跳过
    const existingUpdatedAt = new Date(existingOrder.updatedAt);
    const newUpdatedAt = new Date(newOrderData.updatedAt);
    
    // 如果订单已完成超过30天，则跳过
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (existingUpdatedAt < thirtyDaysAgo && newUpdatedAt < thirtyDaysAgo) {
      return true;
    }
  }
  
  // 已关闭/取消的订单通常不会再更改
  if (
    (existingOrder.fulfillmentStatus === 'CANCELLED' || existingOrder.financialStatus === 'REFUNDED') &&
    (newOrderData.fulfillmentStatus === 'CANCELLED' || newOrderData.financialStatus === 'REFUNDED')
  ) {
    return true;
  }
  
  return false;
}

/**
 * 判断订单是否需要更新
 * @param {Object} existingOrder - 现有订单
 * @param {Object} newOrderData - 新订单数据
 * @param {Array} newLineItems - 新行项目
 * @returns {boolean} 是否需要更新
 */
function needsOrderUpdate(existingOrder, newOrderData, newLineItems) {
  // 订单状态变化
  if (
    existingOrder.financialStatus !== newOrderData.financialStatus ||
    existingOrder.fulfillmentStatus !== newOrderData.fulfillmentStatus
  ) {
    return true;
  }
  
  // 订单金额变化
  if (existingOrder.totalPrice !== newOrderData.totalPrice) {
    return true;
  }
  
  // 行项目数量变化
  if ((existingOrder.lineItems?.length || 0) !== (newLineItems?.length || 0)) {
    return true;
  }
  
  // 检查最后更新时间，如果API数据更新了，则需要更新
  if (new Date(newOrderData.updatedAt) > new Date(existingOrder.updatedAt)) {
    return true;
  }
  
  // 行项目内容变化检查
  if (existingOrder.lineItems && newLineItems) {
    const existingLineItemsMap = new Map();
    existingOrder.lineItems.forEach(item => {
      existingLineItemsMap.set(item.id, item);
    });
    
    for (const newItem of newLineItems) {
      const existingItem = existingLineItemsMap.get(newItem.id);
      if (existingItem) {
        if (
          existingItem.quantity !== newItem.quantity ||
          existingItem.price !== newItem.price
        ) {
          return true;
        }
      } else {
        // 新增行项目
        return true;
      }
    }
  }
  
  return false;
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

/**
 * 执行订单同步，从Shopify获取订单数据并保存到数据库
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function executeOrderSync(options = {}) {
  try {
    console.log('开始执行订单同步，选项:', options);
    
    // 导入订单同步服务
    const { syncAllShopsOrders } = await import('../sync/orderSync.js');
    
    // 准备同步选项
    const syncOptions = {
      // 增量同步选项
      incremental: options.useIncrementalSync !== false,
      syncModifiedOnly: options.syncModifiedOnly !== false,
      // 批量大小
      batchSize: options.batchSize || 25,
      // 是否包含行项目
      includeLineItems: options.includeLineItems !== false,
      // 是否包含客户信息
      includeCustomer: options.includeCustomer || false,
      // 增量同步的开始时间
      updatedAfter: options.modifiedSince
    };
    
    // 执行同步
    const result = await syncAllShopsOrders(syncOptions);
    
    return {
      success: result.success,
      count: result.orders || 0,
      message: result.message || '订单同步已完成',
      details: result.details || []
    };
  } catch (error) {
    console.error('执行订单同步失败:', error);
    return {
      success: false,
      error: error.message,
      count: 0
    };
  }
}