// pages/voice/index.js
// 职场嘴替页面
Page({
  data: {
    dialogues: [],
    currentIndex: 0,
    isLoading: true
  },

  onLoad: function (options) {
    this.loadDialogues();
  },

  onShow: function () {
    // 自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  loadDialogues: function () {
    // 加载对话数据
    // 这里将使用现有的 Pilot dialogues.json 数据
    this.setData({
      isLoading: false
    });
  },

  onShareAppMessage: function () {
    return {
      title: '职场嘴替 - Eatigo',
      path: '/pages/voice/index'
    };
  }
});