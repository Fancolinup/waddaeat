/**
 * 数据管理工具模块
 * 统一管理小程序的本地数据存储和读取
 * @author 前端工程师
 * @version 1.0.0
 */

// 导入静态数据文件（改为延迟加载，避免真机对 JSON require 不兼容导致报错）
// const restaurantData = require('../restaurant_data.json');
// const pilotDialogues = require('../Pilot dialogues.json');
// 采用缓存变量与延迟加载策略，提高真机兼容性
let __cachedRestaurantData = null;
let __cachedAppContent = null;

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

  // 欢迎页选择（兼容旧逻辑，按餐厅ID）
  welcomeSelections: [],
  // 欢迎页品牌选择（新逻辑，按品牌名称）
  welcomeSelectionsByBrand: [],
  
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
 */
function getUserData() {
  try {
    const data = wx.getStorageSync(STORAGE_KEYS.USER_DATA);
    if (data && typeof data === 'object') {
      return data;
    } else {
      return initUserData();
    }
  } catch (error) {
    console.error('[DataManager] 获取用户数据失败:', error);
    return initUserData();
  }
}

/**
 * 更新用户数据中的某个键
 * @param {string} key 键名
 * @param {any} value 新的值
 */
function updateUserData(key, value) {
  try {
    const data = getUserData();
    data[key] = value;
    wx.setStorageSync(STORAGE_KEYS.USER_DATA, data);
    console.log(`[DataManager] 已更新用户数据字段: ${key}`);
    return true;
  } catch (error) {
    console.error('[DataManager] 更新用户数据失败:', error);
    return false;
  }
}

/**
 * 添加决策记录
 * @param {Object} record 决策记录对象
 */
function addDecisionRecord(record) {
  try {
    // 构建完整记录对象，包含时间戳
    const timestamp = new Date().toISOString();
    const fullRecord = {
      ...record,
      timestamp: timestamp
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
 * - 采用延迟 require，兼容部分真机基础库不支持直接 require JSON 的情况
 * - 当 require 失败时，使用内置兜底数据，确保页面可用
 * @returns {Object|null} 餐厅数据对象，获取失败时返回最小可用对象
 */
function getRestaurantData() {
  try {
    if (__cachedRestaurantData) {
      return __cachedRestaurantData;
    }

    let data = null;
    try {
      // 优先尝试 JS 包装文件（避免设备端直接 require JSON 的兼容性问题）
      data = require('../restaurant_data.js');
      try { wx.setStorageSync('JSON_FALLBACK_USED', false); } catch (e) {}
    } catch (eJs) {
      try {
        // 次优：尝试 JSON（开发者工具和较新基础库通常支持）
        data = require('../restaurant_data.json');
        try { wx.setStorageSync('JSON_FALLBACK_USED', false); } catch (e) {}
      } catch (eJson) {
        // 再次兜底：尝试使用文件系统读取打包内资源
        try {
          const fsm = wx.getFileSystemManager && wx.getFileSystemManager();
          if (fsm && !data) {
            const candidates = [
              'restaurant_data.json',
              '/restaurant_data.json',
              './restaurant_data.json',
              '../restaurant_data.json',
              '../../restaurant_data.json',
              'utils/../restaurant_data.json'
            ];
            for (let i = 0; i < candidates.length && !data; i++) {
              try {
                const content = fsm.readFileSync(candidates[i], 'utf-8');
                if (content) {
                  const parsed = JSON.parse(content);
                  if (parsed && typeof parsed === 'object') {
                    data = parsed;
                    console.log('[DataManager] 通过 FileSystem 读取 JSON 成功:', candidates[i]);
                    try { wx.setStorageSync('JSON_FALLBACK_USED', false); } catch (e) {}
                    break;
                  }
                }
              } catch (ignore) {
                // 逐个候选路径尝试，忽略读取失败
              }
            }
          }
        } catch (fsErr) {
          // 忽略 FS 读取异常，继续走兜底
        }

        if (!data) {
          console.warn('[DataManager] 无法读取餐厅静态数据，使用内置兜底数据');
          data = { restaurants: generateFallbackRestaurants() };
          try { wx.setStorageSync('JSON_FALLBACK_USED', true); } catch (e) {}
        }
      }
    }

    if (data && typeof data === 'object') {
      __cachedRestaurantData = data;
      return data;
    } else {
      console.error('[DataManager] 餐厅数据格式错误');
      try { wx.setStorageSync('JSON_FALLBACK_USED', true); } catch (e) {}
      return { restaurants: generateFallbackRestaurants() };
    }
  } catch (error) {
    console.error('[DataManager] 获取餐厅数据失败:', error);
    try { wx.setStorageSync('JSON_FALLBACK_USED', true); } catch (e) {}
    return { restaurants: generateFallbackRestaurants() };
  }
}

/**
 * 兜底餐厅数据（最小可用，避免页面崩溃）
 */
function generateFallbackRestaurants() {
  const list = [
    { id: 'fb_001', name: '莆田餐厅', type: '福建菜', promoText: '福建特色菜折扣', popularity: 0.82 },
    { id: 'fb_002', name: '蓝蛙', type: '西餐厅酒吧', promoText: '汉堡买一送一', popularity: 0.80 },
    { id: 'fb_003', name: 'Baker&Spice', type: '沙拉轻食', promoText: '沙拉套餐折扣', popularity: 0.75 },
    { id: 'fb_004', name: '沃歌斯', type: '沙拉轻食', promoText: '健康碗类特价', popularity: 0.78 },
    { id: 'fb_005', name: '超级碗', type: '健康轻食', promoText: '高蛋白套餐优惠', popularity: 0.72 },
    { id: 'fb_006', name: '陈香贵', type: '兰州牛肉面', promoText: '牛肉面特价日', popularity: 0.85 },
    { id: 'fb_007', name: '马记永', type: '兰州牛肉面', promoText: '面食买一送一', popularity: 0.83 },
    { id: 'fb_008', name: '麦当劳', type: '西式快餐', promoText: '超值星期一优惠', popularity: 0.90 },
    { id: 'fb_009', name: '肯德基', type: '西式快餐', promoText: '家庭套餐优惠', popularity: 0.88 },
    { id: 'fb_010', name: '小杨生煎', type: '小吃快餐', promoText: '人气单品优惠', popularity: 0.80 }
  ];
  return list.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type,
    dynamicPromotions: [{ type: 'fallback', dayOfWeek: 1, promoText: item.promoText }],
    popularityScore: item.popularity,
    basePreferenceScore: 5
  }));
}

/**
 * 从本地静态文件获取应用内容数据（语录和投票数据）
 * - 同样采用延迟 require，避免真机对 JSON 直接 require 的兼容性问题
 * @returns {Object|null} 应用内容数据对象，获取失败时返回空数据
 */
function getAppContent() {
  try {
    if (__cachedAppContent) {
      return __cachedAppContent;
    }

    let data = null;
    try {
      data = require('../Pilot dialogues.json');
    } catch (e1) {
      try {
        // 若未来重命名为不含空格的文件名
        data = require('../pilot_dialogues.json');
      } catch (e2) {
        console.warn('[DataManager] 无法直接 require JSON（语录），使用空数据兜底');
        data = null;
      }
    }

    if (data && typeof data === 'object') {
      __cachedAppContent = {
        quotes: data.workQuotes || [],
        topics: data.voteTopics || []
      };
      return __cachedAppContent;
    } else {
      return { quotes: [], topics: [] };
    }
  } catch (error) {
    console.error('[DataManager] 获取应用内容数据失败:', error);
    return { quotes: [], topics: [] };
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