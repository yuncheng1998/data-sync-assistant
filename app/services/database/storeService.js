/**
 * 商店数据服务
 * 管理商店相关的数据库操作
 */
import prisma from '../../db.server.js';

/**
 * 创建或更新商店记录
 * @param {string} shop - 商店域名 
 * @param {Object} data - 商店数据
 * @returns {Promise<Object>} 商店记录
 */
export async function createOrUpdateStore(shop, data = {}) {
  if (!shop) {
    throw new Error('商店域名不能为空');
  }

  try {
    // 尝试查找现有记录
    const existingStore = await prisma.store.findUnique({
      where: { shop }
    });

    if (existingStore) {
      // 商店存在，更新记录
      const updatedStore = await prisma.store.update({
        where: { shop },
        data: {
          status: data.status || existingStore.status,
          plan: data.plan || existingStore.plan,
          locale: data.locale || existingStore.locale,
          country: data.country || existingStore.country,
          timezone: data.timezone || existingStore.timezone,
          currency: data.currency || existingStore.currency,
          owner: data.owner || existingStore.owner,
          email: data.email || existingStore.email,
          phone: data.phone || existingStore.phone,
          address: data.address || existingStore.address,
          lastLogin: data.lastLogin || new Date(),
          metafields: data.metafields || existingStore.metafields,
          // 如果状态为UNINSTALLED，设置卸载时间
          ...(data.status === 'UNINSTALLED' ? { uninstalledAt: new Date() } : {})
        }
      });

      return updatedStore;
    } else {
      // 商店不存在，创建新记录
      const newStore = await prisma.store.create({
        data: {
          shop,
          status: data.status || 'ACTIVE',
          installDate: new Date(),
          plan: data.plan,
          locale: data.locale,
          country: data.country,
          timezone: data.timezone,
          currency: data.currency,
          owner: data.owner,
          email: data.email,
          phone: data.phone,
          address: data.address,
          lastLogin: data.lastLogin || new Date(),
          metafields: data.metafields
        }
      });

      return newStore;
    }
  } catch (error) {
    console.error(`创建或更新商店 ${shop} 记录失败:`, error);
    throw error;
  }
}

/**
 * 获取商店信息
 * @param {string} shop - 商店域名
 * @returns {Promise<Object|null>} 商店记录或null
 */
export async function getStore(shop) {
  if (!shop) {
    throw new Error('商店域名不能为空');
  }

  try {
    return await prisma.store.findUnique({
      where: { shop }
    });
  } catch (error) {
    console.error(`获取商店 ${shop} 信息失败:`, error);
    throw error;
  }
}

/**
 * 标记商店为卸载状态
 * @param {string} shop - 商店域名
 * @returns {Promise<Object>} 更新后的商店记录
 */
export async function markStoreAsUninstalled(shop) {
  if (!shop) {
    throw new Error('商店域名不能为空');
  }

  try {
    console.log(`标记商店 ${shop} 为卸载状态`);

    // 检查商店是否存在
    const store = await prisma.store.findUnique({
      where: { shop }
    });

    if (store) {
      // 更新状态为UNINSTALLED
      return await prisma.store.update({
        where: { shop },
        data: {
          status: 'UNINSTALLED',
          uninstalledAt: new Date()
        }
      });
    } else {
      // 创建新记录并标记为卸载
      return await prisma.store.create({
        data: {
          shop,
          status: 'UNINSTALLED',
          installDate: new Date(),
          uninstalledAt: new Date()
        }
      });
    }
  } catch (error) {
    console.error(`标记商店 ${shop} 为卸载状态失败:`, error);
    throw error;
  }
}

/**
 * 标记商店为活跃状态
 * @param {string} shop - 商店域名
 * @returns {Promise<Object>} 更新后的商店记录
 */
export async function markStoreAsActive(shop) {
  if (!shop) {
    throw new Error('商店域名不能为空');
  }

  try {
    console.log(`标记商店 ${shop} 为活跃状态`);

    // 检查商店是否存在
    const store = await prisma.store.findUnique({
      where: { shop }
    });

    if (store) {
      // 更新状态为ACTIVE
      return await prisma.store.update({
        where: { shop },
        data: {
          status: 'ACTIVE',
          uninstalledAt: null, // 清除卸载时间
          lastLogin: new Date()
        }
      });
    } else {
      // 创建新记录
      return await prisma.store.create({
        data: {
          shop,
          status: 'ACTIVE',
          installDate: new Date(),
          lastLogin: new Date()
        }
      });
    }
  } catch (error) {
    console.error(`标记商店 ${shop} 为活跃状态失败:`, error);
    throw error;
  }
}

/**
 * 获取所有商店列表
 * @param {string} status - 可选的状态过滤（ACTIVE, UNINSTALLED）
 * @returns {Promise<Array<Object>>} 商店记录数组
 */
export async function getAllStores(status = null) {
  try {
    const whereClause = status ? { status } : {};
    
    return await prisma.store.findMany({
      where: whereClause,
      orderBy: {
        lastLogin: 'desc'
      }
    });
  } catch (error) {
    console.error('获取商店列表失败:', error);
    throw error;
  }
}

/**
 * 删除商店记录
 * @param {string} shop - 商店域名
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteStore(shop) {
  if (!shop) {
    throw new Error('商店域名不能为空');
  }

  try {
    return await prisma.store.delete({
      where: { shop }
    });
  } catch (error) {
    console.error(`删除商店 ${shop} 记录失败:`, error);
    throw error;
  }
} 