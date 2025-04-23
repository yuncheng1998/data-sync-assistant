/**
 * 同步服务基类
 * 为各种实体同步服务提供通用功能
 */
import prisma from '../../db.server.js';
import shopify from '../../shopify.server.js';

/**
 * 同步服务基类
 */
export class SyncService {
  /**
   * 构造函数
   * @param {string} entityType - 实体类型名称
   * @param {string} taskType - 任务类型常量
   * @param {Function} getAllEntityFn - 获取所有实体的函数
   * @param {Function} getRecentEntityFn - 获取最近实体的函数
   * @param {Function} getIncrementalEntityFn - 获取增量实体的函数
   * @param {Function} saveEntityFn - 保存实体的函数
   */
  constructor(entityType, taskType, getAllEntityFn, getRecentEntityFn, getIncrementalEntityFn, saveEntityFn) {
    this.entityType = entityType;
    this.taskType = taskType;
    this.getAllEntities = getAllEntityFn;
    this.getRecentEntities = getRecentEntityFn;
    this.getIncrementalEntities = getIncrementalEntityFn;
    this.saveEntities = saveEntityFn;
  }
  
  /**
   * 获取上次同步时间
   * @param {string} shop - 店铺域名
   * @param {Object} options - 同步选项
   * @returns {Promise<Date|null>} 上次同步时间
   */
  async getLastSyncTime(shop, options) {
    // 如果已经提供了updatedAfter，则直接使用
    if (options.updatedAfter) {
      console.log(`使用提供的增量同步时间: ${options.updatedAfter}`);
      return new Date(options.updatedAfter);
    }
    
    // 否则从数据库获取上次同步时间
    const lastSyncTask = await prisma.syncTask.findFirst({
      where: {
        shopId: shop,
        taskType: this.taskType,
        status: 'completed'
      },
      orderBy: {
        endTime: 'desc'
      }
    });
    
    if (lastSyncTask?.endTime) {
      // 设置增量同步时间（从上次同步前1天开始，避免遗漏）
      const lastSyncTime = new Date(lastSyncTask.endTime);
      lastSyncTime.setDate(lastSyncTime.getDate() - 1); // 往前1天，确保不会遗漏边界数据
      
      console.log(`使用增量同步，上次同步时间: ${lastSyncTime.toISOString()}`);
      return lastSyncTime;
    }
    
    return null;
  }
  
  /**
   * 获取有效的店铺会话
   * @param {string} shop - 店铺域名
   * @returns {Promise<Object>} 有效的店铺会话
   */
  async getValidSession(shop) {
    const session = await shopify.sessionStorage.findSessionsByShop(shop);
    
    if (!session || session.length === 0) {
      throw new Error(`未找到店铺 ${shop} 的有效会话`);
    }
    
    // 使用最新的有效会话
    const validSession = session.find(s => s.accessToken && (!s.expires || new Date(s.expires) > new Date()));
    
    if (!validSession) {
      throw new Error(`店铺 ${shop} 没有有效的访问令牌`);
    }
    
    return validSession;
  }
  
  /**
   * 同步指定店铺的数据
   * @param {string} shop - Shopify 店铺域名
   * @param {Object} options - 同步选项
   * @returns {Promise<Object>} 同步结果
   */
  async syncShopData(shop, options = {}) {
    console.log(`开始为店铺 ${shop} 同步${this.entityType}数据...`);
    
    try {
      // 获取店铺会话
      const validSession = await this.getValidSession(shop);
      
      // 获取上次同步时间，用于增量同步
      let lastSyncTime = null;
      if (options.incremental !== false) { // 默认进行增量同步
        lastSyncTime = await this.getLastSyncTime(shop, options);
      }
      
      // 根据同步策略选择合适的API调用
      let entities;
      if (!options.incremental) {
        // 全量同步
        console.log(`执行全量同步所有${this.entityType}...`);
        entities = await this.getAllEntities(shop, validSession.accessToken, options);
      } else if (options.recentOnly) {
        // 仅同步最近数据（默认7天）
        const days = options.days || 7;
        console.log(`仅同步最近 ${days} 天更新的${this.entityType}...`);
        entities = await this.getRecentEntities(shop, validSession.accessToken, days);
      } else if (lastSyncTime) {
        // 增量同步
        console.log(`执行增量同步，获取 ${lastSyncTime.toISOString()} 后更新的${this.entityType}...`);
        entities = await this.getIncrementalEntities(shop, validSession.accessToken, lastSyncTime);
      } else {
        // 默认获取最近30天的数据
        console.log(`执行默认同步（最近30天的${this.entityType}）...`);
        entities = await this.getRecentEntities(shop, validSession.accessToken, 30);
      }
      
      if (!entities || entities.length === 0) {
        console.log(`店铺 ${shop} 没有需要同步的${this.entityType}数据`);
        return { success: true, message: `没有${this.entityType}数据需要同步`, count: 0 };
      }
      
      // 保存数据到数据库
      console.log(`获取到 ${entities.length} 个${this.entityType}，正在保存到数据库...`);
      const result = await this.saveEntities(entities);
      
      // 返回同步结果
      return {
        success: result.success !== false,
        message: result.success === false ? `${this.entityType}保存失败: ${result.error}` : `成功同步 ${entities.length} 个${this.entityType}`,
        count: entities.length,
        details: result,
        error: result.success === false ? result.error : undefined
      };
    } catch (error) {
      console.error(`${this.entityType}同步失败:`, error);
      return {
        success: false,
        message: `${this.entityType}同步失败: ${error.message}`,
        error: error.stack,
        count: 0
      };
    }
  }
  
  /**
   * 同步所有店铺的数据
   * @param {Object} options - 同步选项
   * @returns {Promise<Object>} 同步结果
   */
  async syncAllShopsData(options = {}) {
    console.log(`开始同步所有店铺的${this.entityType}数据...`);
    
    try {
      // 获取所有店铺会话
      const allSessions = await shopify.sessionStorage.findSessionsByShop();
      const uniqueShops = [];
      
      // 获取唯一店铺列表
      allSessions.forEach(session => {
        if (!uniqueShops.includes(session.shop)) {
          uniqueShops.push(session.shop);
        }
      });
      
      console.log(`找到 ${uniqueShops.length} 个店铺需要同步`);
      
      if (uniqueShops.length === 0) {
        return { 
          success: true, 
          message: '没有找到需要同步的店铺', 
          shops: 0, 
          [this.entityType]: 0 
        };
      }
      
      // 同步每个店铺的数据
      const results = [];
      let totalEntities = 0;
      let allSuccess = true;
      
      for (const shop of uniqueShops) {
        const result = await this.syncShopData(shop, options);
        results.push({ shop, ...result });
        
        if (!result.success) {
          allSuccess = false;
        }
        
        if (result.success && result.count) {
          totalEntities += result.count;
        }
      }
      
      // 返回同步结果
      const message = allSuccess
        ? `已同步 ${uniqueShops.length} 个店铺的 ${totalEntities} 个${this.entityType}`
        : `部分店铺同步失败，已成功同步 ${totalEntities} 个${this.entityType}`;
        
      return {
        success: allSuccess,
        message,
        shops: uniqueShops.length,
        [this.entityType]: totalEntities,
        details: results
      };
    } catch (error) {
      console.error(`同步所有店铺${this.entityType}失败:`, error);
      return {
        success: false,
        message: `同步所有店铺${this.entityType}失败: ${error.message}`,
        error: error.stack,
        shops: 0,
        [this.entityType]: 0
      };
    }
  }
} 