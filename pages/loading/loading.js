// pages/loading/loading.js
// 小程序启动加载页面
Page({
  data: {
    loadingText: '正在加载...',
    progress: 0
  },

  onLoad: function (options) {
    this.startLoading();
  },

  startLoading: function () {
    let progress = 0;
    const timer = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(timer);
        this.setData({
          progress: progress,
          loadingText: '加载完成'
        });
        // 延迟跳转到欢迎页
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/welcome/welcome'
          });
        }, 500);
      } else {
        this.setData({
          progress: progress
        });
      }
    }, 100);
  }
});