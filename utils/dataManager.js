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

  // 积分与等级（新增）
  points: 0,
  userLevel: 'P5-应届牛马',
  // 行为去重容器（用于防止对同一对象重复加分）
  pointsDedup: {},
  
  // 决策历史记录
  decisionHistory: [],
  
  // 内容互动记录
  contentInteractions: {
    likedQuotes: [],     // 历史数据兼容：点赞语录ID
    votedTopics: {},     // 话题投票记录 {topicId: option}
    favorites: {         // 收藏等同于点赞
      quotes: [],        // 语录ID集合（如 'quote_12'）
      votes: []          // 投票收藏集合：{ id: topicId, myOption: 'A'|'B'|'' }
    }
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
      
      // 迁移历史错误的点路径键到嵌套结构
      const migrateDotPathKeys = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach((k) => {
          if (k.includes('.')) {
            const val = obj[k];
            const parts = k.split('.');
            let cursor = obj;
            for (let i = 0; i < parts.length - 1; i++) {
              const p = parts[i];
              if (typeof cursor[p] !== 'object' || cursor[p] === null) cursor[p] = {};
              cursor = cursor[p];
            }
            cursor[parts[parts.length - 1]] = val;
            delete obj[k];
          }
        });
        // 递归处理子对象
        Object.keys(obj).forEach((key) => {
          if (obj[key] && typeof obj[key] === 'object') migrateDotPathKeys(obj[key]);
        });
      };
      migrateDotPathKeys(mergedData);

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
    // 统一通过 initUserData 获取，确保结构被修复/补齐
    return initUserData();
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
    if (typeof key === 'string' && key.includes('.')) {
      const parts = key.split('.');
      let obj = data;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (obj[p] == null || typeof obj[p] !== 'object') {
          obj[p] = {};
        }
        obj = obj[p];
      }
      obj[parts[parts.length - 1]] = value;
    } else {
      data[key] = value;
    }
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
 * 获取包含用户手动添加餐厅的完整餐厅数据
 * - 合并静态餐厅数据和用户手动添加的餐厅
 * - 用于推荐算法，确保用户添加的餐厅能参与推荐
 * @returns {Object} 包含所有餐厅的数据对象
 */
function getCompleteRestaurantData() {
  try {
    // 获取静态餐厅数据
    const staticData = getRestaurantData();
    const staticRestaurants = staticData && Array.isArray(staticData.restaurants) 
      ? staticData.restaurants 
      : [];
    
    // 获取用户数据，查找手动添加的餐厅
    const userData = getUserData();
    const userAddedRestaurants = [];
    
    // 从welcomeSelections中提取用户添加的餐厅
    if (Array.isArray(userData.welcomeSelections)) {
      userData.welcomeSelections.forEach(restaurantId => {
        if (typeof restaurantId === 'string' && restaurantId.startsWith('user_added_')) {
          // 提取餐厅名称（去掉user_added_前缀）
          const restaurantName = restaurantId.replace('user_added_', '');
          
          // 检查是否已存在同名餐厅
          const existingRestaurant = staticRestaurants.find(r => 
            (r.name || r.brand || r.title) === restaurantName
          );
          
          if (!existingRestaurant) {
            // 创建用户添加的餐厅对象
            userAddedRestaurants.push({
              id: restaurantId,
              name: restaurantName,
              category: '用户添加',
              rating: 0,
              basePreferenceScore: 9, // 用户添加的餐厅默认高分
              userAdded: true
            });
            console.log(`[DataManager] 添加用户餐厅到推荐列表: ${restaurantName} (ID: ${restaurantId})`);
          }
        }
      });
    }
    
    // 合并静态餐厅和用户添加的餐厅
    const allRestaurants = [...staticRestaurants, ...userAddedRestaurants];
    
    console.log(`[DataManager] 完整餐厅数据: 静态餐厅${staticRestaurants.length}个, 用户添加${userAddedRestaurants.length}个, 总计${allRestaurants.length}个`);
    
    return {
      ...staticData,
      restaurants: allRestaurants
    };
  } catch (error) {
    console.error('[DataManager] 获取完整餐厅数据失败:', error);
    return getRestaurantData(); // 降级到静态数据
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
let __contentProvider = null; // 运行时注入的内容提供器（来自 packageB）
let __providerReady = false;
function setContentProvider(provider) {
  const valid = provider && typeof provider.getAppContent === 'function' ? provider : null;
  const changed = valid !== __contentProvider;
  __contentProvider = valid;
  __providerReady = !!__contentProvider;
  // 当提供器发生变化时，清空已缓存的应用内容，确保后续读取最新内容
  if (changed) {
    __cachedAppContent = null;
  }
}

// 优先尝试加载分包B的内容提供器（若存在）
function tryLoadPackageBProvider() {
  try {
    // utils/dataManager.js 相对 packageB/content/index.js 的路径
    const pkgBProvider = require('../packageB/content/index.js');
    if (pkgBProvider && typeof pkgBProvider.getAppContent === 'function') {
      setContentProvider(pkgBProvider);
      console.log('[DataManager] 分包B内容提供器加载成功');
      return true;
    }
  } catch (e) {
    // 分包可能未被构建或路径不可达，忽略错误，走主包兜底
  }
  return false;
}
function ensureContentProviderReady(callback) {
  // 强制清空缓存，确保重新加载
  __cachedAppContent = null;
  
  // 如果已经就绪，直接执行回调
  if (__providerReady && __contentProvider) {
    if (typeof callback === 'function') {
      callback(true);
    }
    return;
  }

  // 使用主包 JS 包装模块优先读取 JSON（避免直接 require JSON 的兼容性问题）
  try {
    let content = null;
    try {
      const wrapped = require('../data/pilotDialoguesJson.js');
      content = wrapped || null;
      console.log('[DataManager] 包装模块加载结果:', content ? '成功' : '失败');
      if (content && content.workQuotes) {
        console.log('[DataManager] 语录数量:', content.workQuotes.length);
        console.log('[DataManager] 第一条语录:', content.workQuotes[0] ? content.workQuotes[0].content : '无');
      }
    } catch (eWrapped) {
      console.error('[DataManager] 包装模块加载异常:', eWrapped.message);
      content = null;
    }

    if (!content || !content.workQuotes || content.workQuotes.length === 0) {
      // 再次回退：使用主包 JS 模块作为兜底
      console.log('[DataManager] 包装模块无效，回退到JS兜底');
      const pilotDialogues = require('../data/pilotDialogues.js');
      content = pilotDialogues || {};
    }

    const provider = {
      getAppContent: () => ({
        quotes: (content.workQuotes || []),
        topics: (content.voteTopics || [])
      })
    };
    setContentProvider(provider);
    console.log('[DataManager] 主包内容提供器（通过 JS 包装 JSON）加载成功');
    if (typeof callback === 'function') callback(true);
  } catch (error) {
    console.error('[DataManager] 主包内容加载失败:', error);
    if (typeof callback === 'function') callback(false);
  }
}

function getAppContent() {
  try {
    // 强制清空缓存，确保获取最新内容
    if (__cachedAppContent) {
      console.log('[DataManager] 使用缓存内容');
      return __cachedAppContent;
    }

    // 如果内容提供器可用，使用它
    if (__contentProvider && typeof __contentProvider.getAppContent === 'function') {
      const content = __contentProvider.getAppContent();
      __cachedAppContent = content;
      console.log('[DataManager] 通过内容提供器获取数据，语录数量:', (content.quotes || []).length);
      return content;
    }

    // 优先使用 JS 包装模块读取主包根目录 JSON
    try {
      const wrapped = require('../data/pilotDialoguesJson.js');
      const content = {
        quotes: (wrapped.workQuotes || []),
        topics: (wrapped.voteTopics || [])
      };
      __cachedAppContent = content;
      console.log('[DataManager] 直接通过包装模块获取数据，语录数量:', content.quotes.length);
      return content;
    } catch (jsonErr) {
      console.error('[DataManager] 包装模块获取失败:', jsonErr.message);
      // 回退到主包 JS 模块
      try {
        const pilotDialogues = require('../data/pilotDialogues.js');
        const fallbackContent = {
          quotes: pilotDialogues.workQuotes || [],
          topics: pilotDialogues.voteTopics || []
        };
        __cachedAppContent = fallbackContent;
        console.log('[DataManager] 使用JS兜底数据，语录数量:', fallbackContent.quotes.length);
        return fallbackContent;
      } catch (jsError) {
        console.error('[DataManager] 读取主包内容失败:', jsError);
        const emergencyContent = { quotes: [], topics: [] };
        __cachedAppContent = emergencyContent;
        return emergencyContent;
      }
    }
  } catch (error) {
    console.error('[DataManager] 获取应用内容失败:', error);
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
  getAppContent,
  setContentProvider,
  ensureContentProviderReady
};

// 在默认用户数据结构中加入积分与等级，以及收藏容器
const defaultUserData = {
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
    likedQuotes: [],     // 历史数据兼容：点赞语录ID
    votedTopics: {},     // 话题投票记录 {topicId: option}
    favorites: {         // 收藏等同于点赞
      quotes: [],        // 语录ID集合
      votes: []          // 投票收藏集合：{ id: topicId, myOption: 'A'|'B' }
    }
  }
};

// 引入可配置的积分与等级规则（优先 JSON，可回退 JS）
let pointsCfg = null;
try {
  pointsCfg = require('../levelsConfig.json');
} catch (eJson) {
  try {
    // 先尝试加载小写文件名，兼容仓库当前文件 pointsconfig.js
    pointsCfg = require('./pointsconfig');
    console.warn('[dataManager] points config loaded from JS fallback (lowercase)');
  } catch (eJsLower) {
    try {
      // 再尝试加载驼峰文件名，兼容大小写敏感环境
      pointsCfg = require('./pointsConfig');
      console.warn('[dataManager] points config loaded from JS fallback (CamelCase)');
    } catch (eJsUpper) {
      console.error('[dataManager] failed to load points config from JSON and JS fallbacks', eJson, eJsLower, eJsUpper);
      pointsCfg = { actions: {}, levels: [] };
    }
  }
}

/**
 * 按动作加分（带去重能力）
 * @param {string} actionKey - pointsConfig.actions 的键（spin/vote/bookmark/share）
 * @param {string} [uniqueId] - 可选去重ID（同个对象首次加分，如某条内容或某次事件）
 * @returns {number} 增加的分值（0 表示未加分）
 */
function addPoints(actionKey, uniqueId) {
  try {
    const userData = getUserData();
    const delta = (pointsCfg.actions && pointsCfg.actions[actionKey]) || 0;
    if (!delta) return 0;
    userData.pointsDedup = userData.pointsDedup || {};
    userData.pointsDedup[actionKey] = userData.pointsDedup[actionKey] || [];
    if (uniqueId) {
      if (userData.pointsDedup[actionKey].includes(uniqueId)) { return 0; }
      userData.pointsDedup[actionKey].push(uniqueId);
    }
    userData.points = (userData.points || 0) + delta;
    userData.userLevel = recalculateUserLevel(userData.points);
    wx.setStorageSync(STORAGE_KEYS.USER_DATA, userData);
    return delta;
  } catch (e) { console.error('[dataManager.addPoints] error', e); return 0; }
}

function recalculateUserLevel(points) {
  try {
    const levels = (pointsCfg && pointsCfg.levels) || [];
    if (!levels.length) return 'P5-应届牛马';
    
    // 从最高等级开始检查，找到第一个满足条件的等级
    for (let i = levels.length - 1; i >= 0; i--) {
      if (points >= levels[i].min) {
        return levels[i].name;
      }
    }
    
    // 如果积分不足最低等级要求，返回第一个等级
    return levels[0].name;
  } catch (e) { 
    console.error('[dataManager.recalculateUserLevel] error', e); 
    return 'P5-应届牛马'; 
  }
}

// 导出新增方法
module.exports = {
  initUserData,
  getUserData,
  updateUserData,
  addDecisionRecord,
  getRestaurantData,
  getCompleteRestaurantData,
  getAppContent,
  setContentProvider,
  ensureContentProviderReady,
  addPoints,
  recalculateUserLevel
};