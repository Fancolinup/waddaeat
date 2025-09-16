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
   * 获取品牌拼音映射（与欢迎页保持一致）
   */
  getPinyinMap() {
    return {
      "Baker&Spice": "Baker&Spice",
      "超级碗": "chaojiwan",
      "陈香贵": "chenxianggui",
      "汉堡王": "hanbaowang",
      "肯德基": "kendeji",
      "蓝蛙": "lanwa",
      "麦当劳": "maidanglao",
      "马记永": "majiyong",
      "莆田餐厅": "putiancanting",
      "蜀大侠": "shudaxia",
      "我格司": "wogesi",
      "西贝莜面村": "xibeiyoumiancun",
      "海底捞": "haidilao",
      "鼎泰丰": "dingtaifeng",
      "呷哺呷哺": "xiabuxiabu",
      "星巴克": "xingbake",
      "喜茶": "xicha",
      "南京大牌档": "nanjingdapaidang",
      "鹿港小镇": "lugangxiaozhen",
      "唐宫": "tanggong",
      "外婆家": "waipojia",
      "乐乐茶": "lelecha",
      "良品铺子": "liangpinpuzi",
      "喜家德": "xijiade",
      "三米粥铺": "sanmizhoupu",
      "南翔馒头店": "nanxiangmantoudian",
      "那家小馆": "najiaxiaoguan",
      "新元素": "xinyuansu",
      "奈雪的茶": "naixuedecha",
      "永和大王": "yonghedawang",
      "小杨生煎": "xiaoyangshengjian",
      "云海肴": "yunhaiyao",
      "西树泡芙": "xishupaofu",
      "喜茶 GO": "xichago",
      "一点点": "yidiandian",
      "新白鹿": "xinbailu",
      "小南国": "xiaonanguo",
      "小龙坎": "xiaolongkan",
      "谭鸭血": "tanyaxie",
      "更多餐厅": "placeholder"
    };
  },

  // 获取分包A小图标文件名列表（拼音，不含后缀）
  getPackageAIcons() {
    return [
      'bifengtang','diandude','dingtaifeng','duxiaoyue','haidilao','hefulaomian','jiangbianchengwai','jiyejia','lugangxiaozhen','lvchacanting','naixuedecha','nanjingdapaidang','nanxiangmantoudian','shiqijia','shudufeng','songwu','taiersuancaiyu','tanggong','waipojia','wangxiangyuan','weiqianlamian','xiabuxiabu','xiaoyangshengjian','xibeiyoumiancun','xicha','xingbake','xinyuansu','yelixiali','yifengtang','yunhaiyao'
    ];
  },

  // 获取分包B小图标文件名列表（拼音，不含后缀）
  getPackageBIcons() {
    return [
      'axiangmixian','bangyuehan','banumaoduhuoguo','bishengke','cailangangshidianxin','cocodouke','coucouhuoguo','dalongyi','dameile','damixiansheng','daniangshuijiao','diantaixianghuoguo','fengmaokaochuan','gelaoguan','guimanlong','guoqiaomixian','gutiandaoxiang','henjiuyiqianyangrouchuan','hudafandian','jixianghuntun','laoshengchang','lelecha','malayouhuo','muwushaokao','qifentian','saliya','suxiaoliu','tangxiansheng','tanyaxie','tianhaoyun','wanguizhimian','xiaolongkan','xiaonanguo','xinbailu','xinxianghui','yidiandian','yonghedawang','zhenggongfu','zuotingyouyuan'
    ];
  },

  /**
   * 根据品牌名构建分包图标路径，统一使用高清图
   */
  getRestaurantIconPath(name) {
    const pinyin = this.getPinyinMap()[name];
    if (!pinyin || pinyin === 'placeholder') {
      return '/packageA/images/FullRest/placeholder.png';
    }
    
    // 检查分包A是否有高清图
    const aFullIcons = this.getPackageAFullIcons();
    if (aFullIcons.includes(pinyin)) {
      return `/packageA/images/FullRest/${pinyin}.png`;
    }
    
    // 检查分包B是否有高清图
    const bFullIcons = this.getPackageBFullIcons();
    if (bFullIcons.includes(pinyin)) {
      return `/packageB/images/FullRest/${pinyin}.png`;
    }
    
    return '/packageA/images/FullRest/placeholder.png';
  },

  // 获取分包A高清图标文件名列表（拼音，不含后缀）
  getPackageAFullIcons() {
    return [
      'Baker&Spice','bifengtang','diandude','dingtaifeng','duxiaoyue','haidilao','hefulaomian','jiangbianchengwai','jiyejia','lugangxiaozhen','lvchacanting','naixuedecha','nanjingdapaidang','nanxiangmantoudian','shiqijia','shudufeng','songwu','taiersuancaiyu','tanggong','waipojia','wangxiangyuan','weiqianlamian','xiabuxiabu','xiaoyangshengjian','xibeiyoumiancun','xicha','xingbake','xinyuansu','yelixiali','yifengtang','yunhaiyao','chaojiwan','chenxianggui','hanbaowang','kendeji','lanwa','maidanglao','majiyong','putiancanting','shudaxia','wogesi','tanyaxie','placeholder'
    ];
  },

  // 获取分包B高清图标文件名列表（拼音，不含后缀） 
  getPackageBFullIcons() {
    return [
      'axiangmixian','bangyuehan','banumaoduhuoguo','bishengke','cailangangshidianxin','cocodouke','coucouhuoguo','dalongyi','dameile','damixiansheng','daniangshuijiao','diantaixianghuoguo','fengmaokaochuan','gelaoguan','guimanlong','guoqiaomixian','gutiandaoxiang','henjiuyiqianyangrouchuan','hudafandian','jixianghuntun','laoshengchang','lelecha','malayouhuo','muwushaokao','qifentian','saliya','suxiaoliu','tangxiansheng','tianhaoyun','wanguizhimian','xiaolongkan','xiaonanguo','xinbailu','xinxianghui','yidiandian','yonghedawang','zhenggongfu','zuotingyouyuan'
    ];
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
        image: this.getRestaurantIconPath(item.name),
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
        image: this.getRestaurantIconPath(item.name),
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
        image: this.getRestaurantIconPath(item.name),
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