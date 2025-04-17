/**
 * @deprecated 此服务已弃用，请使用 tokenService.js
 * 
 * 此文件保留仅用于兼容性目的，新代码应使用 tokenService.js 中的功能
 */

import { verifyToken, extractTokenFromHeader, getUserFromRequest } from './tokenService.js';

// 导出 tokenService 中的方法以保持向后兼容
export {
  verifyToken,
  extractTokenFromHeader,
  getUserFromRequest
};

// 废弃警告
console.warn('authService.js 已弃用，请使用 tokenService.js');

export default {
  verifyToken,
  extractTokenFromHeader,
  getUserFromRequest
}; 