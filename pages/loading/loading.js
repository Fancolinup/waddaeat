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
    // 预加载欢迎页和其他页面的图片资源
    this.preloadImages();
    
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
  },

  // 预加载图片资源
  preloadImages: function () {
    // 更新加载文本提示
    this.setData({
      loadingText: '正在加载资源...'
    });
    
    // 微信小程序会自动缓存图片资源，无需手动预加载
    console.log('图片资源将在使用时自动加载');
  }
});