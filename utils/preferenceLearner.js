/**
 * 偏好学习模块
 * 负责从用户行为中提取特征、更新用户偏好模型、计算餐厅偏好得分
 * @author 前端工程师
 * @version 1.0.0
 */

// 导入数据管理模块
const dataManager = require('./dataManager');
const { isUserAddedRestaurant } = require('./scoringManager');

// 特征权重配置
const FEATURE_WEIGHTS = {
  // 口味特征权重
  taste: {
    spicy: 0.8,    // 辣味
    sweet: 0.7,     // 甜味
    sour: 0.6,      // 酸味
    salty: 0.7,     // 咸味
    bitter: 0.5,    // 苦味
    umami: 0.8,     // 鲜味
    oily: 0.7,      // 油腻
    light: 0.7      // 清淡
  },
  // 其他特征权重
  other: {
    health: 0.6,        // 健康程度
    popularity: 0.5,    // 流行度
    price: 0.7          // 价格水平
  }
};

// 标签映射配置
const TAG_MAPPINGS = {
  // 口味映射
  '辣': { spicy: 0.9 },
  '麻辣': { spicy: 1.0 },
  '微辣': { spicy: 0.5 },
  '甜': { sweet: 0.9 },
  '甜辣': { sweet: 0.7, spicy: 0.7 },
  '酸': { sour: 0.9 },
  '酸辣': { sour: 0.8, spicy: 0.8 },
  '咸': { salty: 0.9 },
  '咸鲜': { salty: 0.8, umami: 0.7 },
  '苦': { bitter: 0.9 },
  '鲜': { umami: 0.9 },
  '油炸': { oily: 0.9, light: 0.1 },
  '油腻': { oily: 0.9, light: 0.1 },
  '清淡': { light: 0.9, oily: 0.1 },
  '清蒸': { light: 0.8, oily: 0.2 },
  
  // 健康映射
  '健康轻食': { health: 0.9, light: 0.8 },
  '低卡': { health: 0.8 },
  '低脂': { health: 0.8, oily: 0.2 },
  '高蛋白': { health: 0.7 },
  '低碳水': { health: 0.7 },
  '多菜': { health: 0.7, light: 0.6 },
  '素食': { health: 0.8, light: 0.7 }
};

// 学习率配置
const LEARNING_RATE = 0.2;

/**
 * 从餐厅数据中提取特征向量
 * @param {Object} restaurant 餐厅数据对象
 * @returns {Object} 提取的特征向量
 */
function extractFeatureVector(restaurant) {
  if (!restaurant || typeof restaurant !== 'object') {
    console.error('[PreferenceLearner] 提取特征失败：餐厅数据无效');
    return null;
  }
  
  try {
    // 初始化特征向量
    const featureVector = {
      // 口味特征
      taste: {
        spicy: 0,
        sweet: 0,
        sour: 0,
        salty: 0,
        bitter: 0,
        umami: 0,
        oily: 0,
        light: 0
      },
      // 其他特征
      other: {
        health: 0,
        popularity: 0,
        price: 0
      }
    };
    
    // 处理餐厅标签
    if (Array.isArray(restaurant.tags)) {
      restaurant.tags.forEach(tag => {
        // 查找标签映射
        const mapping = TAG_MAPPINGS[tag];
        if (mapping) {
          // 应用标签映射到特征向量
          Object.keys(mapping).forEach(feature => {
            if (featureVector.taste.hasOwnProperty(feature)) {
              featureVector.taste[feature] = Math.max(featureVector.taste[feature], mapping[feature]);
            } else if (featureVector.other.hasOwnProperty(feature)) {
              featureVector.other[feature] = Math.max(featureVector.other[feature], mapping[feature]);
            }
          });
        }
      });
    }
    
    // 处理辣度分数
    if (typeof restaurant.spicyScore === 'number') {
      featureVector.taste.spicy = Math.max(featureVector.taste.spicy, restaurant.spicyScore);
    }
    
    // 处理健康分数
    if (typeof restaurant.healthScore === 'number') {
      featureVector.other.health = Math.max(featureVector.other.health, restaurant.healthScore);
    }
    
    // 处理流行度分数
    if (typeof restaurant.popularityScore === 'number') {
      featureVector.other.popularity = Math.max(featureVector.other.popularity, restaurant.popularityScore);
    }
    
    // 处理价格水平 (1-5转换为0-1)
    if (typeof restaurant.priceLevel === 'number') {
      featureVector.other.price = Math.min(Math.max(restaurant.priceLevel / 5, 0), 1);
    }
    
    // 确保所有特征值在0-1范围内
    Object.keys(featureVector.taste).forEach(key => {
      featureVector.taste[key] = Math.min(Math.max(featureVector.taste[key], 0), 1);
    });
    
    Object.keys(featureVector.other).forEach(key => {
      featureVector.other[key] = Math.min(Math.max(featureVector.other[key], 0), 1);
    });
    
    return featureVector;
  } catch (error) {
    console.error('[PreferenceLearner] 提取特征向量失败:', error);
    return null;
  }
}

/**
 * 根据用户反馈更新用户偏好模型
 * @param {string} restaurantId 餐厅ID
 * @param {string} feedback 用户反馈 ('like' 或 'dislike')
 * @returns {boolean} 更新是否成功
 */
function updateUserPreference(restaurantId, feedback) {
  if (!restaurantId || typeof restaurantId !== 'string') {
    console.error('[PreferenceLearner] 更新偏好失败：餐厅ID无效');
    return false;
  }
  
  if (!feedback || !['like', 'dislike'].includes(feedback)) {
    console.error('[PreferenceLearner] 更新偏好失败：反馈值无效');
    return false;
  }
  
  try {
    // 获取餐厅数据
    const restaurantData = dataManager.getRestaurantData();
    if (!restaurantData || !restaurantData.restaurants) {
      console.error('[PreferenceLearner] 更新偏好失败：无法获取餐厅数据');
      return false;
    }
    
    // 查找目标餐厅（兼容字符串/数值ID）
    let restaurant = restaurantData.restaurants.find(r => String(r.id) === String(restaurantId));
    
    // 兜底：如果是用户手动添加的餐厅ID（user_added_*），构造合成餐厅对象
    if (!restaurant && isUserAddedRestaurant(String(restaurantId))) {
      const brandName = String(restaurantId).replace(/^user_added_/i, '').trim();
      restaurant = {
        id: String(restaurantId),
        name: brandName || '自定义餐厅',
        // 提供必要字段，extractFeatureVector会在缺省情况下给到0值
        tags: [],
        priceLevel: 2,
        popularityScore: 0.5,
        healthScore: 0.5,
        spicyScore: 0
      };
    }

    if (!restaurant) {
      console.error(`[PreferenceLearner] 更新偏好失败：找不到ID为${restaurantId}的餐厅`);
      return false;
    }
    
    // 提取餐厅特征向量
    const featureVector = extractFeatureVector(restaurant);
    if (!featureVector) {
      console.error('[PreferenceLearner] 更新偏好失败：无法提取特征向量');
      return false;
    }
    
    // 获取用户数据
    const userData = dataManager.getUserData();
    if (!userData || !userData.tasteProfile) {
      console.error('[PreferenceLearner] 更新偏好失败：无法获取用户数据');
      return false;
    }
    
    // 计算学习方向 (喜欢:正向学习, 不喜欢:反向学习)
    const direction = feedback === 'like' ? 1 : -1;
    
    // 仅更新口味偏好，不再读写 restaurantScores，避免双重计分
    Object.keys(userData.tasteProfile).forEach(taste => {
      if (featureVector.taste.hasOwnProperty(taste)) {
        const adjustment = direction * LEARNING_RATE * FEATURE_WEIGHTS.taste[taste] * featureVector.taste[taste];
        let newValue = userData.tasteProfile[taste] + adjustment;
        newValue = Math.min(Math.max(newValue, 0), 1);
        userData.tasteProfile[taste] = newValue;
      }
    });

    // 仅持久化 tasteProfile
    return dataManager.updateUserData('tasteProfile', userData.tasteProfile);
  } catch (error) {
    console.error('[PreferenceLearner] 更新用户偏好失败:', error);
    return false;
  }
}

/**
 * 计算餐厅与用户偏好的匹配得分
 * @param {Object} restaurant 餐厅数据对象
 * @returns {number} 偏好匹配得分 (0-10分)
 */
function calculatePreferenceScore(restaurant, tasteProfileOverride) {
  if (!restaurant || typeof restaurant !== 'object') {
    console.error('[PreferenceLearner] 计算偏好得分失败：餐厅数据无效');
    return 5; // 返回默认中等分数
  }
  
  try {
    // 优先使用外部传入的口味画像；否则尝试从本地用户数据获取
    let userData = null;
    let tasteProfile = tasteProfileOverride;
    if (!tasteProfile) {
      try {
        userData = dataManager.getUserData();
        tasteProfile = userData && userData.tasteProfile;
      } catch (e) {
        // 忽略，稍后采用降级逻辑
      }
    }

    // 若仍不可用，则降级为空画像（不再报错），最终会更多依赖基础分/其他特征
    if (!tasteProfile || typeof tasteProfile !== 'object') {
      tasteProfile = {};
    }
    
    // 提取餐厅特征向量
    const featureVector = extractFeatureVector(restaurant);
    if (!featureVector) {
      console.error('[PreferenceLearner] 计算偏好得分失败：无法提取特征向量');
      return restaurant.basePreferenceScore || 5;
    }
    
    // 计算口味匹配度
    let tasteMatchScore = 0;
    let totalTasteWeight = 0;
    
    Object.keys(FEATURE_WEIGHTS.taste).forEach(taste => {
      if (featureVector.taste.hasOwnProperty(taste)) {
        const userPref = typeof tasteProfile[taste] === 'number' ? tasteProfile[taste] : 0.5;
        const similarity = 1 - Math.abs(userPref - featureVector.taste[taste]);
        tasteMatchScore += similarity * FEATURE_WEIGHTS.taste[taste];
        totalTasteWeight += FEATURE_WEIGHTS.taste[taste];
      }
    });
    
    // 归一化口味匹配分数 (0-1)
    const normalizedTasteScore = totalTasteWeight > 0 ? tasteMatchScore / totalTasteWeight : 0.5;
    
    // 计算其他特征匹配度 (健康度、流行度、价格)
    const healthFactor = featureVector.other.health * FEATURE_WEIGHTS.other.health;
    const popularityFactor = featureVector.other.popularity * FEATURE_WEIGHTS.other.popularity;
    
    // 价格因子 (假设中等价位最受欢迎)
    const idealPrice = 0.5;
    const priceSimilarity = 1 - Math.abs(idealPrice - featureVector.other.price);
    const priceFactor = priceSimilarity * FEATURE_WEIGHTS.other.price;
    
    const totalOtherWeight = FEATURE_WEIGHTS.other.health + 
                            FEATURE_WEIGHTS.other.popularity + 
                            FEATURE_WEIGHTS.other.price;
    const normalizedOtherScore = (healthFactor + popularityFactor + priceFactor) / totalOtherWeight;
    
    // 组合口味分数和其他特征分数 (口味占70%，其他特征占30%)
    const combinedScore = normalizedTasteScore * 0.7 + normalizedOtherScore * 0.3;
    
    // 转换为10分制
    let finalScore = combinedScore * 10;
    
    // 历史评分加权（尽力获取，获取失败则跳过而不报错）
    try {
      if (!userData) userData = dataManager.getUserData();
      if (userData && userData.restaurantScores && userData.restaurantScores[restaurant.id] != null) {
        finalScore = finalScore * 0.6 + userData.restaurantScores[restaurant.id] * 0.4;
      } else if (restaurant.basePreferenceScore != null) {
        finalScore = finalScore * 0.8 + restaurant.basePreferenceScore * 0.2;
      }
    } catch (e) {
      if (restaurant.basePreferenceScore != null) {
        finalScore = finalScore * 0.8 + restaurant.basePreferenceScore * 0.2;
      }
    }
    
    // 确保最终分数在0-10范围内
    return Math.min(Math.max(finalScore, 0), 10);
  } catch (error) {
    console.error('[PreferenceLearner] 计算偏好得分失败:', error);
    return restaurant.basePreferenceScore || 5;
  }
}

// 导出函数
module.exports = {
  extractFeatureVector,
  updateUserPreference,
  calculatePreferenceScore
};