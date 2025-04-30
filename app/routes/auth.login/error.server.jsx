import { LoginErrorType } from "@shopify/shopify-app-remix/server";

/**
 * 将登录错误类型转换为用户友好的错误消息
 * @param {Object} loginErrors - 从login函数返回的错误对象
 * @returns {Object} 格式化的错误消息对象
 */
export function loginErrorMessage(loginErrors) {
  console.log(`[ErrorHandler] 处理登录错误信息:`, loginErrors);

  // 如果没有错误，返回空对象
  if (!loginErrors) {
    return {};
  }

  // 检查是否是Response对象（可能包含重定向）
  if (loginErrors instanceof Response) {
    console.log(`[ErrorHandler] 收到Response对象，状态码: ${loginErrors.status}`);
    
    if (loginErrors.status >= 300 && loginErrors.status < 400) {
      const location = loginErrors.headers.get('Location');
      console.log(`[ErrorHandler] 这是一个重定向到: ${location}`);
      return {};
    }
    
    if (loginErrors.status >= 400) {
      console.log(`[ErrorHandler] 这是一个错误响应`);
      try {
        // 尝试解析响应内容
        return { shop: `认证服务器返回错误: ${loginErrors.status}` };
      } catch (e) {
        return { shop: `认证服务器返回错误: ${loginErrors.status}` };
      }
    }
    
    return {};
  }

  // 特定错误类型的处理
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    console.log(`[ErrorHandler] 缺少商店域名`);
    return { shop: "请输入您的商店域名以登录" };
  } else if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    console.log(`[ErrorHandler] 无效的商店域名`);
    return { shop: "请输入有效的商店域名以登录，格式应为 xxx.myshopify.com" };
  } else if (loginErrors?.shop === "INVALID_HMAC") {
    console.log(`[ErrorHandler] 无效的HMAC签名`);
    return { 
      shop: "验证签名无效，请确保您从Shopify商店管理员或应用商店正确访问", 
      detail: "HMAC验证失败可能是由于URL被修改或请求不是来自Shopify"
    };
  } else if (loginErrors?.shop === "INVALID_NONCE") {
    console.log(`[ErrorHandler] 无效的Nonce`);
    return { 
      shop: "安全验证令牌无效，请重新开始认证流程", 
      detail: "这通常是由于会话过期或浏览器缓存问题导致"
    };
  } else if (typeof loginErrors?.shop === 'string') {
    // 其他字符串错误
    console.log(`[ErrorHandler] 其他错误: ${loginErrors.shop}`);
    return { 
      shop: `认证失败: ${loginErrors.shop}`,
      detail: loginErrors.detail || "请检查商店域名并重试，或联系技术支持"
    };
  } else if (loginErrors instanceof Error) {
    // 处理异常对象
    console.log(`[ErrorHandler] 捕获到异常:`, loginErrors);
    return { 
      shop: `认证过程中出错: ${loginErrors.message}`,
      detail: process.env.NODE_ENV !== 'production' ? loginErrors.stack : undefined
    };
  }

  // 未识别的错误形式
  console.log(`[ErrorHandler] 未识别的错误格式:`, loginErrors);
  return { 
    shop: "认证过程中发生未知错误，请稍后重试",
    detail: JSON.stringify(loginErrors, null, 2)
  };
}
