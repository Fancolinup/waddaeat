// pages/welcome/welcome.js
// 新用户欢迎页面 - 品牌选择
Page({
  data: {
    restaurants: [], // 餐厅数据
    selectedRestaurants: [], // 用户选择的餐厅ID数组
    pinyinMap: {}, // 拼音映射表
    isLoading: true,
    scrollLeft: 0
  },

  onLoad: function (options) {
    // 检查是否为新用户
    const hasShownWelcome = wx.getStorageSync('hasShownWelcome');
    if (hasShownWelcome) {
      // 已经显示过欢迎页，直接跳转到主页
      wx.reLaunch({
        url: '/pages/index/index'
      });
      return;
    }
    
    // 彻底重置selectedRestaurants为空数组
    this.data.selectedRestaurants = [];
    this.setData({
      selectedRestaurants: []
    });
    
    console.log('页面加载时selectedRestaurants:', this.data.selectedRestaurants);
    
    this.loadRestaurantData();
  },

  // 加载餐厅数据
  loadRestaurantData: function () {
    try {
      // 使用文件系统API读取本地JSON文件
      const fs = wx.getFileSystemManager();
      const restaurantDataPath = `${wx.env.USER_DATA_PATH}/restaurant_data.json`;
      
      // 先尝试从本地读取，如果失败则使用默认数据
      this.loadDefaultRestaurantData();
    } catch (error) {
      console.error('加载餐厅数据失败:', error);
      this.loadDefaultRestaurantData();
    }
  },

  // 加载默认餐厅数据
  loadDefaultRestaurantData: function () {
    // 先加载拼音映射表
    this.loadPinyinMap();
    
    // 使用内置的默认餐厅数据
    const defaultRestaurants = [
      { id: 1, name: "Baker&Spice", category: "咖啡厅", rating: 4.5 },
      { id: 2, name: "超级碗", category: "快餐", rating: 4.2 },
      { id: 3, name: "陈香贵", category: "面食", rating: 4.3 },
      { id: 4, name: "汉堡王", category: "快餐", rating: 4.1 },
      { id: 5, name: "肯德基", category: "快餐", rating: 4.0 },
      { id: 6, name: "蓝蛙", category: "西餐", rating: 4.4 },
      { id: 7, name: "麦当劳", category: "快餐", rating: 4.0 },
      { id: 8, name: "马记永", category: "兰州拉面", rating: 4.2 },
      { id: 9, name: "莆田餐厅", category: "闽菜", rating: 4.6 },
      { id: 10, name: "蜀大侠", category: "火锅", rating: 4.5 },
      { id: 11, name: "我格司", category: "汉堡", rating: 4.3 },
      { id: 12, name: "西贝莜面村", category: "西北菜", rating: 4.4 },
      { id: 13, name: "海底捞", category: "火锅", rating: 4.6 },
      { id: 14, name: "鼎泰丰", category: "小笼包", rating: 4.7 },
      { id: 15, name: "呷哺呷哺", category: "火锅", rating: 4.2 },
      { id: 16, name: "星巴克", category: "咖啡", rating: 4.3 },
      { id: 17, name: "喜茶", category: "茶饮", rating: 4.4 },
      { id: 18, name: "南京大牌档", category: "江苏菜", rating: 4.5 },
      { id: 19, name: "鹿港小镇", category: "台湾菜", rating: 4.3 },
      { id: 20, name: "唐宫", category: "粤菜", rating: 4.4 },
      { id: 21, name: "外婆家", category: "杭帮菜", rating: 4.2 },
      { id: 22, name: "更多餐厅", category: "其他", rating: 0 }
    ];
    
    // 为每个餐厅添加logoPath属性
    const restaurantsWithLogo = defaultRestaurants.map(restaurant => ({
      ...restaurant,
      logoPath: this.getRestaurantLogo(restaurant.name)
    }));
    
    this.setData({
      restaurants: restaurantsWithLogo,
      isLoading: false
    });
    
    // 调试信息
    console.log('餐厅数据加载完成，selectedRestaurants:', this.data.selectedRestaurants);
    console.log('餐厅总数:', restaurantsWithLogo.length);
    
    // 强制检查每个餐厅的选中状态
    restaurantsWithLogo.forEach(restaurant => {
      const isSelected = this.data.selectedRestaurants.indexOf(restaurant.id) !== -1;
      console.log(`餐厅 ${restaurant.name} (ID: ${restaurant.id}) 选中状态:`, isSelected);
    });
  },

  // 加载拼音映射表
  loadPinyinMap: function () {
    // 使用内置的拼音映射数据
    const defaultPinyinMap = {
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
      "更多餐厅": "placeholder"
    };
    
    this.setData({
      pinyinMap: defaultPinyinMap
    });
  },

  // 获取餐厅logo路径
  getRestaurantLogo: function (restaurantName) {
    const pinyin = this.data.pinyinMap[restaurantName];
    if (pinyin) {
      if (pinyin === 'placeholder') {
          return '../../images/restaurants/placeholder.png';
        }
        return `../../images/restaurants/${pinyin}.png`;
    }
    // 为手动添加的餐厅返回占位图
    return '../../images/restaurants/placeholder.png';
  },

  // 餐厅选择切换
  onRestaurantTap: function (e) {
    const restaurantId = parseInt(e.currentTarget.dataset.id); // 转换为数字类型
    let selectedRestaurants = [...this.data.selectedRestaurants];
    
    const index = selectedRestaurants.indexOf(restaurantId);
    if (index > -1) {
      // 取消选择
      selectedRestaurants.splice(index, 1);
    } else {
      // 添加选择
      selectedRestaurants.push(restaurantId);
    }
    
    this.setData({
      selectedRestaurants: selectedRestaurants
    });
    
    // 添加调试日志
    console.log('点击餐厅ID:', restaurantId, '类型:', typeof restaurantId);
    console.log('当前选中:', selectedRestaurants);
    console.log('餐厅数据:', this.data.restaurants.find(r => r.id === restaurantId));
    
    // 强制触发页面重新渲染
    this.setData({
      selectedRestaurants: selectedRestaurants,
      _forceUpdate: Date.now()
    });
  },

  // 检查餐厅是否被选中
  isRestaurantSelected: function (restaurantId) {
    return this.data.selectedRestaurants.includes(restaurantId);
  },

  // 添加自定义餐厅
  onAddCustomRestaurant: function () {
    // 显示带动画效果的输入弹窗
    wx.showModal({
      title: '添加餐厅',
      content: '',
      editable: true,
      showCancel: true,
      cancelText: '取消',
      confirmText: '添加',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const restaurantName = res.content.trim();
          // 添加淡入动画效果
          wx.showLoading({
            title: '添加中...',
            mask: true
          });
          
          setTimeout(() => {
            wx.hideLoading();
            this.addCustomRestaurant(restaurantName);
          }, 500);
        }
      }
    });
  },

  // 添加自定义餐厅到用户数据
  addCustomRestaurant: function (restaurantName) {
    try {
      const userData = wx.getStorageSync('userData') || {
        customRestaurants: [],
        welcomeSelections: [],
        restaurantScores: {}
      };
      
      // 检查是否已存在
      if (!userData.customRestaurants.includes(restaurantName)) {
        userData.customRestaurants.push(restaurantName);
        
        // 为自定义餐厅设置高分
        userData.restaurantScores[restaurantName] = 8;
        
        // 创建新餐厅对象
        const newRestaurant = {
          id: Date.now(), // 使用时间戳作为临时ID
          name: restaurantName,
          category: "自定义",
          isNew: true, // 标记为新餐厅
          logoPath: this.getRestaurantLogo(restaurantName)
        };
        
        // 将新餐厅添加到预设餐厅列表的末尾（"更多餐厅"之前）
        const restaurants = [...this.data.restaurants];
        const moreIndex = restaurants.findIndex(r => r.name === "更多餐厅");
        if (moreIndex > -1) {
          restaurants.splice(moreIndex, 0, newRestaurant);
        } else {
          restaurants.push(newRestaurant);
        }
        
        this.setData({
          restaurants: restaurants
        });
        
        wx.setStorageSync('userData', userData);
        
        // 添加调试日志
        console.log('新餐厅已添加到列表:', newRestaurant);
        console.log('当前restaurants数组长度:', this.data.restaurants.length);
        
        wx.showToast({
          title: '已添加到列表末尾',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '餐厅已存在',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('添加自定义餐厅失败:', error);
      wx.showToast({
        title: '添加失败',
        icon: 'error'
      });
    }
  },



  // 完成选择并跳转
  onCompleteSelection: function () {
    this.saveSelections();
  },

  /**
   * 保存用户选择并跳转
   */
  saveSelections: function () {
    if (this.data.selectedRestaurants.length === 0) {
      wx.showToast({
        title: '请至少选择一个餐厅',
        icon: 'none'
      });
      return;
    }

    try {
      const { updateUserData, getUserData } = require('../../utils/dataManager');
      const { updateRestaurantScore } = require('../../utils/scoringManager');
      
      // 获取当前用户数据
      const userData = getUserData();
      
      // 确保welcomeSelections字段存在
      if (!userData.welcomeSelections) {
        userData.welcomeSelections = [];
      }
      
      // 保存选择到用户数据
      updateUserData('welcomeSelections', this.data.selectedRestaurants);

      // 更新餐厅评分 - 为每个选中的餐厅调用评分更新
      this.data.selectedRestaurants.forEach(restaurantId => {
        const restaurant = this.data.restaurants.find(r => r.id === restaurantId);
        if (restaurant) {
          // 调用updateRestaurantScore函数，传入正确的参数
          updateRestaurantScore(userData, restaurantId, 'accept', restaurant);
        }
      });

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // 标记已显示过欢迎页
      wx.setStorageSync('hasShownWelcome', true);
      
      // 跳转到主页面
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1500);
    } catch (error) {
      console.error('保存选择失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  }
});