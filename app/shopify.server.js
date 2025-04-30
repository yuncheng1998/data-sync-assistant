import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// 打印启动配置日志
console.log(`[Shopify配置] 初始化Shopify App配置...`);
console.log(`[Shopify配置] API Key: ${process.env.SHOPIFY_API_KEY ? '已设置' : '未设置'}`);
console.log(`[Shopify配置] API Secret: ${process.env.SHOPIFY_API_SECRET ? '已设置' : '未设置'}`);
console.log(`[Shopify配置] App URL: ${process.env.SHOPIFY_APP_URL || '未设置 (这是必须的!)'}`);
console.log(`[Shopify配置] Scopes: ${process.env.SCOPES || '未设置'}`);
console.log(`[Shopify配置] Custom Domain: ${process.env.SHOP_CUSTOM_DOMAIN || '未设置'}`);
console.log(`[Shopify配置] Host环境变量: ${process.env.HOST || '未设置'}`);

// 确保应用URL以 https:// 开头
const appUrl = process.env.SHOPIFY_APP_URL || "";
const isHttps = appUrl.startsWith('https://');
if (appUrl && !isHttps) {
  console.warn(`[Shopify配置] 警告: SHOPIFY_APP_URL 不是以 https:// 开头! 这可能会导致认证问题。`);
}

// 检查主机和端口配置
const appUrlObj = appUrl ? new URL(appUrl) : null;
if (appUrlObj) {
  console.log(`[Shopify配置] 解析的主机: ${appUrlObj.host}, 端口: ${appUrlObj.port || '默认'}`);
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  // 启用调试日志
  isEmbeddedApp: true,
  webhooks: {
    // 配置webhook处理
    APP_UNINSTALLED: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks/app/uninstalled",
    },
  },
  hooks: {
    // 认证相关钩子添加日志
    beforeAuth: async (req) => {
      console.log(`[Shopify钩子] beforeAuth 触发, URL: ${req.url}`);
      return req;
    },
    afterAuth: async (req, res, session) => {
      console.log(`[Shopify钩子] afterAuth 触发，商店: ${session?.shop}`);
      return { req, res, session };
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// 导出配置信息，便于调试
console.log(`[Shopify配置] 配置完成, API版本: ${ApiVersion.January25}`);

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
