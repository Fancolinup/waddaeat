// pages/index/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    restaurants: [],
    banners: [
      {
        id: 1,
        image: '/images/banner1.jpg',
        title: '精选餐厅推荐'
      },
      {
        id: 2,
        image: '/images/banner2.jpg',
        title: '限时优惠活动'
      }
    ],
    categories: [
      { id: 1, name: '中餐', icon: '/images/chinese.png' },
      { id: 2, name: '西餐', icon: '/images/western.png' },
      { id: 3, name: '日料', icon: '/images/japanese.png' },
      { id: 4, name: '韩料', icon: '/images/korean.png' },
      { id: 5, name: '火锅', icon: '/images/hotpot.png' },
      { id: 6, name: '烧烤', icon: '/images/bbq.png' }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadRestaurants()
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    // 页面初次渲染完成
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时刷新数据
    this.loadRestaurants()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 页面隐藏
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 页面卸载
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadRestaurants()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 加载更多数据
    this.loadMoreRestaurants()
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: 'Eatigo - 发现美食，享受优惠',
      path: '/pages/index/index'
    }
  },

  /**
   * 获取用户信息
   */
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
        // 保存用户信息到全局数据
        const app = getApp()
        app.globalData.userInfo = res.userInfo
      }
    })
  },

  /**
   * 加载餐厅数据
   */
  loadRestaurants() {
    wx.showLoading({
      title: '加载中...'
    })
    
    // 从数据管理器获取餐厅数据
    const dataManager = require('../../utils/dataManager.js');
    const restaurantData = dataManager.getRestaurantData();
    
    // 转换数据格式
    const restaurants = restaurantData.restaurants.slice(0, 10).map(item => {
      return {
        id: item.id,
        name: item.name,
        image: `/packageRestaurant/images/restaurantpic/${item.id}.png`,
        rating: ((item.popularityScore || 0) * 5).toFixed(1),
        category: item.type,
        discount: item.dynamicPromotions && item.dynamicPromotions.length > 0 ? 
                 item.dynamicPromotions[0].promoText : '无优惠',
        distance: '附近'
      };
    });
    
    this.setData({
      restaurants: restaurants
    });
    
    wx.hideLoading();
  },
  
  /**
   * 餐厅点击事件
   */
  onRestaurantTap(e) {
    const restaurant = e.currentTarget.dataset.restaurant;
    wx.navigateTo({
      url: `/packageRestaurant/pages/detail/detail?id=${restaurant.id}`
    });
  },
  
  /**
   * 加载更多餐厅数据
   */
  loadMoreRestaurants() {
    // 已加载的餐厅数量
    const currentCount = this.data.restaurants.length;
    
    // 从数据管理器获取更多餐厅数据
    const dataManager = require('../../utils/dataManager.js');
    const restaurantData = dataManager.getRestaurantData();
    
    // 每次加载10个餐厅
    const moreRestaurants = restaurantData.restaurants.slice(currentCount, currentCount + 10).map(item => {
      return {
        id: item.id,
        name: item.name,
        image: `/packageRestaurant/images/restaurantpic/${item.id}.png`,
        rating: ((item.popularityScore || 0) * 5).toFixed(1),
        category: item.type,
        discount: item.dynamicPromotions && item.dynamicPromotions.length > 0 ? 
                 item.dynamicPromotions[0].promoText : '无优惠',
        distance: '附近'
      };
    });
    
    // 如果没有更多数据
    if (moreRestaurants.length === 0) {
      wx.showToast({
        title: '没有更多餐厅了',
        icon: 'none'
      });
      return;
    }
    
    // 合并数据
    this.setData({
      restaurants: [...this.data.restaurants, ...moreRestaurants]
    });
  },

  /**
   * 轮播图点击事件
   */
  onBannerTap(e) {
    const { id } = e.currentTarget.dataset
    console.log('点击轮播图:', id)
  },

  /**
   * 分类点击事件
   */
  onCategoryTap(e) {
    const { category } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/restaurant/restaurant?category=${category.name}`
    })
  },

  /**
   * 餐厅卡片点击事件
   */
  onRestaurantTap(e) {
    const { restaurant } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/restaurant/detail?id=${restaurant.id}`
    })
  },

  /**
   * 搜索框点击事件
   */
  onSearchTap() {
    wx.navigateTo({
      url: '/pages/search/search'
    })
  }
})