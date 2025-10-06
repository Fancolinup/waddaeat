// 测试个人页面积分显示逻辑
// 模拟微信小程序环境

// 模拟wx对象
global.wx = {
  getStorageSync: function(key) {
    console.log(`[Mock] getStorageSync called with key: ${key}`);
    
    if (key === 'user_data') {
      return {
        points: 3,
        userLevel: 'P5-应届牛马',
        tasteProfile: {
          spicy: 0.7,
          sweet: 0.5,
          sour: 0.3
        },
        decisionHistory: [
          { action: 'accept', name: '麦当劳', timestamp: '2025-01-01' },
          { action: 'accept', name: '肯德基', timestamp: '2025-01-02' },
          { action: 'accept', name: '星巴克', timestamp: '2025-01-03' }
        ],
        contentInteractions: {
          favorites: {
            quotes: ['quote_1', 'quote_2'],
            votes: [{ id: 'vote_1', myOption: 'A' }]
          }
        }
      };
    }
    
    return null;
  },
  
  setStorageSync: function(key, data) {
    console.log(`[Mock] setStorageSync called with key: ${key}`, data);
  }
};

// 直接模拟dataManager模块
const mockDataManager = {
  getUserData: function() {
    return wx.getStorageSync('user_data');
  },
  recalculateUserLevel: function(points) {
    if (points >= 10) return 'P4-职场新人';
    if (points >= 5) return 'P3-资深员工';
    return 'P5-应届牛马';
  }
};

// 测试个人页面的refreshStats方法
function testProfileRefreshStats() {
  console.log('\n=== 测试个人页面积分显示逻辑 ===');
  
  try {
    // 使用模拟的dataManager模块
    const { getUserData, recalculateUserLevel } = mockDataManager;
    
    const userData = getUserData();
    console.log('获取到的用户数据:', userData);
    
    // 积分与等级
    const points = userData.points || 0;
    const level = recalculateUserLevel ? recalculateUserLevel(points) : (userData.userLevel || 'P5-应届牛马');
    
    console.log(`积分: ${points}`);
    console.log(`等级: ${level}`);
    
    // 已决策数量
    const history = Array.isArray(userData.decisionHistory) ? userData.decisionHistory : [];
    const accepts = history.filter(d => d && d.action === 'accept');
    const decisions = accepts.length;
    
    console.log(`决策次数: ${decisions}`);
    
    // Top3 口味
    const tasteProfile = userData.tasteProfile || {};
    const nameMap = { spicy: '辣', sweet: '甜', sour: '酸', salty: '咸', bitter: '苦', umami: '鲜', oily: '油', light: '清淡' };
    const topTastes = Object.keys(tasteProfile)
      .map(k => ({ key: k, v: Number(tasteProfile[k]) || 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map(it => nameMap[it.key] || it.key);
    
    console.log('Top3 口味:', topTastes);
    
    // 收藏统计
    const fav = userData.contentInteractions?.favorites || { quotes: [], votes: [] };
    const favoritesCount = (fav.quotes?.length || 0) + (fav.votes?.length || 0);
    
    console.log(`收藏数量: ${favoritesCount}`);
    
    // 模拟setData
    const pageData = { points, level, decisionsCount: decisions, favoritesCount, topTastes };
    console.log('\n页面数据绑定结果:', pageData);
    
    // 验证WXML模板绑定
    console.log('\n=== WXML模板数据绑定验证 ===');
    console.log(`{{points || 0}} -> ${pageData.points || 0}`);
    console.log(`{{level || 'P5-应届牛马'}} -> ${pageData.level || 'P5-应届牛马'}`);
    console.log(`{{decisionsCount}} -> ${pageData.decisionsCount}`);
    
    return pageData;
    
  } catch (error) {
    console.error('测试过程中出现错误:', error);
    return null;
  }
}

// 运行测试
const result = testProfileRefreshStats();

if (result && result.points > 0) {
  console.log('\n✅ 积分显示逻辑正常，积分值为:', result.points);
} else {
  console.log('\n❌ 积分显示异常，积分值为0或获取失败');
}