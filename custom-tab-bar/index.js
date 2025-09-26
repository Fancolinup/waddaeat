Component({
  data: {
    selected: 0,
    color: '#7A7E83',
    selectedColor: '#3cc51f',
    list: [
      {
        pagePath: '/pages/index/index',
        iconPath: '/images/icon_home.png',
        selectedIconPath: '/images/icon_home_selected.png',
        text: '今日选择'
      },
      {
        pagePath: '/pages/voice/index',
        iconPath: '/images/icon_voice.png',
        selectedIconPath: '/images/icon_voice_selected.png',
        text: '职场嘴替'
      },
      {
        pagePath: '/pages/profile/profile',
        iconPath: '/images/icon_profile.png',
        selectedIconPath: '/images/icon_profile_selected.png',
        text: '个人'
      }
    ],
    switching: false, // 防止重复点击
    imagesLoaded: false // 图片预加载状态
  },
  
  lifetimes: {
    attached() {
      // 预加载所有图片资源，防止切换时闪烁
      this.preloadImages();
    }
  },
  methods: {
    // 预加载所有tabBar图片资源
    preloadImages() {
      const allImages = [];
      this.data.list.forEach(item => {
        allImages.push(item.iconPath, item.selectedIconPath);
      });
      
      let loadedCount = 0;
      const totalCount = allImages.length;
      
      allImages.forEach(src => {
        // 使用小程序的图片预加载API
        wx.getImageInfo({
          src: src,
          success: () => {
            loadedCount++;
            if (loadedCount === totalCount) {
              this.setData({ imagesLoaded: true });
              console.log('[TabBar] 所有图片预加载完成');
            }
          },
          fail: () => {
            loadedCount++;
            if (loadedCount === totalCount) {
              this.setData({ imagesLoaded: true });
              console.log('[TabBar] 图片预加载完成（部分失败）');
            }
          }
        });
      });
    },
    
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      
      // 防止重复点击和当前页面重复切换
      if (this.data.switching || this.data.selected === index) {
        return;
      }
      
      this.setData({ switching: true });
      
      wx.switchTab({ 
        url: path,
        success: () => {
          // 切换成功后再更新选中状态，避免在切换过程中出现图标来回切换
          this.setData({ selected: index });
          // 延迟重置switching状态，确保页面切换完成
          setTimeout(() => {
            this.setData({ switching: false });
          }, 100);
        },
        fail: () => {
          // 切换失败时恢复状态
          this.setData({ switching: false });
        }
      });
    }
  }
});