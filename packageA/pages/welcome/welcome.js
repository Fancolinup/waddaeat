// pages/welcome/welcome.js
// 新用户欢迎页面 - 品牌选择
const { cloudImageManager } = require('../../../utils/cloudImageManager');

Page({
  data: {
    restaurants: [], // 餐厅数据
    selectedRestaurants: [], // 用户选择的餐厅ID数组（统一使用字符串ID sid）
    pinyinMap: {}, // 拼音映射表
    isLoading: true,
    scrollLeft: 0
  },

  onLoad: function (options) {
    // 检查是否为新用户（强化：仅当已展示且存在有效选择时才跳过欢迎页）
    let hasShownWelcome = false;
    let brandSelections = [];
    let idSelections = [];
    let hasEffectiveSelections = false;
    try {
      hasShownWelcome = wx.getStorageSync('hasShownWelcome');
      brandSelections = wx.getStorageSync('welcomeSelectionsByBrand') || [];
      idSelections = wx.getStorageSync('welcomeSelections') || [];
      hasEffectiveSelections = (Array.isArray(brandSelections) && brandSelections.length > 0) || (Array.isArray(idSelections) && idSelections.length > 0);
    } catch (e) {
      console.warn('[Welcome] 读取本地存储失败，按未展示欢迎页处理', e);
    }
    console.log('[Welcome] 进入欢迎页守卫：hasShownWelcome=', hasShownWelcome, 'brandSelections.length=', Array.isArray(brandSelections) ? brandSelections.length : -1, 'idSelections.length=', Array.isArray(idSelections) ? idSelections.length : -1, 'hasEffectiveSelections=', hasEffectiveSelections);

    if (hasShownWelcome && hasEffectiveSelections) {
      // 已经显示过欢迎页且已有有效选择，直接跳转到主页
      wx.reLaunch({
        url: '/pages/index/index'
      });
      return;
    }
    
    // 彻底重置selectedRestaurants为空数组（统一字符串ID）
    this.data.selectedRestaurants = [];
    this.setData({
      selectedRestaurants: []
    });
    
    console.log('页面加载时selectedRestaurants:', this.data.selectedRestaurants);
    
    this.loadRestaurantData();
  },

  // 加载餐厅数据（优先使用 dataManager 的全量数据）
  loadRestaurantData: function () {
    try {
      // 先加载拼音映射表
      this.loadPinyinMap();

      // 从数据管理器获取全量数据
      let dm = null;
      try { dm = require('../../../utils/dataManager.js'); } catch(e) { console.warn('加载dataManager失败', e); }
      const data = dm && typeof dm.getRestaurantData === 'function' ? dm.getRestaurantData() : null;

      if (data && data.restaurants && Array.isArray(data.restaurants) && data.restaurants.length > 0) {
        const restaurantsWithLogo = data.restaurants.map((r, idx) => {
          const name = r.name || r.brand || r.title || `餐厅${idx+1}`;
          const sid = String(r.id != null ? r.id : (r._id != null ? r._id : idx + 1));
          return {
            id: r.id != null ? r.id : (idx + 1),
            sid, // 字符串ID，供选择与模板绑定使用
            name,
            category: r.category || r.type || '',
            rating: r.rating || 0,
            logoPath: this.getRestaurantLogo(name),
            hdLogoPath: this.getRestaurantHDLogo(name),
            selected: false
          };
        });

        // 若 DataManager 因真机限制走了 JSON 兜底，则用拼音映射表补全更多品牌项
        let list = restaurantsWithLogo;
        let fallbackUsed = false;
        try { fallbackUsed = !!wx.getStorageSync('JSON_FALLBACK_USED'); } catch (e) {}
        if (fallbackUsed) {
          list = this.enrichWithPinyinMap(list);
          console.log('检测到 JSON_FALLBACK_USED=true，使用拼音映射扩充品牌，最终数量:', list.length);
        }

        this.setData({
          restaurants: list,
          isLoading: false
        });

        console.log('餐厅数据加载完成(全量):', list.length);
      } else {
        console.warn('未获取到全量餐厅数据，回退到默认数据');
        this.loadDefaultRestaurantData();
      }
    } catch (error) {
      console.error('加载餐厅数据失败:', error);
      this.loadDefaultRestaurantData();
    }
  },

  // 使用拼音映射表补充更多品牌为可选项（用于 JSON 加载失败场景）
  enrichWithPinyinMap: function (list) {
    try {
      const nameSet = new Set((list || []).map(r => r.name));
      const add = [];
      const map = this.data.pinyinMap || {};
      Object.keys(map).forEach((name, idx) => {
        const py = map[name];
        if (!name || name === '更多餐厅' || !py || py === 'placeholder') return;
        if (!nameSet.has(name)) {
          const sid = `ex_${py || idx}`;
          add.push({
            id: sid,
            sid,
            name,
            category: '',
            rating: 0,
            logoPath: this.getRestaurantLogo(name),
            hdLogoPath: this.getRestaurantHDLogo(name),
            selected: false
          });
        }
      });
      return list.concat(add);
    } catch (e) {
      console.warn('enrichWithPinyinMap 失败，返回原列表', e);
      return list;
    }
  },

  // 加载默认餐厅数据（有限集合）
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
      { id: 11, name: "沃歌斯", category: "汉堡", rating: 4.3 },
      { id: 12, name: "西贝莜面村", category: "西北菜", rating: 4.4 },
      { id: 13, name: "海底捞", category: "火锅", rating: 4.6 },
      { id: 14, name: "鼎泰丰", category: "小笼包", rating: 4.7 },
      { id: 15, name: "呷哺呷哺", category: "火锅", rating: 4.2 },
      { id: 16, name: "星巴克", category: "咖啡", rating: 4.3 },
      { id: 17, name: "喜茶", category: "茶饮", rating: 4.4 },
      { id: 18, name: "南京大牌档", category: "江苏菜", rating: 4.5 },
      { id: 19, name: "鹿港小镇", category: "台湾菜", rating: 4.3 },
      { id: 20, name: "唐宫", category: "粤菜", rating: 4.4 },
      { id: 21, name: "外婆家", category: "杭帮菜", rating: 4.2 }
    ];
    
    // 为每个餐厅添加 sid 与图标路径
    const restaurantsWithLogo = defaultRestaurants.map(restaurant => ({
      ...restaurant,
      sid: String(restaurant.id),
      logoPath: this.getRestaurantLogo(restaurant.name),
      hdLogoPath: this.getRestaurantHDLogo(restaurant.name),
      selected: false
    }));
    
    this.setData({
      restaurants: restaurantsWithLogo,
      isLoading: false
    });
    
    // 调试信息
    console.log('餐厅数据加载完成（默认）:', restaurantsWithLogo.length);
  },

  // 加载拼音映射表（扩充版，与首页保持一致，并补充更多品牌）
  loadPinyinMap: function () {
    const map = {
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
      "沃歌斯": "wogesi",
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
      "大娘水饺": "daniangshuijiao",
      "苏小柳": "suxiaoliu",
      "蔡澜港式点心": "cailangangshidianxin",
      "添好运": "tianhaoyun",
      "很久以前羊肉串": "henjiuyiqianyangrouchuan",
      "丰茂烤串": "fengmaokaochuan",
      "木屋烧烤": "muwushaokao",
      "胡大饭店": "hudafandian",
      "哥老官": "gelaoguan",
      "左庭右院": "zuotingyouyuan",
      "巴奴毛肚火锅": "banumaoduhuoguo",
      "更多餐厅": "placeholder",
      "和府捞面": "hefulaomian",
      "味千拉面": "weiqianlamian",
      "一风堂": "yifengtang",
      "避风塘": "bifengtang",
      "点都德": "diandude",
      "食其家": "shiqijia",
      "吉野家": "jiyejia",
      "松屋": "songwu",
      "丸龟制面": "wanguizhimian",
      "萨莉亚": "saliya",
      "必胜客": "bishengke",
      "达美乐": "dameile",
      "棒约翰": "bangyuehan",
      "麻辣诱惑": "malayouhuo",
      "辛香汇": "xinxianghui",
      "老盛昌": "laoshengchang",
      "吉祥馄饨": "jixianghuntun",
      "阿香米线": "axiangmixian",
      "过桥米线": "guoqiaomixian",
      "汤先生": "tangxiansheng",
      "谷田稻香": "gutiandaoxiang",
      "大米先生": "damixiansheng",
      "真功夫": "zhenggongfu",
      "CoCo都可": "cocodouke",
      "7分甜": "qifentian",
      "桂满陇": "guimanlong",
      "太二酸菜鱼": "taiersuancaiyu",
      "江边城外": "jiangbianchengwai",
      "耶里夏丽": "yelixiali",
      "度小月": "duxiaoyue",
      "望湘园": "wangxiangyuan",
      "蜀都丰": "shudufeng",
      "湊湊火锅": "coucouhuoguo",
      "大龙燚": "dalongyi",
      "电台巷火锅": "diantaixianghuoguo",
      "谭鸭血": "tanyaxie",
      "兰州拉面": "lanhou", // 兜底
      "绿茶餐厅": "lvchacanting",
      "沃歌斯": "wogesi"
    };

    // 关键：立即写入 this.data 以便后续同步读取
    this.data.pinyinMap = map;
    // 再同步到视图层
    this.setData({ pinyinMap: map });
    return map;
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

  // 根据品牌名构建分包图标路径，优先使用A/B分包高清图
  getRestaurantLogo: function (restaurantName) {
    const pinyin = this.data.pinyinMap[restaurantName];
    if (!pinyin || pinyin === 'placeholder') {
      return cloudImageManager.getCloudImageUrl('placeholder');
    }
    const aIcons = this.getPackageAFullIcons();
    if (aIcons.includes(pinyin)) {
      return cloudImageManager.getCloudImageUrl(pinyin);
    }
    const bIcons = this.getPackageBFullIcons();
    if (bIcons.includes(pinyin)) {
      return cloudImageManager.getCloudImageUrl(pinyin);
    }
    return cloudImageManager.getCloudImageUrl('placeholder');
  },

  // 获取分包高清品牌图路径（与 getRestaurantLogo 一致）
  getRestaurantHDLogo: function (restaurantName) {
    return this.getRestaurantLogo(restaurantName);
  },

  // 餐厅选择切换（统一字符串ID）
  onRestaurantTap: function (e) {
    const restaurantSid = String(e.currentTarget.dataset.id); // 保持字符串
    let selectedRestaurants = [...this.data.selectedRestaurants];
    const index = selectedRestaurants.indexOf(restaurantSid);

    let willBeSelected = false;
    if (index > -1) {
      // 取消选择
      selectedRestaurants.splice(index, 1);
      willBeSelected = false;
    } else {
      // 添加选择
      selectedRestaurants.push(restaurantSid);
      willBeSelected = true;
    }

    // 同步更新餐厅项的 selected 字段
    const restaurants = this.data.restaurants.slice();
    const rIdx = restaurants.findIndex(r => r.sid === restaurantSid);
    if (rIdx !== -1) {
      restaurants[rIdx] = { ...restaurants[rIdx], selected: willBeSelected };
    }

    this.setData({
      selectedRestaurants,
      restaurants
    });

    // 添加调试日志
    console.log('点击餐厅SID:', restaurantSid, '当前选中:', selectedRestaurants);
    const found = restaurants.find(r => r.sid === restaurantSid);
    console.log('餐厅数据:', found);
  },

  // 检查餐厅是否被选中
  isRestaurantSelected: function (restaurantSid) {
    return this.data.selectedRestaurants.includes(String(restaurantSid));
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

  // 实际添加自定义餐厅逻辑
  addCustomRestaurant: function (restaurantName) {
    // 使用user_added_前缀确保能被正确识别为用户添加的餐厅
    const userAddedId = `user_added_${restaurantName}`;
    const newRestaurant = {
      id: userAddedId,
      sid: userAddedId,
      name: restaurantName,
      category: '自定义',
      rating: 0,
      logoPath: cloudImageManager.getCloudImageUrl('placeholder'),
      hdLogoPath: cloudImageManager.getCloudImageUrl('placeholder'),
      selected: true
    };
    const updatedRestaurants = [...this.data.restaurants, newRestaurant];

    // 新增项目默认选中，同时同步 selectedRestaurants
    const updatedSelectedRestaurants = this.data.selectedRestaurants.slice();
    if (!updatedSelectedRestaurants.includes(userAddedId)) {
      updatedSelectedRestaurants.push(userAddedId);
    }

    this.setData({
      restaurants: updatedRestaurants,
      selectedRestaurants: updatedSelectedRestaurants
    });

    // 成功提示：已添加至列表末尾
    wx.showToast({
      title: '已添加至列表末尾',
      icon: 'success',
      duration: 1500
    });
  },

  // 图片加载失败兜底：尝试切换到另一分包或占位图；避免循环触发
  onImageError: function (e) {
    const restaurantSid = String(e.currentTarget.dataset.id);
    const restaurants = this.data.restaurants.slice();
    const idx = restaurants.findIndex(r => r.sid === restaurantSid);
    if (idx === -1) return;
    const item = restaurants[idx];
    if (item._logoErrorHandled) return; // 避免循环
    item._logoErrorHandled = true;

    const pinyin = this.data.pinyinMap[item.name];
    const aIcons = this.getPackageAFullIcons();
    const bIcons = this.getPackageBFullIcons();

    if (pinyin) {
      if (item.logoPath.indexOf('/packageA/') === 0 && bIcons.includes(pinyin)) {
        item.logoPath = cloudImageManager.getCloudImageUrl(pinyin);
      } else if (item.logoPath.indexOf('/packageB/') === 0 && aIcons.includes(pinyin)) {
        item.logoPath = cloudImageManager.getCloudImageUrl(pinyin);
      } else if (aIcons.includes(pinyin)) {
        item.logoPath = cloudImageManager.getCloudImageUrl(pinyin);
      } else if (bIcons.includes(pinyin)) {
        item.logoPath = cloudImageManager.getCloudImageUrl(pinyin);
      } else {
        item.logoPath = cloudImageManager.getCloudImageUrl('placeholder');
      }
    } else {
      item.logoPath = cloudImageManager.getCloudImageUrl('placeholder');
    }

    restaurants[idx] = item;
    this.setData({ restaurants });
  },

  // 完成选择并跳转
  onCompleteSelection: function () {
    // 校验至少选择一个
    if (this.data.selectedRestaurants.length === 0) {
      wx.showToast({
        title: '请至少选择一个餐厅',
        icon: 'none'
      });
      return;
    }
    this.saveSelections();
  },

  // 保存选择
  saveSelections: function () {
    try {
      // 原生存储（兼容旧逻辑）——保存字符串ID
      wx.setStorageSync('welcomeSelections', this.data.selectedRestaurants);
      // 将品牌名称作为欢迎页品牌选择
      const selectedBrandNames = this.data.selectedRestaurants
        .map(sid => {
          const found = this.data.restaurants.find(r => r.sid === sid);
          return found ? found.name : null;
        })
        .filter(Boolean);
      wx.setStorageSync('welcomeSelectionsByBrand', selectedBrandNames);
      wx.setStorageSync('hasShownWelcome', true);

      // 统一写入数据管理器
      let dm = null;
      try { dm = require('../../../utils/dataManager.js'); } catch(e) { dm = null; }
      if (dm && typeof dm.getUserData === 'function' && typeof dm.updateUserData === 'function') {
        const userData = dm.getUserData();
        const newUserData = Object.assign({}, userData, {
          welcomeSelections: this.data.selectedRestaurants.slice(),
          welcomeSelectionsByBrand: selectedBrandNames
        });
        // 批量更新
        dm.updateUserData('welcomeSelections', newUserData.welcomeSelections);
        dm.updateUserData('welcomeSelectionsByBrand', newUserData.welcomeSelectionsByBrand);

        // 决策历史：为每个选择记录一次“accept”
        if (typeof dm.addDecisionRecord === 'function') {
          this.data.selectedRestaurants.forEach(sid => {
            const found = this.data.restaurants.find(r => r.sid === sid);
            dm.addDecisionRecord({
              action: 'accept',
              type: 'welcome',
              restaurantId: (found && found.id != null) ? String(found.id) : String(sid),
              brand: found ? found.name : ''
            });
          });
        }

        // 评分写回：对每个选择执行一次“accept”，提升初始偏好分
        try {
          const scoring = require('../../../utils/scoringManager.js');
          if (scoring && typeof scoring.updateRestaurantScore === 'function') {
            this.data.selectedRestaurants.forEach(sid => {
              const found = this.data.restaurants.find(r => r.sid === sid) || {};
              const restaurantId = (found && found.id != null) ? String(found.id) : String(sid);
              const restaurantData = { name: found.name || '' };
              scoring.updateRestaurantScore(userData, restaurantId, 'accept', restaurantData);
            });
          }
        } catch (e) {
          console.warn('[Welcome] 初始评分写回失败，继续流程', e);
        }
      } else {
        // 兜底：直接写 user_data（旧逻辑）
        const userData = wx.getStorageSync('user_data') || {};
        userData.welcomeSelections = this.data.selectedRestaurants.slice();
        userData.welcomeSelectionsByBrand = selectedBrandNames;
        wx.setStorageSync('user_data', userData);
      }

      wx.reLaunch({ url: '/pages/index/index' });
    } catch (error) {
      console.error('保存选择失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  }
});