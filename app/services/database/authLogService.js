/**
 * 认证日志服务
 * 提供记录和查询认证日志的方法
 */
import prisma from '../../db.server.js';

/**
 * 记录商店认证信息
 * @param {Object} data - 认证数据
 * @returns {Promise<Object>} 创建的日志记录
 */
export async function recordAuthLog(data) {
  if (!data || !data.shop) {
    throw new Error('认证日志缺少必要的商店信息');
  }
  
  return await prisma.storeAuthLog.create({
    data: {
      shop: data.shop,
      authenticatedAt: data.authenticatedAt || new Date(),
      accessScopes: data.accessScopes || '',
      userType: data.userType || 'UNKNOWN',
      userEmail: data.userEmail || null,
      userName: data.userName || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null
    }
  });
}

/**
 * 记录认证失败信息
 * @param {Object} data - 失败数据
 * @returns {Promise<Object>} 创建的失败日志记录
 */
export async function recordAuthError(data) {
  if (!data || !data.shop) {
    throw new Error('认证错误日志缺少必要的商店信息');
  }
  
  return await prisma.storeAuthErrorLog.create({
    data: {
      shop: data.shop,
      errorAt: data.errorAt || new Date(),
      errorMessage: data.errorMessage || '未知错误',
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null
    }
  });
}

/**
 * 获取商店最近的认证记录
 * @param {string} shop - 商店域名
 * @param {number} limit - 返回记录数量
 * @returns {Promise<Array>} 认证记录列表
 */
export async function getRecentAuthLogs(shop, limit = 10) {
  return await prisma.storeAuthLog.findMany({
    where: {
      shop
    },
    orderBy: {
      authenticatedAt: 'desc'
    },
    take: limit
  });
}

/**
 * 获取商店最近的认证失败记录
 * @param {string} shop - 商店域名
 * @param {number} limit - 返回记录数量
 * @returns {Promise<Array>} 认证失败记录列表
 */
export async function getRecentAuthErrors(shop, limit = 10) {
  return await prisma.storeAuthErrorLog.findMany({
    where: {
      shop
    },
    orderBy: {
      errorAt: 'desc'
    },
    take: limit
  });
}

/**
 * 更新商店的最后认证时间
 * @param {string} shop - 商店域名
 * @returns {Promise<Object>} 更新的商店记录
 */
export async function updateLastAuthenticated(shop) {
  return await prisma.store.updateMany({
    where: {
      shop
    },
    data: {
      lastAuthenticated: new Date(),
      status: 'ACTIVE'
    }
  });
} 