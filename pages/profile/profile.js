// pages/profile/profile.js
const { getUserData, getAppContent, addPoints, recalculateUserLevel } = require('../../utils/dataManager');

Page({
  data: {
    points: 0,
    level: '',
    decisionsCount: 0,
    favoritesCount: 0,
    // 供标签渲染使用
    topTastes: [],
    topRestaurants: [],
    showFavorites: false,
    favoritesList: [],
    testProducts: [
      { id: 't1', name: '麦当劳 · 双层吉士汉堡', price: 29, coupon: '减3元', image: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
      { id: 't2', name: '星巴克 · 拿铁(中杯)', price: 32, coupon: '减5元', image: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
      { id: 't3', name: '喜茶 · 芝芝葡萄', price: 21, coupon: '满20减2', image: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
      { id: 't4', name: '海底捞 · 自热火锅', price: 39, coupon: '', image: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
    ]
  },

  onShow() {
    // 保持自定义tabbar选中态
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }

    // 确保用户数据已初始化
    try {
      const { initUserData } = require('../../utils/dataManager');
      initUserData();
      console.debug('[Profile] 用户数据初始化完成');
    } catch (e) {
      console.warn('[Profile] 用户数据初始化失败:', e);
    }

    this.refreshStats();
  },

  onPullDownRefresh() {
    this.refreshStats(() => wx.stopPullDownRefresh());
  },

  refreshStats(cb) {
    try {
      console.debug('[Profile] 开始刷新统计数据');
      const userData = getUserData();
      console.debug('[Profile] 获取到用户数据:', {
        points: userData.points,
        userLevel: userData.userLevel,
        hasPointsDedup: !!userData.pointsDedup
      });
      
      // 积分与等级
      const points = userData.points || 0;
      console.debug('[Profile] 处理积分:', points);
      
      // 基于最新配置实时计算等级名称（避免老版本缓存）
      const level = recalculateUserLevel ? recalculateUserLevel(points) : (userData.userLevel || 'P5-应届牛马');
      console.debug('[Profile] 计算等级:', level);

      // 已决策数量（包含欢迎页 accept）
      const history = Array.isArray(userData.decisionHistory) ? userData.decisionHistory : [];
      const accepts = history.filter(d => d && d.action === 'accept');
      const decisions = accepts.length;

      // Top3 口味
      const tasteProfile = userData.tasteProfile || {};
      const nameMap = { spicy: '辣', sweet: '甜', sour: '酸', salty: '咸', bitter: '苦', umami: '鲜', oily: '油', light: '清淡' };
      const topTastes = Object.keys(tasteProfile)
        .map(k => ({ key: k, v: Number(tasteProfile[k]) || 0 }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 3)
        .map(it => nameMap[it.key] || it.key);

      // Top3 选择餐厅（兼容多来源字段）
      const counts = {};
      const getNameById = (rid) => {
        try {
          const dataset = require('../../restaurant_data.js');
          const arr = Array.isArray(dataset) ? dataset : (dataset.restaurants || dataset.list || []);
          const found = (arr || []).find(r => String(r.id) === String(rid) || String(r.sid) === String(rid));
          return found ? (found.name || found.title || ('餐厅#' + rid)) : ('餐厅#' + rid);
        } catch (e) {
          return '餐厅#' + rid;
        }
      };

      accepts.forEach(rec => {
        let key = '';
        if (rec.name) key = rec.name;
        else if (rec.brand) key = rec.brand;
        else if (rec.restaurantName) key = rec.restaurantName;
        else if (rec.id != null) key = getNameById(rec.id);
        else if (rec.restaurantId != null) key = getNameById(rec.restaurantId);
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      const topRestaurants = Object.keys(counts)
        .map(k => ({ k, c: counts[k] }))
        .sort((a, b) => b.c - a.c)
        .slice(0, 3)
        .map(it => it.k);

      // 收藏统计：语录+投票
      const fav = userData.contentInteractions?.favorites || { quotes: [], votes: [] };
      const favoritesCount = (fav.quotes?.length || 0) + (fav.votes?.length || 0);

      console.debug('[Profile] 准备setData:', { points, level, decisionsCount: decisions, favoritesCount });
      this.setData({ points, level, decisionsCount: decisions, favoritesCount, topTastes, topRestaurants });
      console.debug('[Profile] setData完成');
    } catch (e) {
      console.warn('[Profile] 刷新统计失败:', e);
    } finally {
      cb && cb();
    }
  },

  // 入口点击：我的选择
  goMySelections() {
    try {
      // 立即跳转，避免复杂统计或异步阻塞
      wx.navigateTo({ url: '/pages/profile/selections/index' });
    } catch (e) {
      // 保底：若页面尚未注册
      try { wx.navigateTo({ url: '/pages/profile/selections/index' }); } catch(err) {
        wx.showToast({ title: '页面暂不可用', icon: 'none' });
      }
    }
  },

  // 收藏浮层 -> 改为跳转二级页面
  openFavorites() {
    try {
      wx.navigateTo({ url: '/pages/profile/favorites/index' });
    } catch (e) {
      wx.showToast({ title: '页面暂不可用', icon: 'none' });
    }
  },
  closeFavorites() { this.setData({ showFavorites: false }); },
  noop() {},

  // 分享
  onShareAppMessage() {
    const promise = new Promise(resolve => {
      try { addPoints('share', 'profile_share'); this.refreshStats(); } catch (e) {}
      
      // 个人页面分享时，先跳转到今日选择页，然后截取转盘
      wx.switchTab({
        url: '/pages/index/index',
        success: () => {
          // 延迟一下确保页面加载完成
          setTimeout(() => {
            const pages = getCurrentPages();
            const indexPage = pages.find(page => page.route === 'pages/index/index');
            
            if (indexPage && indexPage.captureRouletteArea) {
              indexPage.captureRouletteArea().then(imagePath => {
                resolve({ 
                  title: '让它来决定吧！',
                  imageUrl: imagePath 
                });
              }).catch(() => {
                resolve({ title: '让它来决定吧！' });
              });
            } else {
              resolve({ title: '让它来决定吧！' });
            }
          }, 500);
        },
        fail: () => {
          // 跳转失败时仅返回文案
          resolve({ title: '让它来决定吧！' });
        }
      });
    });
    
    return {
      title: '让它来决定吧！',
      path: '/pages/index/index',
      promise
    };
  },

  onShareTimeline() {
    return { title: '我的个人中心' };
  }
});