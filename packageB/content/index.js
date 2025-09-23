// packageB/content/index.js
// 为兼容历史引用，保留该模块，但改为读取主包内容
const dataManager = require('../../utils/dataManager');

function getAppContent() {
  // 直接复用 dataManager 的实现（它已优先读取主包 JSON/JS）
  return dataManager.getAppContent();
}

module.exports = { getAppContent };