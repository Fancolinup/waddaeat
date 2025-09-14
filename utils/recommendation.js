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

    // 获取餐厅数据
    const restaurantData = getRestaurantData();
    if (!restaurantData || !Array.isArray(restaurantData)) {
      console.error('餐厅数据无效，无法生成推荐');
      return [];
    }

    // 计算动态权重
    const totalDecisions = userData.decisionHistory ? userData.decisionHistory.length : 0;
    const W1 = Math.max(0.7, 1 - (totalDecisions / 40)); // 特定餐厅评分权重
    const W2 = 1 - W1; // 口味偏好匹配权重

    console.log(`推荐算法权重 - 决策次数: ${totalDecisions}, W1(评分): ${W1.toFixed(2)}, W2(偏好): ${W2.toFixed(2)}`);

    // 为每个餐厅计算推荐分数
    const scoredRestaurants = restaurantData.map(restaurant => {
      try {
        // 1. 获取特定餐厅评分并标准化
        const specificScore = getCurrentRestaurantScore(userData, restaurant.id, restaurant);
        const normalizedSpecificScore = specificScore / 10;

        // 2. 计算口味偏好匹配得分
        const preferenceScore = calculatePreferenceScore(restaurant, userData.tasteProfile || {});

        // 3. 计算最终推荐分数
        const finalScore = (normalizedSpecificScore * W1) + (preferenceScore * W2);

        return {
          ...restaurant,
          recommendationScore: finalScore,
          specificScore: specificScore,
          preferenceScore: preferenceScore,
          normalizedSpecificScore: normalizedSpecificScore
        };
      } catch (error) {
        console.error(`计算餐厅 ${restaurant.id} 推荐分数时出错:`, error);
        return {
          ...restaurant,
          recommendationScore: 0.5, // 默认中等分数
          specificScore: 5,
          preferenceScore: 0.5,
          normalizedSpecificScore: 0.5
        };
      }
    });

    // 按推荐分数降序排列
    scoredRestaurants.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // 返回指定数量的推荐结果
    const recommendations = scoredRestaurants.slice(0, count);
    
    console.log(`生成 ${recommendations.length} 个推荐餐厅`);
    recommendations.forEach((restaurant, index) => {
      console.log(`推荐 ${index + 1}: ${restaurant.name} - 总分: ${restaurant.recommendationScore.toFixed(3)} (评分: ${restaurant.specificScore}, 偏好: ${restaurant.preferenceScore.toFixed(3)})`);
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

    // 计算动态权重
    const totalDecisions = userData.decisionHistory ? userData.decisionHistory.length : 0;
    const W1 = Math.max(0.7, 1 - (totalDecisions / 40));
    const W2 = 1 - W1;

    // 计算各项分数
    const specificScore = getCurrentRestaurantScore(userData, restaurantId, restaurantData);
    const normalizedSpecificScore = specificScore / 10;
    const preferenceScore = calculatePreferenceScore(restaurantData, userData.tasteProfile || {});
    const finalScore = (normalizedSpecificScore * W1) + (preferenceScore * W2);

    return {
      restaurantId,
      totalDecisions,
      weights: { W1, W2 },
      scores: {
        specificScore,
        normalizedSpecificScore,
        preferenceScore,
        finalScore
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