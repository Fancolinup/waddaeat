// pages/loading/loading.js
const { cloudImageManager } = require('../../utils/cloudImageManager');
Page({
  data: {
    loadingText: '加载中，请稍候...',
    progress: 0
  },

  onLoad: function (options) {
    // 在启动加载时预加载底部tab图标
    try {
      cloudImageManager.preloadImages([
        'icon_home',
        'icon_coupon',
        'icon_profile'
      ]);
    } catch (e) {
      console.warn('[Loading] 预加载tab图标失败', e);
    }
    this.startLoading();
  },

  startLoading: function () {
    // 模拟加载进度
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress > 100) progress = 100;
      this.setData({ progress: progress });

      if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => {
          // 加载完成后根据是否已展示欢迎页决定跳转目标（强化判定：无有效选择则仍进入欢迎页）
          const hasShownWelcome = wx.getStorageSync('hasShownWelcome');
          const brandSelections = wx.getStorageSync('welcomeSelectionsByBrand') || [];
          const idSelections = wx.getStorageSync('welcomeSelections') || [];
          const hasEffectiveSelections = (Array.isArray(brandSelections) && brandSelections.length > 0) || (Array.isArray(idSelections) && idSelections.length > 0);
          const jsonFallbackUsed = wx.getStorageSync('JSON_FALLBACK_USED');

          console.debug('[Loading] hasShownWelcome=', hasShownWelcome, 'brandSelections.length=', Array.isArray(brandSelections) ? brandSelections.length : -1, 'idSelections.length=', Array.isArray(idSelections) ? idSelections.length : -1, 'jsonFallbackUsed=', jsonFallbackUsed);

          if (!hasShownWelcome || !hasEffectiveSelections) {
            console.debug('[Loading] 跳转欢迎页：hasShownWelcome=', hasShownWelcome, 'hasEffectiveSelections=', hasEffectiveSelections);
            wx.redirectTo({
              url: '/packageA/pages/welcome/welcome'
            });
          } else {
            console.debug('[Loading] 跳转首页：hasShownWelcome & hasEffectiveSelections 均满足');
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }
        }, 500);
      }
    }, 200);
  }
});