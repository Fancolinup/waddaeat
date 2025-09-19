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
    switching: false // 防止重复点击
  },
  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      
      // 防止重复点击和当前页面重复切换
      if (this.data.switching || this.data.selected === index) {
        return;
      }
      
      this.setData({ switching: true });
      
      // 立即设置选中状态
      this.setData({ selected: index });
      
      wx.switchTab({ 
        url: path,
        success: () => {
          // 延迟重置switching状态，确保页面切换完成
          setTimeout(() => {
            this.setData({ switching: false });
          }, 300);
        },
        fail: () => {
          // 切换失败时恢复状态
          this.setData({ switching: false });
        }
      });
    }
  }
});