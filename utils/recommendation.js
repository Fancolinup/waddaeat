/**
 * 推荐算法模块
 * 实现混合推荐模型，结合特定餐厅评分和口味偏好匹配
 * @author AI Assistant
 * @date 2025-01-14
 */

const { getCurrentRestaurantScore } = require('./scoringManager');
const { calculatePreferenceScore } = require('./preferenceLearner');
const { getRestaurantData } = require('./dataManager');

/**
 * 生成个性化餐厅推荐
 * @param {Object} userData - 用户数据对象
 * @param {number} count - 需要推荐的餐厅数量，默认为5
 * @returns {Array} 推荐餐厅列表，按推荐分数降序排列
 */
function generateRecommendations(userData, count = 5) {
  try {
    // 参数验证
    if (!userData) {
      console.error('用户数据为空，无法生成推荐');
      return [];
    }

    // 获取餐厅数据（注意：getRestaurantData 返回的是对象，包含 restaurants 数组）
    const data = getRestaurantData();
    const restaurants = data && Array.isArray(data.restaurants)
      ? data.restaurants
      : (Array.isArray(data) ? data : []);

    if (!restaurants.length) {
      console.error('餐厅数据无效，无法生成推荐');
      return [];
    }

    // 计算动态权重（W1 从 0.7 线性衰减到 0.3，约在 40 次决策达到下限）
    const totalDecisions = userData.decisionHistory ? userData.decisionHistory.length : 0;
    const W1 = Math.max(0.3, 0.7 - (totalDecisions / 40) * 0.4); // 特定餐厅评分权重（0-10量纲）
    const W2 = 1 - W1; // 口味偏好匹配权重（0-10量纲）

    console.log(`推荐算法权重 - 决策次数: ${totalDecisions}, W1(评分): ${W1.toFixed(2)}, W2(偏好): ${W2.toFixed(2)}`);

    // 为每个餐厅计算推荐分数（统一为 0-10 量纲直接加权）
    const scoredRestaurants = restaurants.map(restaurant => {
      try {
        const specificScore = getCurrentRestaurantScore(userData, restaurant.id, restaurant); // 0-10
        const preferenceScore = calculatePreferenceScore(restaurant, userData.tasteProfile || {}); // 0-10

        const finalScore = (specificScore * W1) + (preferenceScore * W2); // 0-10

        // 调试字段（归一化到 0-1，仅用于日志/排查）
        const normalizedSpecificScore = specificScore / 10;
        const normalizedPreferenceScore = preferenceScore / 10;
        const normalizedFinalScore = finalScore / 10;

        return {
          ...restaurant,
          recommendationScore: finalScore,
          specificScore,
          preferenceScore,
          normalizedSpecificScore,
          normalizedPreferenceScore,
          normalizedFinalScore
        };
      } catch (error) {
        console.error(`计算餐厅 ${restaurant.id} 推荐分数时出错:`, error);
        return {
          ...restaurant,
          recommendationScore: 5, // 默认中等分数（0-10 量纲）
          specificScore: 5,
          preferenceScore: 5,
          normalizedSpecificScore: 0.5,
          normalizedPreferenceScore: 0.5,
          normalizedFinalScore: 0.5
        };
      }
    });

    // 按推荐分数降序排列
    scoredRestaurants.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // 返回指定数量的推荐结果
    const recommendations = scoredRestaurants.slice(0, count);
    
    console.log(`生成 ${recommendations.length} 个推荐餐厅`);
    recommendations.forEach((restaurant, index) => {
      console.log(`推荐 ${index + 1}: ${restaurant.name} - 总分: ${restaurant.recommendationScore.toFixed(2)} (评分: ${restaurant.specificScore.toFixed(2)}, 偏好: ${restaurant.preferenceScore.toFixed(2)})`);
    });

    return recommendations;
  } catch (error) {
    console.error('生成推荐时出错:', error);
    return [];
  }
}

/**
 * 获取餐厅推荐分数详情
 * @param {Object} userData - 用户数据对象
 * @param {string} restaurantId - 餐厅ID
 * @param {Object} restaurantData - 餐厅数据对象
 * @returns {Object} 包含各项分数的详情对象
 */
function getRecommendationDetails(userData, restaurantId, restaurantData) {
  try {
    if (!userData || !restaurantId || !restaurantData) {
      console.error('获取推荐详情参数无效');
      return null;
    }

    // 计算动态权重（保持与 generateRecommendations 一致）
    const totalDecisions = userData.decisionHistory ? userData.decisionHistory.length : 0;
    const W1 = Math.max(0.3, 0.7 - (totalDecisions / 40) * 0.4);
    const W2 = 1 - W1;

    // 计算各项分数（均为 0-10 量纲）
    const specificScore = getCurrentRestaurantScore(userData, restaurantId, restaurantData);
    const preferenceScore = calculatePreferenceScore(restaurantData, userData.tasteProfile || {});
    const finalScore = (specificScore * W1) + (preferenceScore * W2);

    // 调试归一化字段（0-1）
    const normalizedSpecificScore = specificScore / 10;
    const normalizedPreferenceScore = preferenceScore / 10;
    const normalizedFinalScore = finalScore / 10;

    return {
      restaurantId,
      totalDecisions,
      weights: { W1, W2 },
      scores: {
        specificScore,
        normalizedSpecificScore,
        preferenceScore,
        normalizedPreferenceScore,
        finalScore,
        normalizedFinalScore
      }
    };
  } catch (error) {
    console.error('获取推荐详情时出错:', error);
    return null;
  }
}

module.exports = {
  generateRecommendations,
  getRecommendationDetails
};