/**
 * 折扣数据库服务
 */
import prisma from '../../db.server.js';

/**
 * 保存价格规则和折扣码数据到数据库
 * @param {Array} priceRules - 价格规则数据数组
 * @returns {Promise} 操作结果
 */
export async function savePriceRules(priceRules) {
  console.log(`开始保存 ${priceRules.length} 个价格规则到数据库...`);
  
  try {
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // 获取所有价格规则ID列表
    const priceRuleIds = priceRules.map(p => p.id);
    
    // 批量获取已存在的价格规则，减少数据库查询次数
    const existingPriceRules = await prisma.priceRule.findMany({
      where: {
        id: { in: priceRuleIds }
      },
      include: {
        discountCodes: true
      }
    });
    
    // 将现有价格规则转换为Map，便于快速查找
    const existingPriceRulesMap = new Map();
    existingPriceRules.forEach(rule => {
      existingPriceRulesMap.set(rule.id, rule);
    });
    
    console.log(`发现 ${existingPriceRules.length} 个已存在的价格规则，需要比对更新`);
    
    // 每批处理的价格规则数量
    const BATCH_SIZE = 10;
    const CONCURRENCY_LIMIT = 3; // 并发处理的批次数量
    
    // 分批处理价格规则
    for (let i = 0; i < priceRules.length; i += BATCH_SIZE * CONCURRENCY_LIMIT) {
      const batchPromises = [];
      
      // 创建多个批次的并发Promise
      for (let j = 0; j < CONCURRENCY_LIMIT; j++) {
        const startIdx = i + (j * BATCH_SIZE);
        if (startIdx < priceRules.length) {
          const endIdx = Math.min(startIdx + BATCH_SIZE, priceRules.length);
          const batch = priceRules.slice(startIdx, endIdx);
          
          batchPromises.push(processBatch(
            batch, 
            existingPriceRulesMap, 
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
      if (i + BATCH_SIZE * CONCURRENCY_LIMIT < priceRules.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`数据库操作完成: 新增 ${createdCount} 个价格规则, 更新 ${updatedCount} 个价格规则, 无变化 ${unchangedCount} 个价格规则`);
    return {
      success: true,
      createdCount,
      updatedCount,
      unchangedCount,
      totalCount: createdCount + updatedCount + unchangedCount
    };
  } catch (error) {
    console.error('保存价格规则数据失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 处理单个批次的价格规则
 * @param {Array} batch - 价格规则批次
 * @param {Map} existingPriceRulesMap - 现有价格规则映射
 * @param {Function} updateCounters - 更新计数器回调
 * @returns {Promise<Object>} 批次处理结果
 */
async function processBatch(batch, existingPriceRulesMap, updateCounters) {
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  // 逐个处理价格规则
  for (const priceRule of batch) {
    // 提取关联数据
    const { discountCodes, ...priceRuleData } = priceRule;
    
    try {
      // 检查价格规则是否存在
      const existingPriceRule = existingPriceRulesMap.get(priceRule.id);
      
      if (existingPriceRule) {
        // 价格规则存在，检查是否需要更新（比对关键字段）
        if (needsUpdate(existingPriceRule, priceRuleData, discountCodes)) {
          // 删除现有折扣码
          await prisma.discountCode.deleteMany({
            where: { priceRuleId: priceRule.id }
          });
          
          // 更新价格规则
          await prisma.priceRule.update({
            where: { id: priceRule.id },
            data: {
              title: priceRuleData.title,
              startsAt: priceRuleData.startsAt,
              endsAt: priceRuleData.endsAt,
              valueType: priceRuleData.valueType,
              value: priceRuleData.value,
              targetType: priceRuleData.targetType,
              oncePerCustomer: priceRuleData.oncePerCustomer,
              usageLimit: priceRuleData.usageLimit,
              customerSelection: priceRuleData.customerSelection,
              createdAt: priceRuleData.createdAt,
              updatedAt: priceRuleData.updatedAt,
              syncedAt: new Date()
            }
          });
          
          // 批量创建折扣码
          if (discountCodes?.length > 0) {
            await prisma.discountCode.createMany({
              data: discountCodes.map(code => ({
                ...code,
                priceRuleId: priceRule.id
              })),
              skipDuplicates: true
            });
          }
          
          updated++;
        } else {
          // 价格规则没有变化，仅更新同步时间
          await prisma.priceRule.update({
            where: { id: priceRule.id },
            data: { syncedAt: new Date() }
          });
          
          unchanged++;
        }
      } else {
        // 价格规则不存在，创建新的
        await prisma.priceRule.create({
          data: {
            id: priceRuleData.id,
            shop: priceRuleData.shop,
            title: priceRuleData.title,
            startsAt: priceRuleData.startsAt,
            endsAt: priceRuleData.endsAt,
            valueType: priceRuleData.valueType,
            value: priceRuleData.value,
            targetType: priceRuleData.targetType,
            oncePerCustomer: priceRuleData.oncePerCustomer,
            usageLimit: priceRuleData.usageLimit,
            customerSelection: priceRuleData.customerSelection,
            createdAt: priceRuleData.createdAt,
            updatedAt: priceRuleData.updatedAt,
            discountCodes: {
              create: (discountCodes || []).map(({ priceRuleId, ...rest }) => rest)
            }
          }
        });
        
        created++;
      }
    } catch (err) {
      console.error(`处理价格规则 ${priceRule.id} 时出错:`, err);
      // 继续处理下一个价格规则，而不是让整个批次失败
    }
  }

  // 更新计数器
  updateCounters({ created, updated, unchanged });
  
  return { created, updated, unchanged };
}

/**
 * 判断价格规则是否需要更新
 * @param {Object} existingPriceRule - 现有价格规则
 * @param {Object} newPriceRuleData - 新价格规则数据
 * @param {Array} newDiscountCodes - 新折扣码
 * @returns {boolean} 是否需要更新
 */
function needsUpdate(existingPriceRule, newPriceRuleData, newDiscountCodes) {
  // 基础字段比较
  if (
    existingPriceRule.title !== newPriceRuleData.title ||
    existingPriceRule.valueType !== newPriceRuleData.valueType ||
    existingPriceRule.value !== newPriceRuleData.value ||
    existingPriceRule.targetType !== newPriceRuleData.targetType ||
    existingPriceRule.oncePerCustomer !== newPriceRuleData.oncePerCustomer ||
    existingPriceRule.usageLimit !== newPriceRuleData.usageLimit ||
    existingPriceRule.customerSelection !== newPriceRuleData.customerSelection
  ) {
    return true;
  }
  
  // 检查日期字段
  const existingStartsAt = existingPriceRule.startsAt ? new Date(existingPriceRule.startsAt).getTime() : null;
  const newStartsAt = newPriceRuleData.startsAt ? new Date(newPriceRuleData.startsAt).getTime() : null;
  
  const existingEndsAt = existingPriceRule.endsAt ? new Date(existingPriceRule.endsAt).getTime() : null;
  const newEndsAt = newPriceRuleData.endsAt ? new Date(newPriceRuleData.endsAt).getTime() : null;
  
  if (existingStartsAt !== newStartsAt || existingEndsAt !== newEndsAt) {
    return true;
  }
  
  // 检查折扣码数量变化
  if ((existingPriceRule.discountCodes?.length || 0) !== (newDiscountCodes?.length || 0)) {
    return true;
  }
  
  // 检查最后更新时间，如果API数据更新了，则需要更新
  if (new Date(newPriceRuleData.updatedAt) > new Date(existingPriceRule.updatedAt)) {
    return true;
  }
  
  // 检查折扣码内容变化
  if (existingPriceRule.discountCodes && newDiscountCodes) {
    const existingCodesMap = new Map();
    existingPriceRule.discountCodes.forEach(code => {
      existingCodesMap.set(code.id, code);
    });
    
    for (const newCode of newDiscountCodes) {
      const existingCode = existingCodesMap.get(newCode.id);
      if (existingCode) {
        if (
          existingCode.code !== newCode.code ||
          existingCode.usageCount !== newCode.usageCount
        ) {
          return true;
        }
      } else {
        // 新增折扣码
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 获取所有数据库中的价格规则
 * @param {string} shop - 店铺域名 (可选)
 * @returns {Promise<Array>} 价格规则数据数组
 */
export async function getPriceRules(shop = null) {
  try {
    const whereClause = shop ? { shop } : {};
    
    const priceRules = await prisma.priceRule.findMany({
      where: whereClause,
      include: {
        discountCodes: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    return priceRules;
  } catch (error) {
    console.error('获取价格规则数据失败:', error);
    throw error;
  }
}

/**
 * 获取价格规则总数
 * @param {string} shop - 店铺域名 (可选)
 * @returns {Promise<number>} 价格规则总数
 */
export async function getPriceRuleCount(shop = null) {
  try {
    const whereClause = shop ? { shop } : {};
    
    const count = await prisma.priceRule.count({
      where: whereClause
    });
    
    return count;
  } catch (error) {
    console.error('获取价格规则总数失败:', error);
    throw error;
  }
}

/**
 * 执行折扣同步，从Shopify获取价格规则数据并保存到数据库
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} 同步结果
 */
export async function executeDiscountSync(options = {}) {
  try {
    console.log('开始执行折扣同步，选项:', options);
    
    // 导入折扣同步服务
    const { syncAllShopsDiscounts } = await import('../sync/discountSync.js');
    
    // 准备同步选项
    const syncOptions = {
      // 增量同步选项
      useIncrementalSync: options.useIncrementalSync !== false,
      syncModifiedOnly: options.syncModifiedOnly !== false,
      // 批量大小
      batchSize: options.batchSize || 50,
      // 是否全量同步
      fullSync: options.useIncrementalSync === false
    };
    
    // 执行同步
    const result = await syncAllShopsDiscounts(syncOptions);
    
    return {
      success: result.success,
      count: result.priceRules || 0,
      message: result.message || '折扣同步已完成',
      details: result.details || []
    };
  } catch (error) {
    console.error('执行折扣同步失败:', error);
    return {
      success: false,
      error: error.message,
      count: 0
    };
  }
} 