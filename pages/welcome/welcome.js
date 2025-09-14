// pages/welcome/welcome.js
// 欢迎页面
Page({
  data: {
    currentSlide: 0,
    slides: [
      {
        title: '欢迎来到 Eatigo',
        subtitle: '您的智能餐饮助手',
        description: '发现美食，享受生活'
      },
      {
        title: '今日选择',
        subtitle: '个性化推荐',
        description: '根据您的喜好推荐最适合的餐厅'
      },
      {
        title: '职场嘴替',
        subtitle: 'AI智能对话',
        description: '让AI帮您处理各种职场对话场景'
      }
    ]
  },

  onLoad: function (options) {
    // 页面加载完成
  },

  onSlideChange: function (e) {
    this.setData({
      currentSlide: e.detail.current
    });
  },

  goToIndex: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  onShareAppMessage: function () {
    return {
      title: 'Eatigo - 您的智能餐饮助手',
      path: '/pages/welcome/welcome'
    };
  }
});