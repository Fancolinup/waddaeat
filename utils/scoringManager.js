/**
 * 餐厅评分管理模块
 * 用于管理用户对餐厅的偏好评分系统，包括分数更新和获取
 * @author AI Assistant
 * @date 2025-01-14
 */

const { updateUserData } = require('./dataManager');

/**
 * 检查是否为用户手动添加的餐厅
 * @param {string} restaurantId - 餐厅ID
 * @returns {boolean} 是否为用户手动添加的餐厅
 */
function isUserAddedRestaurant(restaurantId) {
  try {
    return typeof restaurantId === 'string' && restaurantId.startsWith('user_added_');
  } catch (error) {
    console.error('检查用户添加餐厅时出错:', error);
    return false;
  }
}

/**
 * 检查是否为欢迎页选择的餐厅
 * @param {string} restaurantId - 餐厅ID
 * @param {Object} userData - 用户数据对象
 * @returns {boolean} 是否为欢迎页选择的餐厅
 */
function isWelcomeSelection(restaurantId, userData) {
  try {
    if (!userData || !userData.welcomeSelections || !Array.isArray(userData.welcomeSelections)) {
      return false;
    }
    return userData.welcomeSelections.includes(restaurantId);
  } catch (error) {
    console.error('检查欢迎页选择餐厅时出错:', error);
    return false;
  }
}

/**
 * 确保分数在 [0, 10] 范围内
 * @param {number} score - 原始分数
 * @returns {number} 限制在范围内的分数
 */
function clampScore(score) {
  try {
    const numScore = Number(score);
    if (isNaN(numScore)) {
      console.warn('无效的分数值，使用默认值5:', score);
      return 5;
    }
    return Math.max(0, Math.min(10, numScore));
  } catch (error) {
    console.error('限制分数范围时出错:', error);
    return 5;
  }
}

/**
 * 获取餐厅的当前评分
 * @param {Object} userData - 用户数据对象
 * @param {string} restaurantId - 餐厅ID
 * @param {Object} restaurantData - 餐厅数据对象
 * @returns {number} 餐厅的当前偏好分
 */
function getCurrentRestaurantScore(userData, restaurantId, restaurantData) {
  try {
    // 参数验证
    if (!userData || typeof restaurantId !== 'string') {
      console.warn('获取餐厅评分参数无效，使用默认值5');
      return 5;
    }

    // 1. 优先返回用户已评分值
    if (userData.restaurantScores && userData.restaurantScores[restaurantId] !== undefined) {
      return clampScore(userData.restaurantScores[restaurantId]);
    }

    // 2. 根据餐厅类型返回相应的默认高分
    if (isUserAddedRestaurant(restaurantId)) {
      return 9; // 用户手动添加的餐厅
    }

    if (isWelcomeSelection(restaurantId, userData)) {
      return 8; // 用户欢迎页选择的餐厅
    }

    // 3. 对于系统预设餐厅，检查餐厅数据中的初始分
    if (restaurantData && restaurantData.basePreferenceScore !== undefined) {
      return clampScore(restaurantData.basePreferenceScore);
    }

    // 4. 最终兜底
    return 5;
  } catch (error) {
    console.error('获取餐厅当前评分时出错:', error);
    return 5;
  }
}

/**
 * 根据用户操作更新餐厅评分
 * @param {Object} userData - 用户数据对象
 * @param {string} restaurantId - 餐厅ID
 * @param {string} action - 用户操作 ('accept' 或 'reject')
 * @param {Object} restaurantData - 餐厅数据对象
 */
function updateRestaurantScore(userData, restaurantId, action, restaurantData) {
  try {
    // 参数验证
    if (!userData || typeof restaurantId !== 'string' || !action) {
      console.error('更新餐厅评分参数无效');
      return;
    }

    if (action !== 'accept' && action !== 'reject') {
      console.error('无效的操作类型:', action);
      return;
    }

    // 确保 restaurantScores 对象存在
    if (!userData.restaurantScores) {
      userData.restaurantScores = {};
    }

    // 获取当前分数（如果不存在则获取初始分）
    let currentScore;
    if (userData.restaurantScores[restaurantId] !== undefined) {
      currentScore = userData.restaurantScores[restaurantId];
    } else {
      currentScore = getCurrentRestaurantScore(userData, restaurantId, restaurantData);
    }

    // 确定餐厅类型和对应的分数调整值
    let scoreChange = 0;
    
    if (isUserAddedRestaurant(restaurantId)) {
      // 用户手动添加的餐厅
      scoreChange = action === 'accept' ? 1 : -0.5;
    } else if (isWelcomeSelection(restaurantId, userData)) {
      // 用户欢迎页选择的餐厅
      scoreChange = action === 'accept' ? 1.5 : -0.8;
    } else {
      // 系统预设餐厅
      scoreChange = action === 'accept' ? 2 : -1;
    }

    // 计算新分数并限制在范围内
    const newScore = clampScore(currentScore + scoreChange);
    
    // 更新分数
    userData.restaurantScores[restaurantId] = newScore;
    
    // 保存用户数据
    updateUserData('restaurantScores', userData.restaurantScores);
    
    console.log(`餐厅 ${restaurantId} 评分更新: ${currentScore} -> ${newScore} (操作: ${action})`);
  } catch (error) {
    console.error('更新餐厅评分时出错:', error);
  }
}

module.exports = {
  updateRestaurantScore,
  getCurrentRestaurantScore,
  isUserAddedRestaurant,
  isWelcomeSelection,
  clampScore
};