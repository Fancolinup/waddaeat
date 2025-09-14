/**
 * 数据管理工具模块
 * 统一管理小程序的本地数据存储和读取
 * @author 前端工程师
 * @version 1.0.0
 */

// 导入静态数据文件
const restaurantData = require('../restaurant_data.json');
const pilotDialogues = require('../Pilot dialogues.json');

// 存储键名常量
const STORAGE_KEYS = {
  USER_DATA: 'user_data'
};

// 默认用户数据结构
const DEFAULT_USER_DATA = {
  // 口味偏好权重 (0-1之间的数值)
  tasteProfile: {
    spicy: 0.5,      // 辣味偏好
    sweet: 0.5,      // 甜味偏好
    sour: 0.5,       // 酸味偏好
    salty: 0.5,      // 咸味偏好
    bitter: 0.5,     // 苦味偏好
    umami: 0.5,      // 鲜味偏好
    oily: 0.5,       // 油腻偏好
    light: 0.5       // 清淡偏好
  },
  
  // 协同过滤模型 - 餐厅评分
  restaurantScores: {
    // 格式: "餐厅ID": 当前偏好分 (基于初始分和用户互动计算得出)
    // 示例:
    // "bj_guomao_001": 6.5,
    // "user_added_1": 9.0
  },
  
  // 决策历史记录
  decisionHistory: [],
  
  // 内容互动记录
  contentInteractions: {
    likedQuotes: [],     // 点赞的语录ID列表
    votedTopics: {}      // 投票的话题记录 {topicId: voteOption}
  }
};

/**
 * 初始化用户数据
 * 如果本地没有用户数据，则创建默认结构并保存；如果已有，则直接返回
 * @returns {Object} 用户数据对象
 */
function initUserData() {
  try {
    // 尝试获取本地存储的用户数据
    const existingData = wx.getStorageSync(STORAGE_KEYS.USER_DATA);
    
    if (existingData && typeof existingData === 'object') {
      // 检查数据结构完整性，补充缺失的字段
      const mergedData = mergeWithDefault(existingData, DEFAULT_USER_DATA);
      
      // 如果数据结构有更新，重新保存
      if (JSON.stringify(mergedData) !== JSON.stringify(existingData)) {
        wx.setStorageSync(STORAGE_KEYS.USER_DATA, mergedData);
        console.log('[DataManager] 用户数据结构已更新');
      }
      
      return mergedData;
    } else {
      // 本地没有数据或数据格式错误，创建默认数据
      const defaultData = JSON.parse(JSON.stringify(DEFAULT_USER_DATA));
      wx.setStorageSync(STORAGE_KEYS.USER_DATA, defaultData);
      console.log('[DataManager] 已创建默认用户数据');
      return defaultData;
    }
  } catch (error) {
    console.error('[DataManager] 初始化用户数据失败:', error);
    // 发生错误时返回默认数据
    const defaultData = JSON.parse(JSON.stringify(DEFAULT_USER_DATA));
    try {
      wx.setStorageSync(STORAGE_KEYS.USER_DATA, defaultData);
    } catch (saveError) {
      console.error('[DataManager] 保存默认数据失败:', saveError);
    }
    return defaultData;
  }
}

/**
 * 合并现有数据与默认数据结构
 * @param {Object} existing 现有数据
 * @param {Object} defaultData 默认数据结构
 * @returns {Object} 合并后的数据
 */
function mergeWithDefault(existing, defaultData) {
  const merged = JSON.parse(JSON.stringify(existing));
  
  // 递归合并对象
  function deepMerge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          deepMerge(target[key], source[key]);
        } else if (!target.hasOwnProperty(key)) {
          target[key] = JSON.parse(JSON.stringify(source[key]));
        }
      }
    }
  }
  
  deepMerge(merged, defaultData);
  return merged;
}

/**
 * 同步获取完整的用户数据对象
 * @returns {Object} 用户数据对象
 */
function getUserData() {
  try {
    const userData = wx.getStorageSync(STORAGE_KEYS.USER_DATA);
    
    if (userData && typeof userData === 'object') {
      return userData;
    } else {
      // 如果数据不存在或格式错误，重新初始化
      console.warn('[DataManager] 用户数据不存在或格式错误，重新初始化');
      return initUserData();
    }
  } catch (error) {
    console.error('[DataManager] 获取用户数据失败:', error);
    // 发生错误时重新初始化
    return initUserData();
  }
}

/**
 * 更新用户数据中的特定字段并自动保存到本地
 * @param {string} key 要更新的字段路径，支持嵌套属性（如：'tasteProfile.spicy'）
 * @param {*} value 新的值
 * @returns {boolean} 更新是否成功
 */
function updateUserData(key, value) {
  try {
    if (!key || typeof key !== 'string') {
      console.error('[DataManager] 更新失败：key参数无效');
      return false;
    }
    
    // 获取当前用户数据
    const userData = getUserData();
    
    // 解析嵌套属性路径
    const keyPath = key.split('.');
    let current = userData;
    
    // 导航到目标对象
    for (let i = 0; i < keyPath.length - 1; i++) {
      const currentKey = keyPath[i];
      if (!current[currentKey] || typeof current[currentKey] !== 'object') {
        current[currentKey] = {};
      }
      current = current[currentKey];
    }
    
    // 设置最终值
    const finalKey = keyPath[keyPath.length - 1];
    current[finalKey] = value;
    
    // 保存更新后的数据
    wx.setStorageSync(STORAGE_KEYS.USER_DATA, userData);
    console.log(`[DataManager] 已更新字段: ${key}`);
    
    return true;
  } catch (error) {
    console.error('[DataManager] 更新用户数据失败:', error);
    return false;
  }
}

/**
 * 向决策历史数组中添加一条新的决策记录并自动保存
 * @param {Object} record 决策记录对象
 * @param {Array} record.options 选项数组
 * @param {string} record.selected 选中的选项
 * @param {string} record.feedback 用户反馈 ('like' 或 'dislike')
 * @returns {boolean} 添加是否成功
 */
function addDecisionRecord(record) {
  try {
    // 验证记录格式
    if (!record || typeof record !== 'object') {
      console.error('[DataManager] 添加决策记录失败：record参数无效');
      return false;
    }
    
    const { options, selected, feedback } = record;
    
    // 验证必需字段
    if (!Array.isArray(options) || !selected || !feedback) {
      console.error('[DataManager] 添加决策记录失败：缺少必需字段');
      return false;
    }
    
    // 验证反馈值
    if (!['like', 'dislike'].includes(feedback)) {
      console.error('[DataManager] 添加决策记录失败：feedback值无效');
      return false;
    }
    
    // 创建完整的记录对象
    const fullRecord = {
      timestamp: Date.now(),
      options: [...options], // 创建副本避免引用问题
      selected: selected,
      feedback: feedback
    };
    
    // 获取当前用户数据
    const userData = getUserData();
    
    // 确保decisionHistory数组存在
    if (!Array.isArray(userData.decisionHistory)) {
      userData.decisionHistory = [];
    }
    
    // 添加新记录
    userData.decisionHistory.push(fullRecord);
    
    // 保存更新后的数据
    wx.setStorageSync(STORAGE_KEYS.USER_DATA, userData);
    console.log('[DataManager] 已添加决策记录');
    
    return true;
  } catch (error) {
    console.error('[DataManager] 添加决策记录失败:', error);
    return false;
  }
}

/**
 * 从本地静态文件获取餐厅数据
 * @returns {Object|null} 餐厅数据对象，获取失败时返回null
 */
function getRestaurantData() {
  try {
    // 直接返回导入的餐厅数据
    if (restaurantData && typeof restaurantData === 'object') {
      return restaurantData;
    } else {
      console.error('[DataManager] 餐厅数据格式错误');
      return null;
    }
  } catch (error) {
    console.error('[DataManager] 获取餐厅数据失败:', error);
    return null;
  }
}

/**
 * 从本地静态文件获取应用内容数据（语录和投票数据）
 * @returns {Object|null} 应用内容数据对象，获取失败时返回null
 */
function getAppContent() {
  try {
    if (pilotDialogues && typeof pilotDialogues === 'object') {
      return {
        quotes: pilotDialogues.workQuotes || [],
        topics: pilotDialogues.voteTopics || []
      };
    } else {
      console.error('[DataManager] 应用内容数据格式错误');
      return null;
    }
  } catch (error) {
    console.error('[DataManager] 获取应用内容数据失败:', error);
    return null;
  }
}

// 导出所有函数
module.exports = {
  initUserData,
  getUserData,
  updateUserData,
  addDecisionRecord,
  getRestaurantData,
  getAppContent
};