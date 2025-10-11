/**
 * 餐厅优先级排序服务
 * 根据高德API结果和用户预选情况，按优先级排序餐厅
 */

const { getUserData, getRestaurantData } = require('./dataManager');

/**
 * 餐厅优先级枚举
 */
const PRIORITY_LEVELS = {
  AMAP_AND_PRESELECTED: 1,    // 高德+预选
  AMAP_NOT_PRESELECTED: 2,    // 高德非预选  
  PRESELECTED_NOT_AMAP: 3,    // 预选非高德
  OTHERS: 4                   // 其他
};

/**
 * 根据餐厅名称匹配现有餐厅数据
 * @param {string} restaurantName 餐厅名称
 * @param {Array} existingRestaurants 现有餐厅数据
 * @returns {Object|null} 匹配的餐厅对象
 */
function matchRestaurantByName(restaurantName, existingRestaurants) {
  if (!restaurantName || !existingRestaurants) return null;
  
  // 精确匹配
  let matched = existingRestaurants.find(r => r.name === restaurantName);
  if (matched) return matched;
  
  // 模糊匹配（包含关系）
  matched = existingRestaurants.find(r => 
    r.name.includes(restaurantName) || restaurantName.includes(r.name)
  );
  if (matched) return matched;
  
  // 品牌匹配
  matched = existingRestaurants.find(r => 
    r.brand && (r.brand === restaurantName || restaurantName.includes(r.brand))
  );
  
  return matched;
}

/**
 * 获取用户预选的餐厅ID列表
 * @returns {Array} 预选餐厅ID数组
 */
function getUserPreselectedRestaurants() {
  try {
    const userData = getUserData();
    const preselected = [];
    
    // 获取欢迎页选择的餐厅
    if (userData.welcomeSelections && Array.isArray(userData.welcomeSelections)) {
      preselected.push(...userData.welcomeSelections);
    }
    
    // 获取品牌选择对应的餐厅
    if (userData.welcomeSelectionsByBrand && Array.isArray(userData.welcomeSelectionsByBrand)) {
      const restaurantData = getRestaurantData();
      userData.welcomeSelectionsByBrand.forEach(brand => {
        const brandRestaurants = restaurantData.filter(r => r.brand === brand);
        preselected.push(...brandRestaurants.map(r => r.id));
      });
    }
    
    return [...new Set(preselected)]; // 去重
  } catch (error) {
    console.error('[restaurantPriorityService] 获取用户预选餐厅失败:', error);
    return [];
  }
}

/**
 * 计算餐厅优先级
 * @param {Object} restaurant 餐厅对象
 * @param {boolean} isFromAmap 是否来自高德API
 * @param {Array} preselectedIds 用户预选的餐厅ID列表
 * @returns {number} 优先级数值（越小优先级越高）
 */
function calculateRestaurantPriority(restaurant, isFromAmap, preselectedIds) {
  const isPreselected = preselectedIds.includes(restaurant.id);
  
  if (isFromAmap && isPreselected) {
    return PRIORITY_LEVELS.AMAP_AND_PRESELECTED;
  } else if (isFromAmap && !isPreselected) {
    return PRIORITY_LEVELS.AMAP_NOT_PRESELECTED;
  } else if (!isFromAmap && isPreselected) {
    return PRIORITY_LEVELS.PRESELECTED_NOT_AMAP;
  } else {
    return PRIORITY_LEVELS.OTHERS;
  }
}

/**
 * 将高德API餐厅转换为标准餐厅格式
 * @param {Object} amapRestaurant 高德API餐厅数据
 * @param {Object} matchedRestaurant 匹配的现有餐厅数据
 * @returns {Object} 标准格式餐厅对象
 */
function convertAmapRestaurant(amapRestaurant, matchedRestaurant) {
  return {
    id: matchedRestaurant ? matchedRestaurant.id : `amap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: amapRestaurant.name,
    brand: matchedRestaurant ? matchedRestaurant.brand : null,
    category: amapRestaurant.category || (matchedRestaurant ? matchedRestaurant.category : '餐厅'),
    distance: amapRestaurant.distance,
    isFromAmap: true,
    originalData: matchedRestaurant,
    amapData: amapRestaurant
  };
}

/**
 * 根据优先级排序餐厅列表
 * @param {Array} amapRestaurants 高德API返回的附近餐厅
 * @param {number} maxCount 最大返回数量，默认12
 * @returns {Promise<Array>} 排序后的餐厅列表
 */
async function prioritizeRestaurants(amapRestaurants = [], maxCount = 12) {
  try {
    const restaurantDataObj = getRestaurantData();
    const existingRestaurants = restaurantDataObj.restaurants || [];
    const preselectedIds = getUserPreselectedRestaurants();
    
    console.log('[restaurantPriorityService] 开始餐厅优先级排序');
    console.log('- 高德餐厅数量:', amapRestaurants.length);
    console.log('- 用户预选餐厅:', preselectedIds.length);
    console.log('- 现有餐厅数量:', existingRestaurants.length);
    
    const prioritizedRestaurants = [];
    const processedRestaurantIds = new Set();
    
    // 第一步：处理高德API返回的餐厅
    amapRestaurants.forEach(amapRestaurant => {
      const matchedRestaurant = matchRestaurantByName(amapRestaurant.name, existingRestaurants);
      const restaurant = convertAmapRestaurant(amapRestaurant, matchedRestaurant);
      
      if (matchedRestaurant) {
        processedRestaurantIds.add(matchedRestaurant.id);
      }
      
      restaurant.priority = calculateRestaurantPriority(restaurant, true, preselectedIds);
      prioritizedRestaurants.push(restaurant);
    });
    
    // 第二步：添加用户预选但不在高德结果中的餐厅
    preselectedIds.forEach(restaurantId => {
      if (!processedRestaurantIds.has(restaurantId)) {
        const restaurant = existingRestaurants.find(r => r.id === restaurantId);
        if (restaurant) {
          const prioritizedRestaurant = {
            ...restaurant,
            isFromAmap: false,
            priority: PRIORITY_LEVELS.PRESELECTED_NOT_AMAP,
            distance: null // 无距离信息
          };
          prioritizedRestaurants.push(prioritizedRestaurant);
          processedRestaurantIds.add(restaurantId);
        }
      }
    });
    
    // 第三步：如果数量不足，添加其他餐厅
    if (prioritizedRestaurants.length < maxCount) {
      const remainingCount = maxCount - prioritizedRestaurants.length;
      const otherRestaurants = existingRestaurants
        .filter(r => !processedRestaurantIds.has(r.id))
        .slice(0, remainingCount)
        .map(restaurant => ({
          ...restaurant,
          isFromAmap: false,
          priority: PRIORITY_LEVELS.OTHERS,
          distance: null
        }));
      
      prioritizedRestaurants.push(...otherRestaurants);
    }
    
    // 按优先级排序，同优先级内按距离排序（如果有距离信息）
    prioritizedRestaurants.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // 同优先级内的排序
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance; // 按距离升序
      } else if (a.distance !== null) {
        return -1; // 有距离的排在前面
      } else if (b.distance !== null) {
        return 1;
      } else {
        return 0; // 都没有距离信息，保持原顺序
      }
    });
    
    // 限制返回数量
    const result = prioritizedRestaurants.slice(0, maxCount);
    
    console.log('[restaurantPriorityService] 餐厅优先级排序完成');
    console.log('- 最终餐厅数量:', result.length);
    console.log('- 优先级分布:', {
      level1: result.filter(r => r.priority === 1).length,
      level2: result.filter(r => r.priority === 2).length,
      level3: result.filter(r => r.priority === 3).length,
      level4: result.filter(r => r.priority === 4).length
    });
    
    return result;
  } catch (error) {
    console.error('[restaurantPriorityService] 餐厅优先级排序失败:', error);
    // 降级处理：返回现有餐厅数据
    const restaurantDataObj = getRestaurantData();
    const existingRestaurants = restaurantDataObj.restaurants || [];
    return existingRestaurants.slice(0, maxCount).map(restaurant => ({
      ...restaurant,
      isFromAmap: false,
      priority: PRIORITY_LEVELS.OTHERS,
      distance: null
    }));
  }
}

/**
 * 获取基于位置的推荐餐厅列表
 * @param {Object} userLocation 用户位置信息
 * @param {number} maxCount 最大返回数量
 * @returns {Promise<Array>} 推荐餐厅列表
 */
async function getLocationBasedRecommendations(userLocation, maxCount = 12) {
  try {
    const locationService = require('./locationService');
    
    // 搜索附近餐厅
    const nearbyRestaurants = await locationService.searchNearbyRestaurants(userLocation);
    
    // 按优先级排序
    const prioritizedRestaurants = await prioritizeRestaurants(nearbyRestaurants, maxCount);
    
    return prioritizedRestaurants;
  } catch (error) {
    console.error('[restaurantPriorityService] 获取基于位置的推荐失败:', error);
    throw error;
  }
}

module.exports = {
  PRIORITY_LEVELS,
  matchRestaurantByName,
  getUserPreselectedRestaurants,
  calculateRestaurantPriority,
  prioritizeRestaurants,
  getLocationBasedRecommendations
};