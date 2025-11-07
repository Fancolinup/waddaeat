// pages/index/index.js
const { getUserData, updateUserData, addDecisionRecord, addPoints } = require('../../utils/dataManager');
const { generateRecommendations } = require('../../utils/recommendation');
const { updateRestaurantScore } = require('../../utils/scoringManager');
const { updateUserPreference } = require('../../utils/preferenceLearner');
const { cloudImageManager } = require('../../utils/cloudImageManager');
const locationService = require('../../utils/locationService');
const ranking = require('../../utils/ranking');
const takeoutData = require('../../data/takeout');
const beverageData = require('../../data/beverage');
const pinyin = require('../../restaurant_pinyin.js');
// removed: const shareWording = require('../../shareWording.json');
// 高德微信SDK
const { AMapWX } = require('../../libs/amap-wx.130.js');
// 高德餐饮类型编码（按用户提供）
const AMAP_TYPES = '050100|050101|050102|050103|050104|050105|050106|050107|050108|050109|050110|050111|050112|050113|050114|050115|050116|050117|050118|050119|050120|050121|050122|050123|050200|050201|050202|050203|050204|050205|050206|050207|050208|050209|050210|050211|050212|050213|050214|050215|050216|050217|050300|050301|050302|050303|050304|050305|050306|050307|050308|050309|050310|050311';

// 调试时间戳辅助
const ts = () => new Date().toISOString();

Page({
  data: {
    // 转盘类型切换
    wheelType: 'restaurant', // 'restaurant', 'takeout', 'beverage'
    
    // 轮盘 & 数据
    segments: [], // 12 items
    wheelRadius: 310, // rpx offset for icon positions
    rouletteRotation: 0,
    selected: null,
    isSpinning: false,
    // 动态背景：非餐厅轮盘按扇区数生成的 conic-gradient 字符串（空串表示使用 CSS 类）
    wheelBackground: '',

    // UI 状态
    showDecisionLayer: false,
    showShareArea: true,
    spinClass: '',

    // 手势检测
    touchStartY: 0,
    touchStartTime: 0,

    // 备选
    shortlist: [],
    
    // 定位功能
    locationStatus: 'idle', // 'idle', 'loading', 'success', 'error'
    locationText: '选择位置',
    userLocation: null,
    nearbyRestaurants: [],
    nearbyOffers: [],
    nearbyLoading: false,
    
    // 云图片占位符
    placeholderImageUrl: cloudImageManager.getPlaceholderUrlSync(),
    nearbyPlaceholderImageUrl: cloudImageManager.getPlaceholderUrlSync(),
    placeholderSlots: [0,0,0],
    // 轮盘类型切换按钮图标（HTTPS临时链接或占位图）
    switchIcons: { canteen: '', takeout: '', beverage: '' },
    activeShortlistId: '',
    activeShortlistIndex: -1, // 以索引记录选中项，避免同ID或数据复用导致多选

    // 分享
    shareText: '今天吃什么？',
    shareTargetName: '',

    // 顶部问候（UI已移除，逻辑保留以便未来需要）
    greeting: '',
    currentTime: '',

    // 文案径向布局参数（从外向内排列，末端离圆心 5rpx）
    labelOuterMargin: 30,      // 距离外缘的安全边距（rpx）— 向边缘方向移动30rpx
    labelInnerMargin: 40,      // 末端距离圆心（rpx）
    labelMinStep: 22,          // 字符最小步进（rpx）— 略增字距
    labelMaxStep: 34,          // 字符最大步进（rpx）— 略增字距

    // 配色切换（9组）
    currentPaletteKey: 's1',
    paletteKeys: ['s1','s2','s3','s4','s5','s6','s7','s8','s9'],
    
    // 基于当前显示顺序的编号数组（1..12 -> segment索引），用于日志与后续扩展
    displayOrder: [],

    // 记录首页结果浮层 logo 的扩展名尝试次数：key=name 或拼音，value=0..3
    logoRetryMap: {},
    // 顶部toast显示
    showTopToast: false,
    topToastText: '',
    // 随机化转动时长（ms），默认 3200ms
    spinDurationMs: 3200,
    // 旋转次数计数器（接受或确认后重置）
    spinCounter: 0,

    // === 统一位置微调（仅此一处） ===
    // 使用 transform: translate(Xrpx, Yrpx) 字符串进行微调，避免影响其他模块布局
    wheelTransform: 'translate(0rpx, 27rpx)',           // 还原旧的负内边距效果
    paletteTransform: 'translate(8rpx, 0rpx)',         // 还原旧的右上角偏移
    addBtnTransform: 'translate(60rpx, 10rpx)',         // 还原旧的右下角偏移
    switcherTransform: 'translate(0rpx, -20rpx)',         // 还原旧的上移 35rpx
    shortlistTransform: 'translate(-20rpx, -10rpx)',         // 还原旧的 margin-top:12rpx
    shareTransform: 'translate(-30rpx, -10rpx)',              // 默认不偏移
    nearbyTransform: 'translate(0rpx, 8rpx)',                   // 保持位置稳定，避免上移挤占上方模块
    searchTransform: 'translate(560rpx, 658rpx)',                 // 顶部搜索框：与定位模块右侧对齐，使用 translate 控制
  },

  onLoad() {
    this.initWheel(false);
    this.loadShareText();
    this.updateDateTime();
    this._clock = setInterval(() => this.updateDateTime(), 60 * 1000);
    this.updatePlaceholderSlots();

    // 进入页面时恢复用户上次选择的色盘（若无则回退到 s1）
    try {
      const storedKey = wx.getStorageSync('paletteKey');
      const keys = this.data.paletteKeys || ['s1','s2','s3','s4','s5','s6','s7','s8','s9'];
      const valid = keys.includes(storedKey);
      const initialKey = valid ? storedKey : 's1';
      this.setData({ currentPaletteKey: initialKey });
      if (!valid) wx.setStorageSync('paletteKey', initialKey);
    } catch(e) {
      this.setData({ currentPaletteKey: 's1' });
      try { wx.setStorageSync('paletteKey', 's1'); } catch(_) {}
    }

    // 初始化动态背景（如果是非餐厅类型，会按当前 segments 数量计算；餐厅保持CSS）
    try {
      const bg = this.computeWheelBackground(this.data.currentPaletteKey, (this.data.segments || []).length, this.data.wheelType);
      this.setData({ wheelBackground: bg });
    } catch (eBg) { this.setData({ wheelBackground: '' }); }
    
    // 延迟验证卡片居中位置
    setTimeout(() => {
      this.verifyCenterPosition();
    }, 500);

    // 初始化云端图片 - iOS设备强制使用HTTPS临时链接
    this.initCloudImages();
  },

  onShow() {
    // 保持 share 文案更新
    this.loadShareText();
    // 自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    
    // 从本地存储恢复位置信息（双向同步）
    let cachedLoc = null;
    try { cachedLoc = wx.getStorageSync('userLocation'); } catch(e) {}
    if (cachedLoc && cachedLoc.name) {
      this.setData({ userLocation: cachedLoc });
      // TTL 检查：附近优惠为空或位置缓存过期则触发刷新
      const ttlMs = 2 * 60 * 60 * 1000; // 2小时TTL
      const now = Date.now();
      const locTs = Number(cachedLoc.ts || 0);
      const noOffers = !Array.isArray(this.data.nearbyOffers) || this.data.nearbyOffers.length === 0;
      if (cachedLoc.latitude && cachedLoc.longitude && (noOffers || !locTs || (now - locTs > ttlMs))) {
        this.loadNearbyOffers();
      }
    }
    
    // 恢复位置信息显示
    this.restoreLocationDisplay();
  },

  // 配色切换（循环 9 组：s1→s2→...→s9→s1）
  onTogglePalette() {
    const keys = this.data.paletteKeys || ['s1','s2','s3','s4','s5','s6','s7','s8','s9'];
    const cur = this.data.currentPaletteKey || 's1';
    const idx = Math.max(0, keys.indexOf(cur));
    const next = keys[(idx + 1) % keys.length];
    this.setData({ currentPaletteKey: next });
    // 立即更新动态背景（非餐厅）
    try {
      const bg = this.computeWheelBackground(next, (this.data.segments || []).length, this.data.wheelType);
      this.setData({ wheelBackground: bg });
    } catch (eBg) { this.setData({ wheelBackground: '' }); }
    try { wx.setStorageSync('paletteKey', next); } catch(e) {}
  },

  // 转盘类型切换
  onSwitchWheelType(e) {
    const newType = e.currentTarget.dataset.type;
    if (newType === this.data.wheelType || this.data.isSpinning) return;
    
    // 触觉反馈
    wx.vibrateShort({ type: 'light' });
    
    // 添加切换动画类
    this.setData({ 
      wheelType: newType,
      switchingAnimation: true 
    });
    
    // 移除动画类
    setTimeout(() => {
      this.setData({ switchingAnimation: false });
      // 切换完成后，记录一次距离验证日志
      this.verifyCenterPosition('afterSwitch');
    }, 300);
    
    // 刷新转盘数据
    this.initWheel(false);

    // 根据切换后的类型更新背景（餐厅清空以使用 CSS 固定，非餐厅按扇区数生成）
    try {
      const bg = this.computeWheelBackground(this.data.currentPaletteKey, (this.data.segments || []).length, newType);
      this.setData({ wheelBackground: bg });
    } catch (eBg) { this.setData({ wheelBackground: '' }); }

    // 切换后刷新占位图与切换图标（iOS 使用临时 HTTPS 链接）
    try { this.initCloudImages(); } catch (_) {}
    
    // 隐藏结果浮层
    this.setData({ showDecisionLayer: false, showShareArea: false, selected: null });
    
    // 提示切换完成（顶部自定义toast）
  const typeNames = { restaurant: '餐厅', takeout: '外卖', beverage: '茶饮' };
  const _text = `已切换到${typeNames[newType]}转盘`;
  this.setData({ showTopToast: true, topToastText: _text });
  if (this._toastTimer) clearTimeout(this._toastTimer);
  this._toastTimer = setTimeout(() => {
    this.setData({ showTopToast: false });
    this._toastTimer = null;
  }, 1500);
  },

  // 显示顶部提示
  showTopToast(text) {
    this.setData({ 
      showTopToast: true, 
      topToastText: text 
    });
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.setData({ showTopToast: false });
      this._toastTimer = null;
    }, 1500);
  },

  onUnload() {
    if (this._clock) {
      clearInterval(this._clock);
      this._clock = null;
    }
  },

  // 精确验证卡片居中位置
  verifyCenterPosition(phase = 'manual') {
    console.debug('=== 开始验证卡片居中位置 ===');
    
    const query = wx.createSelectorQuery();
    
    // 获取视口信息
    query.selectViewport().boundingClientRect();
    // 获取容器信息
    query.select('.container').boundingClientRect();
    // 获取hero-area信息
    query.select('.hero-area').boundingClientRect();
    // 获取轮盘容器信息
    query.select('.roulette-wheel-container').boundingClientRect();
    // 获取切换按钮与备选区信息
    query.select('.wheel-type-switcher-area').boundingClientRect();
    query.select('.wheel-type-switcher').boundingClientRect();
    query.select('.shortlist').boundingClientRect();
    
    query.exec((res) => {
      const viewport = res[0];
      const container = res[1];
      const heroArea = res[2];
      const rouletteContainer = res[3];
      
      console.debug('📱 视口信息:', {
        width: viewport.width,
        height: viewport.height,
        centerX: viewport.width / 2,
        centerY: viewport.height / 2
      });
      
      if (container) {
        console.debug('📦 容器信息:', {
          width: container.width,
          height: container.height,
          left: container.left,
          top: container.top,
          centerX: container.left + container.width / 2,
          centerY: container.top + container.height / 2
        });
      }
      
      if (heroArea) {
        console.debug('🎯 Hero区域信息:', {
          width: heroArea.width,
          height: heroArea.height,
          left: heroArea.left,
          top: heroArea.top,
          centerX: heroArea.left + heroArea.width / 2,
          centerY: heroArea.top + heroArea.height / 2
        });
      }
      
      if (rouletteContainer) {
        const rouletteCenterX = rouletteContainer.left + rouletteContainer.width / 2;
        const rouletteCenterY = rouletteContainer.top + rouletteContainer.height / 2;
        const viewportCenterX = viewport.width / 2;
        const viewportCenterY = viewport.height / 2;
        
        console.debug('🎡 轮盘容器信息:', {
          width: rouletteContainer.width,
          height: rouletteContainer.height,
          left: rouletteContainer.left,
          top: rouletteContainer.top,
          centerX: rouletteCenterX,
          centerY: rouletteCenterY
        });
        
        // 计算偏移量
        const offsetX = Math.abs(rouletteCenterX - viewportCenterX);
        const offsetY = Math.abs(rouletteCenterY - viewportCenterY);
        
        console.debug('📏 居中偏移分析:', {
          水平偏移: `${offsetX.toFixed(2)}px`,
          垂直偏移: `${offsetY.toFixed(2)}px`,
          水平居中: offsetX < 1 ? '✅ 完美居中' : offsetX < 5 ? '⚠️ 基本居中' : '❌ 偏移过大',
          垂直居中: offsetY < 1 ? '✅ 完美居中' : offsetY < 5 ? '⚠️ 基本居中' : '❌ 偏移过大'
        });
        
        // 计算相对于视口的位置百分比
        const xPercent = (rouletteCenterX / viewport.width * 100).toFixed(1);
        const yPercent = (rouletteCenterY / viewport.height * 100).toFixed(1);
        
        console.debug('📊 位置百分比:', {
          水平位置: `${xPercent}%`,
          垂直位置: `${yPercent}%`,
          理想位置: '50.0%',
          水平偏差: `${Math.abs(50 - parseFloat(xPercent)).toFixed(1)}%`,
          垂直偏差: `${Math.abs(50 - parseFloat(yPercent)).toFixed(1)}%`
        });
        
        // 综合评估
        const isWellCentered = offsetX < 5 && offsetY < 5;
        console.debug('🎯 居中评估结果:', isWellCentered ? '✅ 卡片居中良好' : '❌ 卡片居中需要调整');
        
      } else {
        console.warn('⚠️ 无法获取轮盘容器信息');
      }
      
      // 追加切换按钮与备选区的距离测量
      const area = res[4];
      const switcher = res[5];
      const shortlist = res[6];
      if (area && switcher && shortlist) {
        const distancePx = Math.max(0, shortlist.top - (area.top + switcher.height));
        console.debug(`🔍 [verify] phase=${phase} 切换按钮到备选区的垂直距离=${distancePx.toFixed(2)}px`, { areaTop: area.top, switcherHeight: switcher.height, shortlistTop: shortlist.top });
      } else {
        console.warn('⚠️ 无法获取切换按钮/备选区的布局信息');
      }

      console.debug('=== 卡片居中位置验证完成 ===');
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.shareText || '今天吃什么？',
      path: '/pages/index/index'
    };
  },

  /** 顶部问候与时间 **/
  updateDateTime() {
    const now = new Date();
    const h = now.getHours();
    let greeting = 'Good Evening';
    if (h < 12) greeting = 'Good Morning';
    else if (h < 18) greeting = 'Good Afternoon';

    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    this.setData({ greeting, currentTime: `It's ${time}, ${day}` });
  },

  /** 获取品牌拼音映射（统一使用模块数据） */
  getPinyinMap() {
    return pinyin;
  },

  getPackageAFullIcons() {
    return [
      'Baker&Spice','bifengtang','diandude','dingtaifeng','duxiaoyue','haidilao','hefulaomian','jiangbianchengwai','jiyejia','lugangxiaozhen','lvchacanting','naixuedecha','nanjingdapaidang','nanxiangmantoudian','shiqijia','shudufeng','songwu','taiersuancaiyu','tanggong','waipojia','wangxiangyuan','weiqianlamian','xiabuxiabu','xiaoyangshengjian','xibeiyoumiancun','xicha','xingbake','xinyuansu','yelixiali','yifengtang','yunhaiyao','chaojiwan','chenxianggui','hanbaowang','kendeji','lanwa','maidanglao','majiyong','putiancanting','shudaxia','wogesi','tanyaxie','placeholder'
    ];
  },
  getPackageBFullIcons() {
    return [
      'axiangmixian','bangyuehan','banumaoduhuoguo','bishengke','cailangangshidianxin','cocodouke','coucouhuoguo','dalongyi','dameile','damixiansheng','daniangshuijiao','diantaixianghuoguo','fengmaokaochuan','gelaoguan','guimanlong','guoqiaomixian','gutiandaoxiang','henjiuyiqianyangrouchuan','hudafandian','jixianghuntun','laoshengchang','lelecha','malayouhuo','muwushaokao','qifentian','saliya','suxiaoliu','tangxiansheng','tianhaoyun','wanguizhimian','xiaolongkan','xiaonanguo','xinbailu','xinxianghui','yidiandian','yonghedawang','zhenggongfu','zuotingyouyuan'
    ];
  },

  // 根据餐厅名称返回图标路径（找不到时回退到餐厅占位图 canteen.png）
  getRestaurantIconPath(name) {
    try {
      const map = this.getPinyinMap();
      const pkgA = this.getPackageAFullIcons();
      const pkgB = this.getPackageBFullIcons();

      let key = map && name ? (map[name] || name) : (name || 'canteen');

      // 直配命中
      if (pkgA.includes(key) || pkgB.includes(key)) {
        return cloudImageManager.getCloudImageUrlSync(key);
      }

      // 常见归一化尝试
      const variants = [];
      if (key) {
        variants.push(String(key).replace(/\s+/g, ''));
        variants.push(String(key).toLowerCase());
        variants.push(String(key).replace(/\s+/g, '').toLowerCase());
      }

      for (const v of variants) {
        if (pkgA.includes(v) || pkgB.includes(v)) {
          return cloudImageManager.getCloudImageUrlSync(v);
        }
      }

      // 兜底占位图（餐厅统一 canteen.png）
      return cloudImageManager.getCloudImageUrlSync('canteen', 'png');
    } catch (e) {
      console.warn('getRestaurantIconPath 解析失败，使用餐厅占位图:', e);
      return cloudImageManager.getCloudImageUrlSync('canteen', 'png');
    }
  },

  // 生成外卖转盘推荐（从takeout.json的category_name中选取）
  generateTakeoutRecommendations(count) {
    try {
      const categories = takeoutData.takeout_categories || [];
      if (categories.length === 0) return [];
      const valid = categories.filter(c => c && String(c.category_name || '').trim().length > 0);
      if (typeof count !== 'number' || count <= 0 || count > valid.length) {
        count = valid.length;
      }
      
      // 随机选择 count 个类别
      const shuffled = [...valid].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);
      
      const pinyinMap = {
        '汉堡': 'hanbao',
        '米饭套餐': 'mifantaocan',
        '面条': 'miantiao',
        '披萨': 'pisa',
        '炸鸡': 'zhaji',
        '寿司': 'shousi',
        '烧烤': 'shaokao',
        '火锅': 'huoguo',
        '麻辣烫': 'malatang',
        '粥品': 'zhoupin',
        '甜品': 'tianpin',
        '轻食沙拉': 'qingshishala',
        '水饺馄饨': 'shuijiaohuntun',
        '米粉米线': 'mifenmixian',
        '麻辣香锅': 'malaxiangguo'
      };
      return selected.map((category, index) => {
        const cname = category.category_name || '';
        const py = pinyinMap[cname];
        return {
          id: `takeout_${index + 1}`,
          name: cname || '外卖类别',
          type: '外卖',
          brands: category.brands || [],
          icon: py ? cloudImageManager.getCloudImageUrl(py, 'png') : cloudImageManager.getCloudImageUrl('takeout', 'png'),
          iconClass: this.getTakeoutIconClass(cname),
          recommendationScore: Math.random() * 100,
          specificScore: Math.random() * 100,
          preferenceScore: Math.random() * 100
        };
      });
    } catch (e) {
      console.error('生成外卖推荐失败:', e);
      return [];
    }
  },

  // 生成茶饮转盘推荐（从beverage.json的name中选取）
  generateBeverageRecommendations(count) {
    try {
      const brands = beverageData.beverage_brands || [];
      if (brands.length === 0) return [];
      const valid = brands.filter(b => b && String(b.name || '').trim().length > 0);
      if (typeof count !== 'number' || count <= 0 || count > valid.length) {
        count = valid.length;
      }
      
      // 随机选择 count 个品牌
      const shuffled = [...valid].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);
      
      return selected.map((brand, index) => ({
        id: brand.id || `beverage_${index + 1}`,
        name: brand.name || '茶饮品牌',
        type: brand.type || '茶饮',
        typeClass: this.getBeverageTypeClass(brand.type || '茶饮'),
        pinyin: brand.pinyin || '',
        priceLevel: brand.priceLevel || 2,
        tags: brand.tags || [],
        popularityScore: brand.popularityScore || 0.5,
        icon: (brand.pinyin ? cloudImageManager.getCloudImageUrl(brand.pinyin, 'png') : cloudImageManager.getCloudImageUrl('beverage', 'png')),
        recommendationScore: (brand.popularityScore || 0.5) * 100,
        specificScore: Math.random() * 100,
        preferenceScore: Math.random() * 100
      }));
    } catch (e) {
      console.error('生成茶饮推荐失败:', e);
      return [];
    }
  },

  // 将中文茶饮类型转换为英文类名
  getBeverageTypeClass(type) {
    const typeMap = {
      '咖啡': 'coffee',
      '奶茶': 'milktea', 
      '茶饮': 'tea'
    };
    return typeMap[type] || 'tea';
  },

  // 根据外卖类别名称映射到CSS图标类
  getTakeoutIconClass(categoryName) {
    const name = String(categoryName || '').trim();
    const map = [
      { keys: ['粥', '粥品', '皮蛋瘦肉粥', '海鲜粥'], cls: 'steaming-porridge' },
      { keys: ['米饭', '盖饭', '盒饭', '套餐'], cls: 'rice-bento' },
      { keys: ['面', '粉', '米线', '米粉'], cls: 'noodles' },
      { keys: ['炸鸡', '汉堡', '披萨', '西式快餐', '快餐'], cls: 'fastfood' },
      { keys: ['烧烤', '串', '烤'], cls: 'bbq' },
      { keys: ['火锅'], cls: 'hotpot' },
      { keys: ['小吃', '零食'], cls: 'snack' },
      { keys: ['甜品', '奶昔', '冰淇淋'], cls: 'dessert' },
      { keys: ['汤'], cls: 'soup' }
    ];
    for (const rule of map) {
      if (rule.keys.some(k => name.includes(k))) return rule.cls;
    }
    return 'default';
  },

  // 初始化轮盘（12个推荐）
  initWheel(preserveRotation = false) {
    try {
      // 初始化阶段：禁用过渡动画，防止旋转动画在对齐时出现
      if (!preserveRotation) {
        this._initInProgress = true;
        this._pendingAutoRefresh = false; // 进入新一轮时复位待刷新标记
        this.setData({ spinClass: 'no-transition' });
      }
      // 用于变更对比的上一轮推荐（按 slotNo 记录）
      const prevSegments = Array.isArray(this.data.segments) ? this.data.segments : [];
      const prevBySlot = {};
      for (const s of prevSegments) {
        if (s && s.slotNo) prevBySlot[s.slotNo] = s.name || '';
      }

      const userData = getUserData();
      let recs = [];

      // 特殊刷新路径：若存在强制候选，直接使用（餐厅需20，其他只要有即可）
      if (this._forcedRecs && Array.isArray(this._forcedRecs) && (this.data.wheelType === 'restaurant' ? this._forcedRecs.length === 20 : this._forcedRecs.length > 0)) {
        recs = this._forcedRecs;
        console.debug(`[${ts()}] 应用强制候选（特殊刷新：保留前5+替换后7为窗口顺延）`);
      } else {
        // 根据转盘类型生成不同数据
        if (this.data.wheelType === 'takeout') {
          recs = this.generateTakeoutRecommendations();
        } else if (this.data.wheelType === 'beverage') {
          recs = this.generateBeverageRecommendations();
        } else {
          // 只有餐厅转盘才使用基于位置的推荐
          if (this.data.userLocation && this.data.locationStatus === 'success') {
            console.debug('[轮盘初始化] 使用基于位置的推荐');
            // 使用已缓存的定位推荐数据，避免重复调用
            const locationBasedRecommendations = this._cachedLocationRecommendations || [];
            if (locationBasedRecommendations.length > 0) {
              recs = locationBasedRecommendations.slice(0, 20);
            } else {
              // 如果没有缓存，回退到普通推荐
              recs = generateRecommendations(userData, 20);
            }
          } else {
            recs = generateRecommendations(userData, 20);
          }
        }
      }
      
      const fmt = (v) => (typeof v === 'number' ? Number(v).toFixed(2) : '--');
      console.debug(`[${ts()}] 推荐列表(生成/刷新)：`, recs.map((r, i) => `${i+1}.${r && r.name ? r.name : ''} [总:${fmt(r && r.recommendationScore)} 评:${fmt(r && r.specificScore)} 偏:${fmt(r && r.preferenceScore)}]`));
      const count = this.data.wheelType === 'restaurant' ? 20 : (Array.isArray(recs) ? recs.length : 0);
      const step = 360 / count;
      const { wheelRadius, labelOuterMargin, labelInnerMargin, labelMinStep, labelMaxStep } = this.data;
      const pointerAngle = 0; // 修正：指针在CSS中位于top位置，对应0°

      // 保持推荐顺序(1..N)，不因指针对齐而重排
      const segments = Array.from({ length: count }, (_, idx) => {
        const r = recs[idx];
        const rawName = (r && r.name) ? r.name : '';
        const name = this.cleanRestaurantName(rawName);
        const labelName = this.truncateRestaurantLabel(name, 12);
        const nameChars = String(labelName).split('');
        const outer = Math.max(0, wheelRadius - labelOuterMargin);
        const inner = Math.max(0, labelInnerMargin);
        const available = Math.max(0, outer - inner);
        let chars = [];
        if (nameChars.length <= 1) {
          chars = [{ ch: nameChars[0] || '', pos: Math.max(inner, Math.min(outer, Math.round((outer + inner) / 2))) }];
        } else {
          const rawStep = available / (nameChars.length - 1);
          const stepLen = Math.max(labelMinStep, Math.min(labelMaxStep, rawStep));
          const start = outer; // 从外沿开始
          chars = nameChars.map((ch, cidx) => ({ ch, pos: Math.max(inner, Math.round(start - cidx * stepLen)) }));
        }
        return {
          id: String(r.id),
          name,
          type: r.type,
          icon: (r && r.icon) ? r.icon : (this.data.wheelType === 'takeout' ? cloudImageManager.getCloudImageUrl('takeout', 'png') : (this.data.wheelType === 'beverage' ? cloudImageManager.getCloudImageUrl('beverage', 'png') : this.getRestaurantIconPath(name))),
          promoText: r.dynamicPromotions && r.dynamicPromotions[0] ? r.dynamicPromotions[0].promoText : '',
          angle: idx * step + step / 2, // 该段中心角（相对轮盘自身坐标系）
          slotNo: idx + 1,
          // 分数（仅用于日志/调试）
          specificScore: (r && typeof r.specificScore === 'number') ? r.specificScore : undefined,
          preferenceScore: (r && typeof r.preferenceScore === 'number') ? r.preferenceScore : undefined,
          recommendationScore: (r && typeof r.recommendationScore === 'number') ? r.recommendationScore : undefined,
          chars,
          // 结果浮层使用的可选字段（外卖/茶饮）
          brands: Array.isArray(r && r.brands) ? r.brands : [],
          iconClass: r && r.iconClass,
          typeClass: r && r.typeClass,
          tags: (function(){const base=Array.isArray(r && r.tags)? r.tags: []; const bt = (r && r.businessTag) || (r && r.category); return bt ? [...base, bt] : base; })(),
          rating: (r && typeof r.rating === 'number') ? r.rating : undefined,
          cost: (r && typeof r.cost === 'number') ? r.cost : undefined,
          ratingDisplay: (r && typeof r.rating === 'number' && r.rating>0) ? (Number(r.rating).toFixed(1) + '分') : '',
          costDisplay: (r && typeof r.cost === 'number' && r.cost>0) ? ('¥' + Number(r.cost).toFixed(0)) : '',
          // 来源标识透传
          isFromAmap: !!(r && r.isFromAmap),
          isPreselected: !!(r && r.isPreselected),
          isUserAdded: !!(r && (r.isUserAdded || (typeof r.id === 'string' && r.id.startsWith('user_added_')))),
          // 位置相关信息（优先使用 amapData）
          latitude: (r && r.amapData && r.amapData.latitude != null) ? r.amapData.latitude : (r && r.latitude),
          longitude: (r && r.amapData && r.amapData.longitude != null) ? r.amapData.longitude : (r && r.longitude),
          address: (r && r.amapData && r.amapData.address) ? r.amapData.address : (r && r.address),
          amapData: (r && r.amapData && (r.amapData.latitude != null) && (r.amapData.longitude != null)) ? { latitude: r.amapData.latitude, longitude: r.amapData.longitude, address: r.amapData.address, original: r.amapData.original } : ((r && r.latitude != null && r.longitude != null) ? { latitude: r.latitude, longitude: r.longitude, address: r.address } : undefined)
        };
      });

      // 维护显示顺序：编号 -> 扇区索引（恒等映射）
      const displayOrder = new Array(count);
      for (let i = 0; i < count; i++) {
        const s = segments[i];
        displayOrder[(s.slotNo || 0) - 1] = i;
      }

      const listLog = segments.map(s => `${s.slotNo}.${s.name} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`);
      console.debug(`[${ts()}] 生成转盘(${count})：`, listLog);

      // 输出变更状态日志（对比上一轮）
      if (prevSegments && prevSegments.length) {
        const diffLines = segments.map(s => {
          const prevName = prevBySlot[s.slotNo] || '';
          let status = '';
          if (!prevName) status = '新';
          else if (prevName === s.name) status = '未变';
          else status = `变更(原: ${prevName})`;
          return `${s.slotNo}. ${s.name} — ${status} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`;
        });
        console.debug(`[${ts()}] 换一批后推荐列表（带变更标记）：\n${diffLines.join('\n')}`);
      } else {
        const initLines = segments.map(s => `${s.slotNo}. ${s.name} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`);
        console.debug(`[${ts()}] 初始推荐列表：\n${initLines.join('\n')}`);
      }

      // 调试：输出所有段的角度位置
      console.debug(`[${ts()}] 段角度调试：`, segments.map((s, i) => `${s.slotNo}.${s.name}@${s.angle}°`));

      const base = { segments, selected: null, showDecisionLayer: false, displayOrder };
      if (!preserveRotation) {
        // 让 slot 1(segments[0]) 的中心角对齐到 pointerAngle
        const s0Angle = segments[0].angle; // step/2
        const rotationOffset = ((pointerAngle - s0Angle) % 360 + 360) % 360;
        base.rouletteRotation = rotationOffset;
        console.debug(`[${ts()}] 初始对齐：基于段中心角 s0=${s0Angle}°，设置 rotation=${rotationOffset}°`);

        // 计算此时三角形指示器所指向的餐厅（编号与名称），用于验证对齐
        const effectiveRot0 = rotationOffset;
        let hitIndex0 = 0;
        let minDiff0 = 9999;
        for (let i = 0; i < count; i++) {
          const center0 = ((segments[i].angle + effectiveRot0) % 360 + 360) % 360;
          let diff0 = Math.abs(center0 - pointerAngle);
          diff0 = Math.min(diff0, 360 - diff0);
          if (diff0 < minDiff0) { minDiff0 = diff0; hitIndex0 = i; }
        }
        const pointed = segments[hitIndex0];
        console.debug(`[${ts()}] 初始化完成：当前指向 编号=${pointed.slotNo}，餐厅="${pointed.name}"`);
        
        // 调试：输出所有段旋转后的实际位置
        console.debug(`[${ts()}] 旋转后段位置：`, segments.map((s, i) => {
          const rotatedAngle = ((s.angle + effectiveRot0) % 360 + 360) % 360;
          return `${s.slotNo}.${s.name}@${rotatedAngle.toFixed(1)}°`;
        }));
      }
      this.setData(base);
      // 清理一次性强制候选，避免后续复用
      this._forcedRecs = null;
      // 初始化完成后，移除禁用动画类，允许后续旋转动画生效
      if (!preserveRotation) {
        wx.nextTick(() => {
          setTimeout(() => {
            this.setData({ spinClass: '' });
            this._initInProgress = false;
          }, 0);
        });
      }
      // 后台静默预加载本轮选项图标，减少图片显示延迟
      try { this.preloadSegmentIcons(segments); } catch(_) {}

      // 根据当前 palette + 扇区数生成动态背景（非餐厅使用动态、餐厅保持 CSS 固定20片）
      try {
        const bg = this.computeWheelBackground(this.data.currentPaletteKey, segments.length, this.data.wheelType);
        this.setData({ wheelBackground: bg });
      } catch (eBg) {
        console.warn('[轮盘背景] 生成失败，回退到 CSS 类', eBg);
        this.setData({ wheelBackground: '' });
      }
    } catch(e) {
      console.error(`[${ts()}] 初始化轮盘失败`, e);
      this.setData({ segments: [], selected: null, showDecisionLayer: false, displayOrder: [] });
    }
  },

  // 计算轮盘背景：根据 currentPaletteKey 与扇区数生成 conic-gradient（非餐厅动态，餐厅返回空串保留 CSS）
  computeWheelBackground(paletteKey, count, wheelType) {
    try {
      // 餐厅保持 20 片固定配色，使用 CSS 类
      if (wheelType === 'restaurant') return '';
      const n = Math.max(1, Number(count || 0));
      const step = 360 / n;
      // 策略A：复用现有调色板的颜色序列
      const paletteMap = {
        s1: ['#ffadbb','#fdc7cd','#fed7da','#c9d4f7','#acbfeb','#f6d6c3'],
        s2: ['#ffd5d9','#ffc8d0','#e1f9e8','#d1e9f4','#c2d7f3','#778ccc'],
        s3: ['#9adbc5','#a1dee0','#dfde6c','#fcc351','#fd8d6e','#fa86a9'],
        s4: ['#fcedbe','#f7cf83','#ef836c','#f8c9d5','#ee84a8','#d35b7e'],
        s5: ['#fecbba','#fe98a7','#fd8c67','#fdb78e','#fef0b9','#fad354'],
        s6: ['#eeeae8','#e7d3ed','#c5a6c4','#fac4d5','#fa9daf','#b0d097'],
        s7: ['#fbf1d7','#fad6b5','#faadac','#fcfde5','#daf1ee','#b6e3e7'],
        s8: ['#feb2da','#d495e0','#ad8fdc','#8475c5','#86dcf4','#71bcec'],
        s9: ['#f7e8c9','#ffbdb9','#f17172','#cee9dc','#a4ceb7','#c09f7e'],
        a:  ['#0f172a','#1f2937','#374151','#4b5563','#6b7280','#94a3b8','#cbd5e1','#e2e8f0','#9ca3af','#64748b','#475569','#334155'],
        b:  ['#ff6b35','#f7931e','#ffd23f','#06ffa5','#00d4ff','#7b68ee','#ff1493','#ff69b4','#ff4500','#ffa500','#32cd32','#1e90ff'],
        f:  ['#ffe4e6','#fecdd3','#fbcfe8','#e9d5ff','#dbeafe','#bae6fd','#bbf7d0','#dcfce7','#fef9c3','#ffedd5','#fde68a','#c7d2fe'],
        g:  ['#111827','#f59e0b','#0ea5e9','#ef4444','#10b981','#a855f7','#f43f5e','#22c55e','#eab308','#3b82f6','#fb7185','#9333ea']
      };
      const key = String(paletteKey || 's1');
      const colors = paletteMap[key] || paletteMap['s1'];
      const parts = [];
      for (let i = 0; i < n; i++) {
        const color = colors[i % colors.length];
        const start = (i * step).toFixed(4);
        const end = ((i + 1) * step).toFixed(4);
        parts.push(`${color} ${start}deg ${end}deg`);
      }
      const gradient = `background: conic-gradient(${parts.join(', ')});`;
      return gradient;
    } catch (e) {
      console.warn('[轮盘背景] 计算失败', e);
      return '';
    }
  },

  // 静默预加载当前轮盘选项的云端图片（不阻塞UI）
  preloadSegmentIcons(segments) {
    try {
      if (!Array.isArray(segments) || segments.length === 0) return;
      const names = [];
      for (const s of segments) {
        const icon = s && s.icon;
        if (typeof icon === 'string' && icon.indexOf('cloud://') === 0) {
          const lastSlash = icon.lastIndexOf('/');
          const filename = lastSlash >= 0 ? icon.substring(lastSlash + 1) : icon;
          const dot = filename.lastIndexOf('.');
          const base = dot > 0 ? filename.substring(0, dot) : filename;
          if (base && base !== 'placeholder') names.push(base);
        } else if (s && s.name) {
          try {
            const map = this.getPinyinMap && this.getPinyinMap();
            const py = map && map[s.name] ? map[s.name] : s.name;
            if (py && typeof py === 'string' && py !== 'placeholder') names.push(py);
          } catch (_) {}
        }
      }
      const uniqueNames = Array.from(new Set(names));
      if (uniqueNames.length) {
        const p = cloudImageManager.preloadImages(uniqueNames);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) {
      console.warn('预加载段图标出错', e);
    }
  },


  onReroll() {
    // 初始化阶段或动画期间，禁止再次触发
    if (this.data.isSpinning || this._initInProgress) return;
    const sel = this.data.selected;
    if (sel) {
      const userData = getUserData();
      updateRestaurantScore(userData, String(sel.id), 'reject', { name: sel.name });
      if (this.data.wheelType === 'restaurant') { try { updateUserPreference(String(sel.id), 'dislike'); } catch(e) {} }
      try { addDecisionRecord({ id: String(sel.id), name: sel.name, action: 'reject', source: 'roulette', wheelType: this.data.wheelType }); } catch(e) {}
    }

    // 若达到4次且标记待刷新，并且不是外卖转盘：执行特殊刷新（保留前5，后7替换为13~19），并自动旋转一次
    if (this._pendingAutoRefresh && this.data.wheelType !== 'takeout') {
      const oldSegments = (this.data.segments || []).map(s => ({ id: s.id, name: s.name }));
      // 隐藏结果浮层与分享区，清空选中，并重置计数
      this.setData({ showDecisionLayer: false, showShareArea: false, selected: null, spinCounter: 0 });

      // 构造强制候选：保留前5（来自当前segments），后7按优先级基准列表窗口偏移顺延（循环）
      let forcedRecs = [];
      try {
        if (this.data.wheelType === 'restaurant') {
          const first5 = (this.data.segments || []).slice(0, 5).map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            dynamicPromotions: [],
            brands: Array.isArray(s.brands) ? s.brands : [],
            iconClass: s.iconClass,
            typeClass: s.typeClass,
            tags: Array.isArray(s.tags) ? s.tags : []
          }));

          const base = Array.isArray(this._basePriorityList) ? this._basePriorityList : [];
          if (base.length >= 20) {
            const baseLen = base.length;
            const need = 20 - first5.length; // 后续填满到20
            const nextOffset = ((this._priorityOffset || 0) + need) % baseLen;
            this._priorityOffset = nextOffset;
            const backN = Array.from({ length: need }, (_, i) => base[(5 + nextOffset + i) % baseLen]);
            forcedRecs = first5.concat(backN).slice(0, 20);
            console.debug(`[${ts()}] 窗口顺延：后${need}替换为优先级列表的后续${need}个（offset=${nextOffset}，baseLen=${baseLen}）`);
          } else {
            const userData = getUserData();
            const fallback = generateRecommendations(userData, 20) || [];
            forcedRecs = first5.concat(fallback.slice(first5.length)).slice(0, 20);
            console.debug(`[${ts()}] 优先级基准不足，回退通用推荐(20)`);
          }
        } else if (this.data.wheelType === 'beverage' && typeof this.generateBeverageRecommendations === 'function') {
          forcedRecs = this.generateBeverageRecommendations();
        }
      } catch(e) {
        console.warn('构造窗口顺延候选失败，回退普通刷新：', e);
      }

      if (forcedRecs && (this.data.wheelType === 'restaurant' ? forcedRecs.length === 20 : forcedRecs.length > 0)) {
        this._forcedRecs = forcedRecs;
      }

      console.debug(`[${ts()}] 再转一次：达到4次未接受/确认，执行特殊刷新（保留前5+替换后7为13~19），并自动旋转`);
      this.initWheel(false);

      // 等待初始化完成后，比较前后选项变化，并自动触发一次旋转
      const afterInit = () => {
        if (this._initInProgress) { setTimeout(afterInit, 16); return; }
        const newSegments = (this.data.segments || []).map(s => ({ id: s.id, name: s.name }));
        const changes = [];
        const maxLen = Math.max(oldSegments.length, newSegments.length);
        for (let i = 0; i < maxLen; i++) {
          const oldName = oldSegments[i] && oldSegments[i].name;
          const newName = newSegments[i] && newSegments[i].name;
          if (oldName !== newName) {
            changes.push({ 位置: i + 1, 之前: oldName || '(空)', 之后: newName || '(空)' });
          }
        }
        console.debug(`[${ts()}] 刷新后选项变化（位置1-${newSegments.length}）：`, changes);
        this._pendingAutoRefresh = false;
        try { this.spinRoulette(); } catch(e) { console.warn('自动旋转触发失败:', e); }
      };
      try { wx.nextTick(() => setTimeout(afterInit, 0)); } catch (_) { setTimeout(afterInit, 0); }
      return; // 特殊刷新路径结束
    }

    // 默认路径：隐藏结果浮层与分享区，清空选中，然后自动旋转
    this.setData({ showDecisionLayer: false, showShareArea: false, selected: null });

    // 刷新后自动旋转：先刷新12个推荐并完成显示（瞬时对齐），再在初始化完成后触发旋转
    const refreshCount = this.data.wheelType === 'restaurant' ? 20 : ((this.data.segments && this.data.segments.length) || 0);
    console.debug(`[${ts()}] 再转一次：换一批推荐（${refreshCount}家），并将指针对齐第1名，同时自动旋转`);
    this.initWheel(false);

    // 等待 _initInProgress 复位（移除 no-transition），再触发与点击开始按钮一致的旋转动画
    const trySpin = () => {
      if (this._initInProgress) {
        setTimeout(trySpin, 16); // 下一帧再试，避免与初始化冲突
      } else {
        this.spinRoulette();
      }
    };
    try { wx.nextTick(() => setTimeout(trySpin, 0)); } catch (_) { setTimeout(trySpin, 0); }
  },

  async onAccept() {
    const sel = this.data.selected;
    if (!sel) return;
    const userData = getUserData();
    updateRestaurantScore(userData, String(sel.id), 'accept', { name: sel.name });
    if (this.data.wheelType === 'restaurant') { try { updateUserPreference(String(sel.id), 'like'); } catch(e) {} }
    try { addDecisionRecord({ id: String(sel.id), name: sel.name, action: 'accept', source: 'roulette', wheelType: this.data.wheelType }); } catch(e) {}
    
    // 添加积分：餐厅选择
    try { addPoints('restaurant_accept', `${sel.id}_${Date.now()}`); } catch(e) { console.warn('addPoints restaurant_accept error', e); }

    // 锁定分享餐厅，生成文案并展示分享区，隐藏结果浮层，同时重置旋转计数
    this.setData({ shareTargetName: sel.name, showShareArea: true, showDecisionLayer: false, spinCounter: 0 });
    this.loadShareText();
    try { wx.showLoading({ title: '查询优惠中...' }); } catch (e) { wx.showToast({ title: '查询优惠中...', icon: 'loading', duration: 60000 }); }
    // 接受后清除待刷新标记，避免误触发特殊刷新
    this._pendingAutoRefresh = false;

    // 新“领券”流程：根据餐厅名拉取 platform 1 和 platform 2(bizLine:1) 商品并合并展示
    try {
      const name = String(sel.name || '').trim();
      const logo = sel.icon || '';
      if (!name) return;
      const qName = this.cleanRestaurantName ? this.cleanRestaurantName(name) : name;
      const loc = this.data.userLocation || wx.getStorageSync('userLocation') || {};
      const lat = (loc && typeof loc.latitude === 'number') ? loc.latitude : undefined;
      const lng = (loc && typeof loc.longitude === 'number') ? loc.longitude : undefined;
      const wmRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 1, searchText: qName, latitude: lat, longitude: lng } });
      const osRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 2, bizLine: 1, searchText: qName, latitude: lat, longitude: lng } });
      const list1 = this._mapMeituanItemsToProducts(wmRes && wmRes.result);
      const list2 = this._mapMeituanItemsToProducts(osRes && osRes.result);
      // 合并并按 skuViewId 去重
      const seen = new Set();
      let merged = ([]).concat(list1 || [], list2 || []).filter(it => {
        const id = String(it && it.skuViewId || '').trim();
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      // 将 cloud:// 头图转换为临时 HTTPS
      try {
        const fileIds = merged.filter(x => typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0).map(x => x.headUrl);
        if (fileIds.length && wx.cloud && wx.cloud.getTempFileURL) {
          const r = await wx.cloud.getTempFileURL({ fileList: fileIds });
          const map = {};
          const fl = (r && r.fileList) || [];
          for (const item of fl) { if (item && item.fileID) map[item.fileID] = item.tempFileURL || ''; }
          merged = merged.map(x => {
            if (typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0) {
              const t = map[x.headUrl];
              return { ...x, headUrl: (t && t.indexOf('http') === 0) ? t : this.data.placeholderImageUrl };
            }
            return x;
          });
        }
      } catch (eUrl) { console.warn('[Index][领券] 临时URL转换失败', eUrl); }

      // 若无任何商品，则提示并不跳转
      if (!merged || !merged.length) {
        try { wx.hideLoading(); } catch (_) {}
        wx.showToast({ title: '该餐厅目前无优惠。', icon: 'none' });
        return;
      }

      // 跳转品牌详情页并通过 eventChannel 传入合并商品列表
      wx.navigateTo({
        url: `/pages/brand/detail?name=${encodeURIComponent(name)}${logo ? `&logo=${encodeURIComponent(logo)}` : ''}`,
        success: (res) => { try { res.eventChannel.emit('initData', { products: merged }); } catch(e) {} },
        fail: (err) => { console.warn('[Index][领券] 跳转品牌详情失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
      });
      try { wx.hideLoading(); } catch (_) {}
    } catch (e) {
      console.warn('[Index][领券] 拉取商品失败', e);
      try { wx.hideLoading(); } catch (_) {}
      wx.showToast({ title: '领券服务暂不可用', icon: 'none' });
    }
  },

  // 将美团云函数返回的数据映射为品牌详情页可用的商品对象
  _mapMeituanItemsToProducts(res) {
    const root = res && (res.data || res);
    const arr = Array.isArray(root && root.data)
      ? root.data
      : (Array.isArray(root && root.list)
        ? root.list
        : (Array.isArray(root && root.items) ? root.items : []));
    const parseNum = (v) => { const n = (typeof v === 'string') ? parseFloat(v) : (typeof v === 'number' ? v : NaN); return isFinite(n) ? n : 0; };
    return (arr || []).map(it => {
      const skuViewId = String(it?.couponPackDetail?.skuViewId || it?.skuViewId || '').trim();
      const brandName = it?.brandInfo?.brandName || it?.brandName || this.data.shareTargetName || '';
      const name = it?.couponPackDetail?.name || it?.name || it?.title || '';
      let headUrl = it?.couponPackDetail?.headUrl || it?.headUrl || it?.imgUrl || it?.image || it?.picUrl || '';
      if (typeof headUrl === 'string' && headUrl.startsWith('http://')) headUrl = 'https://' + headUrl.slice(7);
      const originalPrice = parseNum(it?.couponPackDetail?.originalPrice || it?.originalPrice || it?.originPrice);
      const sellPrice = parseNum(it?.couponPackDetail?.sellPrice || it?.sellPrice || it?.price || it?.currentPrice);
      return { skuViewId, brandName, name, headUrl, originalPrice, sellPrice };
    }).filter(x => !!x.skuViewId);
  },

  // 自动刷新：若连续旋转4次未接受/确认，则设置待刷新标记（不对外卖转盘生效，不立即刷新，不隐藏浮层）
  autoRefreshWheelIfNeeded() {
    const count = this.data.spinCounter || 0;
    if (count >= 4) {
      if (this.data.wheelType === 'takeout') {
        console.debug(`[${ts()}] 自动刷新跳过：外卖转盘不生效（当前计数=${count}）`);
        return;
      }
      console.debug(`[${ts()}] 自动刷新满足条件：连续旋转${count}次未接受/确认，标记待刷新，等待用户点击“再转一次”执行刷新`);
      this._pendingAutoRefresh = true;
    }
  },

  // 导航到餐厅位置
  onNavigateToRestaurant() {
    const selected = this.data.selected;
    if (!selected) {
      wx.showToast({
        title: '请先选择餐厅',
        icon: 'none'
      });
      return;
    }

    // 获取餐厅的位置信息
    // 获取餐厅的位置信息（优先真实数据，其次 segments 透传，再回退模拟）
    let latitude, longitude, address;
    
    if (selected.amapData && selected.amapData.latitude != null && selected.amapData.longitude != null) {
      // 从高德API数据中获取位置信息
      latitude = selected.amapData.latitude;
      longitude = selected.amapData.longitude;
      address = selected.amapData.address || selected.address || selected.name;
    } else if (selected.latitude != null && selected.longitude != null) {
      // 使用segments透传的基础经纬度字段
      latitude = selected.latitude;
      longitude = selected.longitude;
      address = selected.address || selected.name;
    } else {
      // 使用模拟数据（当前阶段）
      console.debug('[导航测试] 使用模拟数据进行导航功能测试');
      
      // 模拟数据映射
      const mockLocationData = {
        '海底捞火锅': { latitude: 31.2304, longitude: 121.4737, address: '上海市浦东新区陆家嘴环路1000号' },
        '麦当劳': { latitude: 31.2280, longitude: 121.4750, address: '上海市浦东新区世纪大道1号' },
        '星巴克': { latitude: 31.2320, longitude: 121.4720, address: '上海市浦东新区银城中路501号' },
        '必胜客': { latitude: 31.2250, longitude: 121.4780, address: '上海市浦东新区东方路800号' },
        '肯德基': { latitude: 31.2290, longitude: 121.4760, address: '上海市浦东新区浦东南路1200号' },
        '西贝莜面村': { latitude: 31.2200, longitude: 121.4800, address: '上海市浦东新区张杨路1500号' },
        '外婆家': { latitude: 31.2180, longitude: 121.4820, address: '上海市浦东新区花木路1800号' },
        '绿茶餐厅': { latitude: 31.2260, longitude: 121.4790, address: '上海市浦东新区民生路1300号' },
        '呷哺呷哺': { latitude: 31.2310, longitude: 121.4730, address: '上海市浦东新区陆家嘴西路168号' },
        '真功夫': { latitude: 31.2270, longitude: 121.4770, address: '上海市浦东新区世纪大道1568号' }
      };
      
      const mockData = mockLocationData[selected.name];
      if (mockData) {
        latitude = mockData.latitude;
        longitude = mockData.longitude;
        address = mockData.address;
      } else {
        // 默认位置（上海陆家嘴）
        latitude = 31.2304;
        longitude = 121.4737;
        address = '上海市浦东新区陆家嘴';
      }
    }

    // 调用微信内置地图
    wx.openLocation({
      latitude: latitude,
      longitude: longitude,
      name: selected.name,
      address: address,
      scale: 18,
      success: () => {
        console.debug('[导航] 成功打开微信地图导航');
        // 记录用户行为
        try {
          const { addDecisionRecord } = require('../../utils/decisionManager');
          addDecisionRecord({
            id: String(selected.id),
            name: selected.name,
            action: 'navigate',
            source: 'roulette',
            wheelType: this.data.wheelType
          });
        } catch(e) {
          console.warn('[导航] 记录决策失败:', e);
        }
      },
      fail: (err) => {
        console.error('[导航] 打开微信地图失败:', err);
        wx.showToast({
          title: '导航失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到美团（短链方式），并在跳转前复制餐厅名到剪贴板
  onJumpToMeituan() {
    const { wheelType, selected } = this.data;
    if (!(wheelType === 'takeout' || wheelType === 'beverage' || wheelType === 'restaurant')) {
      return;
    }
    const name = selected && selected.name ? String(selected.name).trim() : '';
    if (!name) {
      wx.showToast({ title: '请先选择餐厅', icon: 'none' });
      return;
    }
    this._doMeituanJump(name);
  },

  // 统一的美团跳转逻辑：复制关键词并跳转到对应短链
  _doMeituanJump(name) {
    const { wheelType } = this.data;
    const keyword = name ? String(name).trim() : '';
    if (!keyword) { return; }
    wx.setClipboardData({
      data: keyword,
      success: () => {
        wx.showToast({ title: '已复制，跳转后粘贴搜索', icon: 'none', duration: 1200 });
        setTimeout(() => {
          const shortLink = (wheelType === 'restaurant')
            ? '#小程序://美团丨外卖团购特价美食酒店电影/ZXIVCj5kDqYPVny'
            : '#小程序://美团丨外卖团购特价美食酒店电影/i7P3M0N3oLzsFAB';
          wx.navigateToMiniProgram({ shortLink, fail: (err) => { console.warn('[跳转美团] 失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); } });
        }, 1200);
      },
      fail: (err) => { console.warn('[剪贴板] 复制失败', err); wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' }); }
    });
  },

  onAddShortlist: async function() {
    const sel = this.data.selected;
    if (!sel) return;
    const list = (Array.isArray(this.data.shortlist) ? this.data.shortlist : []).slice(0,3);
    
    // 优化的重复判断逻辑：主要按id判断，仅在特定情况下按name判断
    const isDuplicate = list.some(x => {
      const xName = String(x.name || '').trim();
      const selName = String(sel.name || '').trim();
      return xName && selName && xName === selName;
    });
    
    console.debug('[备选区] 重复检查详情:', {
      selected: { 
        id: sel.id, 
        name: sel.name, 
        address: sel.address,
        isUserAdded: sel.id && String(sel.id).startsWith('user_added_'),
        isAmap: sel.id && String(sel.id).startsWith('amap_')
      },
      shortlist: list.map(x => ({ 
        id: x.id, 
        name: x.name, 
        address: x.address,
        isUserAdded: x.id && String(x.id).startsWith('user_added_'),
        isAmap: x.id && String(x.id).startsWith('amap_')
      })),
      isDuplicate
    });
    
    if (isDuplicate) { 
      wx.showToast({ title: '该餐厅已在备选', icon: 'none' });
      return; 
    }
    if (list.length >= 3) { 
      wx.showToast({ title: '备选区已满，请先删除', icon: 'none' });
      // 备选区已满时，不隐藏浮层，让用户可以继续操作
      return; 
    }
    // 构造条目，先设置临时图标以提升点击反馈（乐观更新）
    let item = { ...sel };
    const iconStr = typeof item.icon === 'string' ? item.icon : '';
    const isCloud = iconStr.indexOf('cloud://') === 0;
    const wt = this.data.wheelType;
    const typeName = (wt === 'takeout') ? 'takeout' : (wt === 'beverage') ? 'beverage' : 'canteen';
    const provisionalIcon = (isCloud || !iconStr)
      ? (this.data.placeholderImageUrl || cloudImageManager.getCloudImageUrlSync(typeName, 'png'))
      : iconStr;
    item.icon = provisionalIcon;

    // 立即加入备选并隐藏结果浮层
    list.push(item);
    this.setData({ shortlist: list, showDecisionLayer: false });
    this.updatePlaceholderSlots && this.updatePlaceholderSlots();
    wx.showToast({ title: '已加入备选', icon: 'success' });

    // 异步更新备选卡片图标：不再尝试云端临时链接，直接使用本地兜底
    setTimeout(() => {
      try {
        if (isCloud) {
          const curr = Array.isArray(this.data.shortlist) ? [...this.data.shortlist] : [];
          const idx = curr.findIndex(x => String(x.id) === String(item.id));
          if (idx >= 0) {
            curr[idx].icon = cloudImageManager.getCloudImageUrlSync(typeName, 'png');
            this.setData({ shortlist: curr });
          }
        }
      } catch (err) {
        console.warn('onAddShortlist async local fallback failed', err);
      }
    }, 0);
  },

  onRemoveShort(e) {
    const id = e.currentTarget.dataset.id;
    const nextList = Array.isArray(this.data.shortlist) ? this.data.shortlist.filter(x => String(x.id) !== String(id)) : [];
    const activeIdx = this.data.activeShortlistIndex;
    const removedIdx = (this.data.shortlist || []).findIndex(x => String(x.id) === String(id));
    const shouldClearActive = removedIdx === activeIdx;
    this.setData({
      shortlist: nextList,
      activeShortlistId: '',
      activeShortlistIndex: shouldClearActive ? -1 : (activeIdx > removedIdx ? activeIdx - 1 : activeIdx),
      showShareArea: shouldClearActive ? false : this.data.showShareArea
    });
    this.updatePlaceholderSlots();
  },

  onTapShortlistCard(e) {
    const { id, name, idx } = e.currentTarget.dataset;
    if (!id || !name || typeof idx === 'undefined') return;
    const current = this.data.activeShortlistIndex;
    // 单选：若点击的是当前选中项则取消选中
    if (current === idx) {
      this.setData({ activeShortlistIndex: -1, shareTargetName: '', showShareArea: false });
      return;
    }
    // 选中新的卡片
    this.setData({ activeShortlistIndex: idx, shareTargetName: name, showShareArea: true });
    this.loadShareText();
  },

  onShortConfirm(e) {
    const { id, name, idx } = e.currentTarget.dataset;
    if (!id || typeof idx === 'undefined') return;
    const list = this.data.shortlist || [];
    const sel = list[idx];
    if (!sel || String(sel.id) !== String(id)) return;
    const userData = getUserData();
    updateRestaurantScore(userData, String(sel.id), 'accept', { name: sel.name });
    if (this.data.wheelType === 'restaurant') { try { updateUserPreference(String(sel.id), 'like'); } catch(e) {} }
    try { addDecisionRecord({ id: String(sel.id), name: sel.name, action: 'accept', source: 'shortlist', wheelType: this.data.wheelType }); } catch(e) {}
    
    // 添加积分：备选区餐厅选择
    try { addPoints('restaurant_accept', `shortlist_${sel.id}_${Date.now()}`); } catch(e) { console.warn('addPoints restaurant_accept error', e); }
    
    // 交互反馈：锁定分享对象并展示分享区，同时取消选中态，并重置旋转计数
    this.setData({ shareTargetName: sel.name, showShareArea: true, activeShortlistIndex: -1, spinCounter: 0 });
    // 短名单确认后清除待刷新标记
    this._pendingAutoRefresh = false;
    this.loadShareText();
    wx.showToast({ title: '已记录，就它了', icon: 'success' });

    // 外卖/茶饮：快捷“就它”后继续跳转美团
    if (this.data.wheelType === 'takeout' || this.data.wheelType === 'beverage') {
      const nameToJump = String(sel.name || '').trim();
      if (nameToJump) { this._doMeituanJump(nameToJump); }
    }
  },

  onCopyShare() {
    const text = this.data.shareText || '今天吃什么？';
    wx.setClipboardData({ data: text, success: () => wx.showToast({ title: '已复制，可转发好友', icon: 'success' }) });
  },

  onRefreshShare() {
    const prev = this.data.shareText || '';
    this.loadShareText(prev);
    // 不需要额外提示框
  },

  // 生成/刷新分享文案
  loadShareText(prev = '') {
    try {
      const name = this.data.shareTargetName || (this.data.selected && this.data.selected.name) || '';
      let wordings = [];
      try {
        // 优先尝试从 shareWording.js 读取（存在则使用）
        const mod = require('../../shareWording.js');
        const json = Array.isArray(mod) ? mod : (mod && mod.wordings ? mod.wordings : []);
        if (Array.isArray(json)) {
          wordings = json;
        }
      } catch (e) {
        // 读取失败时使用内置备选文案
        wordings = [
          '今天吃什么？',
          '不如让它来决定吧！',
          '一起去吃吧～',
          '我选这个，走起！'
        ];
      }

      // 拼装候选文案：统一从预设模板随机选择，并进行占位符替换
      const candidates = Array.isArray(wordings) && wordings.length
        ? wordings.map(t => (t || '').replace('{restaurant}', name || '它'))
        : [];

      // 去重并规避与上一条重复
      const uniq = Array.from(new Set(candidates)).filter(t => t && t !== prev);
      const chosen = uniq.length ? uniq[Math.floor(Math.random() * uniq.length)] : (prev || '让它来决定吧！');

      this.setData({ shareText: chosen });
    } catch (e) {
      console.warn('loadShareText error', e);
      this.setData({ shareText: '让它来决定吧！' });
    }
  },

  onShareAppMessage() {
    const promise = new Promise(resolve => {
      // 积分增加逻辑已移动到 shareToWeChat 函数中，避免重复加分
      // 尝试生成转盘区域截图
      this.captureRouletteArea().then(imagePath => {
        resolve({ 
          title: '让它来决定吧！',
          imageUrl: imagePath 
        });
      }).catch(() => {
        // 截图失败时仅返回文案
        resolve({ title: '让它来决定吧！' });
      });
    });
    return {
      title: '让它来决定吧！',
      path: '/pages/index/index',
      promise
    };
  },

  /** 顶部问候与时间 **/
  updateDateTime() {
    const now = new Date();
    const h = now.getHours();
    let greeting = 'Good Evening';
    if (h < 12) greeting = 'Good Morning';
    else if (h < 18) greeting = 'Good Afternoon';

    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    this.setData({ greeting, currentTime: `It's ${time}, ${day}` });
  },

  /** 获取品牌拼音映射（统一使用模块数据） */
  getPinyinMap() {
    return pinyin;
  },

  getPackageAFullIcons() {
    return [
      'Baker&Spice','bifengtang','diandude','dingtaifeng','duxiaoyue','haidilao','hefulaomian','jiangbianchengwai','jiyejia','lugangxiaozhen','lvchacanting','naixuedecha','nanjingdapaidang','nanxiangmantoudian','shiqijia','shudufeng','songwu','taiersuancaiyu','tanggong','waipojia','wangxiangyuan','weiqianlamian','xiabuxiabu','xiaoyangshengjian','xibeiyoumiancun','xicha','xingbake','xinyuansu','yelixiali','yifengtang','yunhaiyao','chaojiwan','chenxianggui','hanbaowang','kendeji','lanwa','maidanglao','majiyong','putiancanting','shudaxia','wogesi','tanyaxie','placeholder'
    ];
  },
  getPackageBFullIcons() {
    return [
      'axiangmixian','bangyuehan','banumaoduhuoguo','bishengke','cailangangshidianxin','cocodouke','coucouhuoguo','dalongyi','dameile','damixiansheng','daniangshuijiao','diantaixianghuoguo','fengmaokaochuan','gelaoguan','guimanlong','guoqiaomixian','gutiandaoxiang','henjiuyiqianyangrouchuan','hudafandian','jixianghuntun','laoshengchang','lelecha','malayouhuo','muwushaokao','qifentian','saliya','suxiaoliu','tangxiansheng','tianhaoyun','wanguizhimian','xiaolongkan','xiaonanguo','xinbailu','xinxianghui','yidiandian','yonghedawang','zhenggongfu','zuotingyouyuan'
    ];
  },

  // 根据餐厅名称返回图标路径（找不到时回退到占位图）
  getRestaurantIconPath(name) {
    try {
      const map = this.getPinyinMap();
      const pkgA = this.getPackageAFullIcons();
      const pkgB = this.getPackageBFullIcons();

      let key = map && name ? (map[name] || name) : (name || 'placeholder');

      // 直配命中
      if (pkgA.includes(key) || pkgB.includes(key)) {
        return cloudImageManager.getCloudImageUrlSync(key);
      }

      // 常见归一化尝试
      const variants = [];
      if (key) {
        variants.push(String(key).replace(/\s+/g, ''));
        variants.push(String(key).toLowerCase());
        variants.push(String(key).replace(/\s+/g, '').toLowerCase());
      }

      for (const v of variants) {
        if (pkgA.includes(v) || pkgB.includes(v)) {
          return cloudImageManager.getCloudImageUrlSync(v);
        }
      }

      // 兜底占位图（统一占位图）
      return cloudImageManager.getPlaceholderUrlSync();
    } catch (e) {
      console.warn('getRestaurantIconPath 解析失败，使用占位图:', e);
      return cloudImageManager.getPlaceholderUrlSync();
    }
  },

  // 初始化轮盘（12个推荐，旧实现：仅餐厅）
  initWheelLegacy(preserveRotation = false) {
    try {
      // 初始化阶段：禁用过渡动画，防止旋转动画在对齐时出现（legacy）
      if (!preserveRotation) {
        this._initInProgress = true;
        this.setData({ spinClass: 'no-transition' });
      }
      // 用于变更对比的上一轮推荐（按 slotNo 记录）
      const prevSegments = Array.isArray(this.data.segments) ? this.data.segments : [];
      const prevBySlot = {};
      for (const s of prevSegments) {
        if (s && s.slotNo) prevBySlot[s.slotNo] = s.name || '';
      }

      const userData = getUserData();
      const count = this.data.wheelType === 'restaurant' ? 20 : 12;
      const recs = generateRecommendations(userData, count);
      const fmt = (v) => (typeof v === 'number' ? Number(v).toFixed(2) : '--');
      console.debug(`[${ts()}] 推荐列表(生成/刷新${count}项)：`, recs.map((r, i) => `${i+1}.${r && r.name ? r.name : ''} [总:${fmt(r && r.recommendationScore)} 评:${fmt(r && r.specificScore)} 偏:${fmt(r && r.preferenceScore)}]`));
      const step = 360 / count;
      const { wheelRadius, labelOuterMargin, labelInnerMargin, labelMinStep, labelMaxStep } = this.data;
      const pointerAngle = 0; // 修正：指针在CSS中位于top位置，对应0°

      // 保持推荐顺序(1..12)，不因指针对齐而重排
      const segments = Array.from({ length: count }, (_, idx) => {
        const r = recs[idx];
        const rawName = (r && r.name) ? r.name : '';
        const name = this.cleanRestaurantName(rawName);
        const labelName = this.truncateRestaurantLabel(name, 12);
        const nameChars = String(labelName).split('');
        const outer = Math.max(0, wheelRadius - labelOuterMargin);
        const inner = Math.max(0, labelInnerMargin);
        const available = Math.max(0, outer - inner);
        let chars = [];
        if (nameChars.length <= 1) {
          chars = [{ ch: nameChars[0] || '', pos: Math.max(inner, Math.min(outer, Math.round((outer + inner) / 2))) }];
        } else {
          const rawStep = available / (nameChars.length - 1);
          const stepLen = Math.max(labelMinStep, Math.min(labelMaxStep, rawStep));
          const start = outer; // 从外沿开始
          chars = nameChars.map((ch, cidx) => ({ ch, pos: Math.max(inner, Math.round(start - cidx * stepLen)) }));
        }
        return {
          id: String(r.id),
          name,
          type: r.type,
          icon: (this.data.wheelType === 'takeout') ? cloudImageManager.getCloudImageUrl('takeout', 'png') : (this.data.wheelType === 'beverage') ? cloudImageManager.getCloudImageUrl('beverage', 'png') : this.getRestaurantIconPath(name),
          promoText: r.dynamicPromotions && r.dynamicPromotions[0] ? r.dynamicPromotions[0].promoText : '',
          angle: idx * step + step / 2, // 该段中心角（相对轮盘自身坐标系）
          slotNo: idx + 1,
          // 分数（仅用于日志/调试）
          specificScore: (r && typeof r.specificScore === 'number') ? r.specificScore : undefined,
          preferenceScore: (r && typeof r.preferenceScore === 'number') ? r.preferenceScore : undefined,
          recommendationScore: (r && typeof r.recommendationScore === 'number') ? r.recommendationScore : undefined,
          // 结果浮层使用的可选字段（外卖/茶饮）
          brands: Array.isArray(r && r.brands) ? r.brands : [],
          iconClass: r && r.iconClass,
          typeClass: r && r.typeClass,
          tags: Array.isArray(r && r.tags) ? r.tags : [],
          chars
        };
      });

      // 维护显示顺序：编号 -> 扇区索引（恒等映射）
      const displayOrder = new Array(count);
      for (let i = 0; i < count; i++) {
        const s = segments[i];
        displayOrder[(s.slotNo || 0) - 1] = i;
      }

      const listLog = segments.map(s => `${s.slotNo}.${s.name} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`);
      console.debug(`[${ts()}] 生成转盘(12)：`, listLog);

      // 输出变更状态日志（对比上一轮）
      if (prevSegments && prevSegments.length) {
        const diffLines = segments.map(s => {
          const prevName = prevBySlot[s.slotNo] || '';
          let status = '';
          if (!prevName) status = '新';
          else if (prevName === s.name) status = '未变';
          else status = `变更(原: ${prevName})`;
          return `${s.slotNo}. ${s.name} — ${status} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`;
        });
        console.debug(`[${ts()}] 换一批后推荐列表（带变更标记）：\n${diffLines.join('\n')}`);
      } else {
        const initLines = segments.map(s => `${s.slotNo}. ${s.name} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`);
        console.debug(`[${ts()}] 初始推荐列表：\n${initLines.join('\n')}`);
      }

      // 调试：输出所有段的角度位置
      console.debug(`[${ts()}] 段角度调试：`, segments.map((s, i) => `${s.slotNo}.${s.name}@${s.angle}°`));

      const base = { segments, selected: null, showDecisionLayer: false, displayOrder };
      if (!preserveRotation) {
        // 让 slot 1(segments[0]) 的中心角对齐到 pointerAngle
        const s0Angle = segments[0].angle; // step/2
        const rotationOffset = ((pointerAngle - s0Angle) % 360 + 360) % 360;
        base.rouletteRotation = rotationOffset;
        console.debug(`[${ts()}] 初始对齐：基于段中心角 s0=${s0Angle}°，设置 rotation=${rotationOffset}°`);

        // 计算此时三角形指示器所指向的餐厅（编号与名称），用于验证对齐
        const effectiveRot0 = rotationOffset;
        let hitIndex0 = 0;
        let minDiff0 = 9999;
        for (let i = 0; i < count; i++) {
          const center0 = ((segments[i].angle + effectiveRot0) % 360 + 360) % 360;
          let diff0 = Math.abs(center0 - pointerAngle);
          diff0 = Math.min(diff0, 360 - diff0);
          if (diff0 < minDiff0) { minDiff0 = diff0; hitIndex0 = i; }
        }
        const pointed = segments[hitIndex0];
        console.debug(`[${ts()}] 初始化完成：当前指向 编号=${pointed.slotNo}，餐厅="${pointed.name}"`);
        
        // 调试：输出所有段旋转后的实际位置
        console.debug(`[${ts()}] 旋转后段位置：`, segments.map((s, i) => {
          const rotatedAngle = ((s.angle + effectiveRot0) % 360 + 360) % 360;
          return `${s.slotNo}.${s.name}@${rotatedAngle.toFixed(1)}°`;
        }));
      }
      this.setData(base);
    } catch(e) {
      console.error(`[${ts()}] 初始化轮盘失败`, e);
      this.setData({ segments: [], selected: null, showDecisionLayer: false, displayOrder: [] });
    }
  },

  // 刷新推荐：重算推荐与转盘显示，重置累计旋转角，确保指针指向第1名
  onRefreshWheel() {
    if (this.data.isSpinning) return;
    const refreshCount = this.data.wheelType === 'restaurant' ? 20 : ((this.data.segments && this.data.segments.length) || 0);
    console.debug(`[${ts()}] 手动刷新：换一批推荐（${refreshCount}项），并将指针对齐第1名`);
    // 重新生成推荐并重置旋转到slot1
    this.initWheel(false);
    // 隐藏结果浮层与分享区
    this.setData({ showDecisionLayer: false, showShareArea: false, selected: null });
    // 提示刷新完成
    try { wx.showToast({ title: '转盘已刷新', icon: 'success' }); } catch(e) {}
  },

  // 旋转开始（调试版：固定720°）
  spinRoulette() {
    if (!this.data.segments.length) return;
    // 初始化阶段未结束时，禁止触发旋转
    if (this._initInProgress) return;
    if (this.data.isSpinning) return; // 防重复触发
    this.setData({ isSpinning: true });

    // 每次旋转随机动画时长：2.6s ~ 4.6s
    const minMs = 2600;
    const maxMs = 4600;
    const duration = Math.floor(minMs + Math.random() * (maxMs - minMs));
    this.setData({ spinDurationMs: duration });

    // 自增旋转计数
    this.setData({ spinCounter: (this.data.spinCounter || 0) + 1 });

    // 积分：转动转盘
    try { addPoints && addPoints('spin'); } catch (e) { console.warn('addPoints spin error', e); }

    // 恢复正常旋转：随机角度 + 多圈旋转（修正：强制正向整数圈，且停止角度在90°~270°，避免小幅度错觉）
    const minSpins = 3; // 最少3整圈
    const maxSpins = 6; // 最多6整圈
    const randomSpins = Math.floor(minSpins + Math.random() * (maxSpins - minSpins + 1)); // 保证整数圈
    const randomAngle = 90 + Math.random() * 180; // 90°~270°
    const totalDelta = randomSpins * 360 + randomAngle;
    
    console.debug(`[${ts()}] 开始转动：+${totalDelta.toFixed(1)}°（${randomSpins}圈+${randomAngle.toFixed(1)}°），当前累计角度=${this.data.rouletteRotation}`);

    // 触觉反馈：指针划过每个扇形边界时触发一次震动（全程），与CSS减速曲线对齐
    try {
      const count = this.data.segments.length;
      const stepDeg = 360 / count;
      const crossings = Math.floor(totalDelta / stepDeg); // 本次旋转将跨越的扇形边界次数

      // 清理旧的震动定时器
      if (Array.isArray(this._vibeTimers)) {
        this._vibeTimers.forEach(t => clearTimeout(t));
      }
      this._vibeTimers = [];

      // 使用与 CSS timing function 完整匹配的近似：cubic-bezier(.24,.8,.26,1)
      // 已知：属性进度 y 是时间进度 x 的函数（二次贝塞尔），我们需要找到每个角度进度 progress 对应的时间分数 x。
      // 做法：先通过二分法求参数 u 使得 y(u)=progress，再计算 x(u)，最后 timeoutMs = duration * x(u)。
      const p1x = 0.24, p1y = 0.8, p2x = 0.26, p2y = 1.0;
      const cubicCoord = (t, p1, p2) => {
        const inv = 1 - t;
        return 3 * p1 * t * inv * inv + 3 * p2 * t * t * inv + t * t * t;
      };
      const invertParamForY = (yTarget) => {
        let lo = 0, hi = 1;
        for (let k = 0; k < 22; k++) { // 22次迭代以保证收敛精度
          const mid = (lo + hi) / 2;
          const y = cubicCoord(mid, p1y, p2y);
          if (y < yTarget) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
      };

      const debounceMinMs = 25; // 更短去抖，避免抑制合法的跨界触发
      this._lastVibeTs = 0;
      for (let i = 1; i <= crossings; i++) {
        const progress = i / crossings; // 角度进度（0~1）
        const u = invertParamForY(progress);    // 参数解：y(u)=progress
        const timeFrac = cubicCoord(u, p1x, p2x); // 实际时间分数 x(u)
        const timeoutMs = Math.floor(duration * timeFrac);
        const t = setTimeout(() => {
          if (!this.data.isSpinning) return; // 已结束，不再震动
          const now = Date.now();
          if (this._lastVibeTs && (now - this._lastVibeTs) < debounceMinMs) return; // 去抖，避免连续震动
          try { wx.vibrateShort({ type: 'light' }); } catch (e) {
            try { wx.vibrateShort(); } catch (_) {}
          }
          this._lastVibeTs = now;
        }, timeoutMs);
        this._vibeTimers.push(t);
      }
    } catch (e) { /* 静默失败，不影响主流程 */ }

    this.setData({ rouletteRotation: this.data.rouletteRotation + totalDelta, showDecisionLayer: false });

    // 与动态 transition 时长（spinDurationMs）对齐，确保动画完成
    setTimeout(() => {
      try {
        const pointerAngle = 0; // 修正：指针在CSS中位于top位置，对应0°
        const count = this.data.segments.length;
        const step = 360 / count;
        const finalRotation = this.data.rouletteRotation % 360;
        const effectiveRot = (finalRotation + 360) % 360;

        let hitIndex = 0;
        let minDiff = 9999;
        for (let i = 0; i < count; i++) {
          const center = ((this.data.segments[i].angle + effectiveRot) % 360 + 360) % 360;
          let diff = Math.abs(center - pointerAngle);
          diff = Math.min(diff, 360 - diff); // 环形距离
          if (diff < minDiff) { minDiff = diff; hitIndex = i; }
        }
        const hit = this.data.segments[hitIndex];

        if (!hit || !hit.name) {
          console.error(`[${ts()}] 转盘数据异常`, { hitIndex, segments: this.data.segments, hit });
          this.setData({ isSpinning: false });
          if (Array.isArray(this._vibeTimers)) { this._vibeTimers.forEach(t => clearTimeout(t)); this._vibeTimers = []; }
          return;
        }

        // 转动结束日志：编号与命中餐厅
        console.debug(`[${ts()}] 转动结束：指针编号=${hit.slotNo}，餐厅="${hit.name}"，finalRotation=${finalRotation.toFixed(1)}，effectiveRot=${effectiveRot.toFixed(1)}，step=${step}`);

        // 命中后补齐标签（若缺失），从数据源 restaurant_data.js 获取
        try {
          if (!hit.tags || !hit.tags.length) {
            const ds = require('../../restaurant_data.js');
            const rec = Array.isArray(ds) ? ds.find(r => String(r.id) === String(hit.id) || r.name === hit.name) : null;
            if (rec && Array.isArray(rec.tags)) { hit.tags = rec.tags; }
          }
        } catch(e) { /* 静默失败，不影响主流程 */ }
        // 命中后重置首页 logo 扩展名重试计数
        // 初始化 selected 时先使用占位图，异步转换云图标为 HTTPS，避免渲染层把 cloud:// 视作本地路径
        try {
          let nameForUrl = '';
          let ext = 'png';
          const iconStr = typeof hit.icon === 'string' ? hit.icon : '';
          
          // 检查是否为手动添加的餐厅
          const isUserAdded = hit.id && typeof hit.id === 'string' && hit.id.startsWith('user_added_');
          
          if (isUserAdded) {
            // 不再对手动添加的餐厅使用占位图，允许短暂白屏；继续按常规逻辑解析 logo
            // 此分支不做特殊处理，不 return
          } else if (iconStr.indexOf('cloud://') === 0) {
            const lastSlash = iconStr.lastIndexOf('/');
            const filename = lastSlash >= 0 ? iconStr.substring(lastSlash + 1) : iconStr;
            const dot = filename.lastIndexOf('.');
            nameForUrl = dot > 0 ? filename.substring(0, dot) : filename;
            ext = dot > 0 ? (filename.substring(dot + 1) || 'png') : 'png';
          } else {
            const map = this.getPinyinMap && this.getPinyinMap();
            nameForUrl = map && hit.name ? (map[hit.name] || hit.name) : hit.name || 'placeholder';
          }
          
          // 立即显示结果浮层，但不再先用占位图，允许短暂白屏
          this.setData({ selected: hit, showDecisionLayer: true, showShareArea: false, isSpinning: false, logoRetryMap: {} });
          if (Array.isArray(this._vibeTimers)) { this._vibeTimers.forEach(t => clearTimeout(t)); this._vibeTimers = []; }
          try { this.autoRefreshWheelIfNeeded && this.autoRefreshWheelIfNeeded(); } catch(_) {}
          
          // 命中结果图标：统一使用本地兜底，不再获取云端临时链接
          const wt = this.data.wheelType;
          const typeName = (wt === 'takeout') ? 'takeout' : (wt === 'beverage') ? 'beverage' : 'canteen';
          const finalIcon = cloudImageManager.getCloudImageUrlSync(typeName, 'png');
          this.setData({ 'selected.icon': finalIcon });
        } catch (_) {
          this.setData({ selected: hit, showDecisionLayer: true, showShareArea: false, isSpinning: false, logoRetryMap: {} });
        }
      } catch (e) {
        console.error(`[${ts()}] 转盘数据异常`, e);
        this.setData({ isSpinning: false });
      }
    }, this.data.spinDurationMs);

  },

  // 维护备选占位数量（容量=3）
  updatePlaceholderSlots() {
    const n = Math.max(0, 3 - (this.data.shortlist ? this.data.shortlist.length : 0));
    // 使用索引作为唯一标识，避免wx:key重复
    this.setData({ placeholderSlots: Array(n).fill(0).map((_, index) => index) });
  },

  // 手势检测 - 触摸开始
  onTouchStart(e) {
    const touch = e.touches[0];
    console.debug('🖐️ 触摸开始:', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY,
      timestamp: Date.now()
    });
    
    this.setData({
      touchStartY: touch.clientY,
      touchStartX: touch.clientX,
      touchStartTime: Date.now()
    });
  },

  // 手势检测 - 触摸移动
  onTouchMove(e) {
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const currentTime = Date.now();
    const deltaY = this.data.touchStartY - currentY;
    const deltaTime = currentTime - this.data.touchStartTime;
    
    // 实时手势反馈（每100ms输出一次）
    if (!this._lastMoveLog || currentTime - this._lastMoveLog > 100) {
      console.debug('👆 手势移动:', {
        deltaY: deltaY.toFixed(1),
        deltaTime,
        velocity: (deltaY / deltaTime).toFixed(3),
        direction: deltaY > 0 ? '上滑' : '下滑'
      });
      this._lastMoveLog = currentTime;
    }
  },

  // 手势检测 - 触摸结束
  onTouchEnd(e) {
    const touch = e.changedTouches[0];
    const endY = touch.clientY;
    const endX = touch.clientX;
    const endTime = Date.now();
    
    const deltaY = this.data.touchStartY - endY; // 上滑为正值
    const deltaX = Math.abs(this.data.touchStartX - endX); // 水平偏移
    const deltaTime = endTime - this.data.touchStartTime;
    const velocity = deltaY / deltaTime; // px/ms
    
    console.debug('🏁 触摸结束 - 手势分析:', {
      起始位置: { x: this.data.touchStartX, y: this.data.touchStartY },
      结束位置: { x: endX, y: endY },
      垂直位移: `${deltaY.toFixed(1)}px`,
      水平位移: `${deltaX.toFixed(1)}px`,
      持续时间: `${deltaTime}ms`,
      垂直速度: `${velocity.toFixed(3)}px/ms`,
      手势方向: deltaY > 0 ? '上滑' : '下滑'
    });
    
    // 手势识别条件检查
    const conditions = {
      垂直距离: { value: deltaY, threshold: 30, passed: deltaY > 30 },
      时间限制: { value: deltaTime, threshold: 800, passed: deltaTime < 800 },
      速度要求: { value: velocity, threshold: 0.1, passed: velocity > 0.1 },
      水平偏移: { value: deltaX, threshold: 100, passed: deltaX < 100 } // 防止斜滑
    };
    
    console.debug('📋 手势识别条件检查:', conditions);
    
    const allConditionsMet = Object.values(conditions).every(c => c.passed);
    
    if (allConditionsMet) {
      console.debug('✅ 上滑手势识别成功，触发分享功能');
      this.triggerShare();
    } else {
      const failedConditions = Object.entries(conditions)
        .filter(([key, condition]) => !condition.passed)
        .map(([key]) => key);
      console.debug('❌ 上滑手势识别失败，未满足条件:', failedConditions);
    }
    
    // 清理移动日志计时器
    this._lastMoveLog = null;
  },

  // XR 场景就绪
  onXrReady({ detail }) {
    try {
      this._xrScene = detail && detail.value;
      console.debug('XR scene ready:', !!this._xrScene);
    } catch(e) { console.warn('XR scene not ready', e); }
  },

  // 触发分享功能
  async triggerShare() {
    console.debug('🚀 === 开始分享功能检查流程 ===');
    
    // 1. 检查微信环境和API可用性
    this.checkWeChatEnvironment();
    
    // 2. 检查分享组件状态
    this.checkShareComponents();
    
    try {
      console.debug('📸 尝试XR-Frame分享系统');
      // 优先使用 XR-Frame ShareSystem
      const xrResult = await this.captureWithXR().catch((error) => {
        console.error('XR分享捕获异常:', error);
        return null;
      });
      
      if (xrResult === 'success') {
        console.debug('✅ XR分享已完成，流程结束');
        return;
      } else if (xrResult) {
        console.debug('📤 XR返回图片路径，调用微信分享:', xrResult);
        this.shareToWeChat(xrResult);
        return;
      } else {
        console.debug('⚠️ XR分享未返回有效结果，继续Canvas方案');
      }
    } catch(e) {
      console.error('❌ XR分享失败:', e);
    }
    
    try {
      console.debug('🖼️ 尝试Canvas截图方案');
      // 回落到 Canvas 截图
      const fallback = await this.captureWithCanvas();
      if (fallback) {
        console.debug('📤 Canvas截图成功，调用微信分享:', fallback);
        this.shareToWeChat(fallback);
        return;
      } else {
        console.debug('⚠️ Canvas截图未返回有效结果');
      }
    } catch(e) {
      console.error('❌ Canvas截图失败:', e);
    }
    
    console.debug('📝 使用最终退化方案：仅文字分享');
    // 最终退化：仅文字分享
    this.shareToWeChat();
    
    console.debug('🏁 === 分享功能检查流程结束 ===');
  },
  
  // 检查微信环境和API可用性
  checkWeChatEnvironment() {
    console.debug('🔍 检查微信环境:');
    
    const checks = {
      微信对象: typeof wx !== 'undefined',
      分享API: typeof wx.shareAppMessage === 'function',
      截图API: typeof wx.canvasToTempFilePath === 'function',
      文件系统: typeof wx.getFileSystemManager === 'function',
      选择器查询: typeof wx.createSelectorQuery === 'function'
    };
    
    console.debug('📋 微信API检查结果:', checks);
    
    const unavailableAPIs = Object.entries(checks)
      .filter(([key, available]) => !available)
      .map(([key]) => key);
      
    if (unavailableAPIs.length > 0) {
      console.warn('⚠️ 不可用的微信API:', unavailableAPIs);
    } else {
      console.debug('✅ 所有微信API检查通过');
    }
    
    // 检查微信版本信息
    try {
      const systemInfo = wx.getSystemInfoSync();
      console.debug('📱 系统信息:', {
        platform: systemInfo.platform,
        version: systemInfo.version,
        SDKVersion: systemInfo.SDKVersion,
        brand: systemInfo.brand,
        model: systemInfo.model
      });
    } catch(e) {
      console.warn('⚠️ 无法获取系统信息:', e);
    }
  },
  
  // 检查分享组件状态
  checkShareComponents() {
    console.debug('🔍 检查分享组件状态:');
    
    // 检查XR场景
    const xrStatus = {
      场景对象: !!this._xrScene,
      场景类型: typeof this._xrScene,
      XR元素存在: !!wx.createSelectorQuery().select('#xr-scene')
    };
    
    console.debug('🎮 XR组件状态:', xrStatus);
    
    // 检查Canvas元素
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas').boundingClientRect();
    query.exec((res) => {
      const canvasRect = res[0];
      const canvasStatus = {
        Canvas元素存在: !!canvasRect,
        Canvas尺寸: canvasRect ? `${canvasRect.width}x${canvasRect.height}` : '未知',
        Canvas位置: canvasRect ? `(${canvasRect.left}, ${canvasRect.top})` : '未知'
      };
      
      console.debug('🖼️ Canvas组件状态:', canvasStatus);
    });
    
    // 检查数据状态
    const dataStatus = {
      选中餐厅: !!this.data.selected,
      餐厅名称: this.data.selected ? this.data.selected.name : '无',
      分享文案: this.data.shareText || '无',
      轮盘数据: this.data.segments ? this.data.segments.length : 0
    };
    
    console.debug('📊 数据状态:', dataStatus);
  },

  // 使用 XR-Frame 分享系统截图（本地路径）
  // 截取转盘区域用于分享
  async captureRouletteArea() {
    try {
      // 优先尝试XR截图
      const xrResult = await this.captureWithXR().catch(() => null);
      if (xrResult && xrResult !== 'success') {
        return xrResult;
      }
      
      // 回退到Canvas截图
      return await this.captureWithCanvas();
    } catch (error) {
      console.warn('转盘区域截图失败:', error);
      throw error;
    }
  },

  async captureWithXR() {
    return new Promise(async (resolve, reject) => {
      try {
        const scene = this._xrScene;
        if (!scene || !scene.share || !scene.share.supported) {
          return reject(new Error('XR ShareSystem unsupported'));
        }
        
        // 优先调起官方分享弹窗
        if (scene.share.captureToFriends) {
          try {
            await scene.share.captureToFriends({ type: 'jpg', quality: 0.9 });
            // 该API调起分享，无需返回路径；直接提示后续由系统完成
            wx.showToast({ title: '已调起分享', icon: 'success' });
            return resolve('success'); // 返回成功标识
          } catch(e) {
            console.warn('captureToFriends failed, fallback to captureToLocalPath', e);
          }
        }
        
        // 退回到保存到本地路径，由我们调用 shareAppMessage 携带图片
        if (scene.share.captureToLocalPath) {
          scene.share.captureToLocalPath({ type: 'jpg', quality: 0.9 }, (fp) => {
            if (fp) {
              resolve(fp);
            } else {
              reject(new Error('captureToLocalPath returned empty path'));
            }
          });
        } else {
          reject(new Error('No XR capture methods available'));
        }
      } catch (e) { 
        reject(e); 
      }
    });
  },

  // 使用 canvasToTempFilePath 截图当前轮盘区域
  captureWithCanvas() {
    return new Promise((resolve, reject) => {
      try {
        // 检查离屏Canvas是否存在
        const query = wx.createSelectorQuery();
        query.select('#shareCanvas').boundingClientRect();
        query.exec((res) => {
          const canvasRect = res && res[0];
          if (!canvasRect) {
            return reject(new Error('离屏Canvas未找到'));
          }
          
          // 使用固定尺寸进行截图
          wx.canvasToTempFilePath({
            canvasId: 'shareCanvas',
            x: 0,
            y: 0,
            width: 300,
            height: 300,
            destWidth: 600,
            destHeight: 600,
            fileType: 'jpg',
            quality: 0.8,
            success: (res2) => {
              if (res2.tempFilePath) {
                console.debug('Canvas截图成功:', res2.tempFilePath);
                resolve(res2.tempFilePath);
              } else {
                reject(new Error('Canvas截图失败：未返回文件路径'));
              }
            },
            fail: (err) => {
              console.warn('Canvas截图失败:', err);
              reject(new Error(`Canvas截图失败: ${err.errMsg || '未知错误'}`));
            }
          });
        });
      } catch(e) {
        reject(new Error(`Canvas截图异常: ${e.message}`));
      }
    });
  },

  // 分享到微信
  shareToWeChat(imagePath) {
    // 在分享执行前增加积分
    try { 
      addPoints && addPoints('share'); 
    } catch (e) { 
      console.warn('addPoints share error', e); 
    }
    
    const shareContent = {
      title: this.data.shareText || '今天吃什么？',
      path: '/pages/index/index'
    };
    if (imagePath) {
      shareContent.imageUrl = imagePath;
    }
    try {
      wx.shareAppMessage(shareContent);
      wx.showToast({ title: '已发起分享', icon: 'success' });
    } catch(e) {
      console.warn('shareAppMessage not available', e);
      wx.showToast({ title: '请使用右上角菜单分享', icon: 'none' });
    }
  },

  // 首页结果浮层 logo 错误处理：优先尝试 png → jpg → webp → 占位图（优先本地占位图）
  // 餐厅logo加载失败处理（增强版降级机制）
  async onSelectedLogoError() {
    try {
      const sel = this.data.selected;
      if (!sel || !sel.name) {
        // 占位图加载失败场景：使用iOS专用加载方法
        cloudImageManager.loadImageForIOS('placeholder', 'png', (placeholderUrl) => {
          if (placeholderUrl && typeof placeholderUrl === 'string' && placeholderUrl.indexOf('cloud://') !== 0) {
            this.setData({ placeholderImageUrl: placeholderUrl });
          } else {
            // 紧急兜底（统一占位图）
            const cloudFallback = cloudImageManager.getPlaceholderUrlSync();
            this.setData({ placeholderImageUrl: cloudFallback, nearbyPlaceholderImageUrl: cloudFallback });
          }
        }, () => {
          const cloudFallback = cloudImageManager.getPlaceholderUrlSync();
          this.setData({ placeholderImageUrl: cloudFallback, nearbyPlaceholderImageUrl: cloudFallback });
        });
        return;
      }

      let name = '';
      let ext = 'png';

      // 若 selected.icon 是云 fileID，优先解析原始扩展名（通常为 png）
      if (sel.icon && typeof sel.icon === 'string' && sel.icon.indexOf('cloud://') === 0) {
        const lastSlash = sel.icon.lastIndexOf('/');
        const filename = lastSlash >= 0 ? sel.icon.substring(lastSlash + 1) : sel.icon;
        const dot = filename.lastIndexOf('.');
        if (dot > 0) {
          name = filename.substring(0, dot);
          const parsedExt = filename.substring(dot + 1);
          ext = parsedExt || 'png';
        } else {
          name = filename;
        }
      } else {
        const map = this.getPinyinMap();
        name = map && map[sel.name] ? map[sel.name] : sel.name;
      }

      const retryCount = this.data.logoRetryMap[name] || 0;
      console.debug(`[${ts()}] Logo加载失败：${sel.name} (${name}), 重试次数：${retryCount}`);

      // 外卖/茶饮轮盘：直接使用类型兜底，避免误用餐厅兜底
      const wt = this.data.wheelType;
      if (wt === 'takeout' || wt === 'beverage') {
        const newLogoRetryMap = { ...this.data.logoRetryMap };
        newLogoRetryMap[name] = retryCount + 1;
        let fallback = '';
        const imgName = wt;
        // 直接使用本地兜底图片，不再尝试云端临时链接
        fallback = cloudImageManager.getCloudImageUrlSync(imgName, 'png');
        this.setData({ 'selected.icon': fallback, logoRetryMap: newLogoRetryMap });
        console.debug(`[${ts()}] 外卖/茶饮logo降级为类型兜底(本地):`, fallback);
        return;
      }

      // 餐厅轮盘：使用增强的降级机制
      // 移除云端降级机制，直接使用本地餐厅兜底
      const localCanteen = cloudImageManager.getCloudImageUrlSync('canteen', 'png');
      const newLogoRetryMap = { ...this.data.logoRetryMap };
      newLogoRetryMap[name] = retryCount + 1;
      this.setData({ 'selected.icon': localCanteen, logoRetryMap: newLogoRetryMap });
      console.debug(`[${ts()}] 餐厅logo降级为本地兜底:`, localCanteen);
      return;
      
      // 最终兜底（餐厅）：已在上面统一设置为本地 canteen，无需重复处理
      
    } catch (e) {
      console.warn('onSelectedLogoError 异常', e);
      const wt = this.data.wheelType;
      const imgName = (wt === 'takeout') ? 'takeout' : (wt === 'beverage') ? 'beverage' : 'canteen';
      // 异常兜底：直接使用本地兜底图片
      const fallback = cloudImageManager.getCloudImageUrlSync(imgName, 'png');
      this.setData({ 'selected.icon': fallback });
    }
  },

  // 遮罩层点击事件 - 关闭决策浮层
  onOverlayTap: function() {
    this.setData({
      showDecisionLayer: false,
      selected: null
    });
  },

  // 备选区图片错误处理：回退占位图
  onShortImgError: function(e) {
    try {
      const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) ? e.currentTarget.dataset.id : '';
      console.warn('[备选区图片] 加载失败，回退占位图:', id, e && e.detail);
      const shortlist = Array.isArray(this.data.shortlist) ? [...this.data.shortlist] : [];
      const idx = shortlist.findIndex(s => String(s.id) === String(id));
      if (idx >= 0) {
        shortlist[idx].icon = this.data.placeholderImageUrl || cloudImageManager.getPlaceholderUrlSync();
        this.setData({ shortlist });
      }
    } catch (err) {
      console.error('[备选区图片] 错误处理失败:', err);
    }
  },

  // AMap外链图片优化：尽可能降质以加速渲染（仅对疑似AMap/Autonavi/阿里CDN域名追加质量参数）
  optimizeAmapPhotoUrl: function(url) {
    try {
      if (!url || typeof url !== 'string') return url;
      const lower = url.toLowerCase();
      const isAmap = lower.includes('amap.com') || lower.includes('autonavi.com');
      const isAliCdn = lower.includes('alicdn') || lower.includes('oss-');
      if (!isAmap && !isAliCdn) return url;
      // 若已有查询参数，则追加；否则新增
      const sep = url.includes('?') ? '&' : '?';
      // 尽量使用通用quality参数，部分OSS支持x-oss-process；均为幂等追加，后端若不识别将忽略
      const withQuality = `${url}${sep}quality=60`;
      // 针对阿里OSS尝试追加图像处理参数（若无效将被忽略）
      const withOss = `${withQuality}&x-oss-process=image/auto-orient,1/quality,q_60`;
      return withOss;
    } catch (e) {
      console.warn('[AMap图片优化] 处理失败，使用原始URL', e);
      return url;
    }
  },

  // 添加更多餐厅按钮点击事件
  onAddMoreRestaurants: function() {
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
  addCustomRestaurant: function(restaurantName) {
    // 使用user_added_前缀确保能被正确识别为用户添加的餐厅
    const userAddedId = `user_added_${restaurantName}`;
    
    // 检查是否已存在（添加安全检查）
    const restaurants = this.data.restaurants || [];
    const existingRestaurant = restaurants.find(r => r.name === restaurantName);
    if (existingRestaurant) {
      wx.showToast({
        title: '餐厅已存在',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    // 创建新餐厅对象，参照欢迎页逻辑，使用云端placeholder图片
    const newRestaurant = {
      id: userAddedId,
      sid: userAddedId,
      name: restaurantName,
      category: '自定义',
      rating: 0,
      icon: cloudImageManager.getCloudImageUrl('placeholder', 'png'),
        logoPath: cloudImageManager.getCloudImageUrl('placeholder', 'png'),
        hdLogoPath: cloudImageManager.getCloudImageUrl('placeholder', 'png'),
      userAdded: true
    };
    
    // 添加到当前页面的restaurants数组
     const updatedRestaurants = [...restaurants, newRestaurant];
     this.setData({ restaurants: updatedRestaurants });
    
    // 保存到本地存储，参照欢迎页的存储方式
    try {
      // 保存到 welcomeSelections（按ID）
      let welcomeSelections = wx.getStorageSync('welcomeSelections') || [];
      if (!welcomeSelections.includes(userAddedId)) {
        welcomeSelections.push(userAddedId);
        wx.setStorageSync('welcomeSelections', welcomeSelections);
      }

      // 同步欢迎页的品牌名选择：welcomeSelectionsByBrand（按品牌名）
      let welcomeSelectionsByBrand = wx.getStorageSync('welcomeSelectionsByBrand') || [];
      if (!welcomeSelectionsByBrand.includes(restaurantName)) {
        welcomeSelectionsByBrand.push(restaurantName);
        wx.setStorageSync('welcomeSelectionsByBrand', welcomeSelectionsByBrand);
      }
      
      // 同时保存到 user_data 中（两个字段都同步）
      const userData = wx.getStorageSync('user_data') || {};
      userData.welcomeSelections = welcomeSelections;
      userData.welcomeSelectionsByBrand = welcomeSelectionsByBrand;
      wx.setStorageSync('user_data', userData);
      
      // 保存餐厅详细信息到 userAddedRestaurants
      let userAddedRestaurants = wx.getStorageSync('userAddedRestaurants') || [];
      if (!userAddedRestaurants.find(r => r.name === restaurantName)) {
        userAddedRestaurants.push(newRestaurant);
        wx.setStorageSync('userAddedRestaurants', userAddedRestaurants);
      }
    } catch (e) {
      console.warn('保存用户添加餐厅失败', e);
    }

    // 成功提示
    wx.showToast({
      title: '添加成功',
      icon: 'success',
      duration: 1500
    });

    // 立即刷新转盘：重新生成一批推荐并重置到第1名
    try {
      this.initWheel(false);
    } catch (e) {
      console.warn('刷新转盘失败', e);
    }
  },

  // 初始化云端图片 - iOS设备强制使用HTTPS临时链接
  async initCloudImages() {
    console.debug('[云图片初始化] 开始，设备类型:', cloudImageManager.isIOS ? 'iOS' : '非iOS');
    
    // 初始化占位图
    await this.initPlaceholderImage();
    
    // 初始化转盘切换按钮图标
    await this.initSwitchIcons();
  },

  // 初始化占位图URL
  async initPlaceholderImage() {
    try {
      const placeholderUrl = cloudImageManager.getPlaceholderUrlSync();
      this.setData({ placeholderImageUrl: placeholderUrl, nearbyPlaceholderImageUrl: placeholderUrl });
      console.debug('[占位图] 初始化完成(本地):', placeholderUrl);
    } catch (e) {
      console.error('[占位图初始化] 失败:', e);
      const cloudFallback = cloudImageManager.getPlaceholderUrlSync();
      this.setData({ placeholderImageUrl: cloudFallback, nearbyPlaceholderImageUrl: cloudFallback });
    }
  },

  // 初始化转盘切换按钮图标
  async initSwitchIcons() {
    try {
      // 统一使用本地资源作为切换按钮图标
      const nextIcons = { ...this.data.switchIcons };
      nextIcons.canteen = '/images/canteen.png';
      nextIcons.takeout = '/images/takeout.png';
      nextIcons.beverage = '/images/beverage.png';

      this.setData({ switchIcons: nextIcons });
      console.debug('[转盘图标] 使用本地资源初始化完成:', nextIcons);
    } catch (e) {
      console.error('[转盘图标初始化] 失败:', e);
    }
  },

  // 获取图片的降级方案：统一使用本地 /images/* 兜底
  async getImageWithFallback(imageName) {
    const known = ['takeout', 'beverage', 'canteen', 'placeholder'];
    if (known.includes(imageName)) {
      return cloudImageManager.getCloudImageUrlSync(imageName, 'png');
    }
    console.warn(`[图片降级] ${imageName} 使用本地占位图兜底`);
    return cloudImageManager.getPlaceholderUrlSync();
  },

  // 定位功能相关方法
  async onLocationTap() {
    if (this.data.locationStatus === 'loading') {
      return; // 防止重复点击
    }

    try {
      // 微信隐私授权检查：如需授权则弹出官方隐私协议
      console.debug('[隐私授权] 开始检查隐私设置');
      await new Promise((resolve, reject) => {
        wx.getPrivacySetting({
          success: (res) => {
            console.debug('[隐私授权] getPrivacySetting 成功:', res);
            if (res.needAuthorization) {
              console.debug('[隐私授权] 需要用户授权，弹出隐私协议');
              wx.openPrivacyContract({
                success: () => {
                  console.debug('[隐私授权] 用户同意隐私协议');
                  resolve();
                },
                fail: (err) => {
                  console.debug('[隐私授权] 用户取消隐私授权:', err);
                  reject(new Error('用户取消隐私授权'));
                }
              });
            } else {
              console.debug('[隐私授权] 用户已授权，无需弹窗');
              resolve();
            }
          },
          fail: (err) => {
            console.error('[隐私授权] getPrivacySetting 失败:', err);
            reject(err);
          }
        });
      });

      this.setData({
        locationStatus: 'loading',
        locationText: '选择位置中',
        nearbyLoading: true
      });

      // 直接使用wx.chooseLocation让用户选择位置，无需权限检查
      const { location } = await locationService.getNearbyRestaurants();
      console.debug('[定位] 用户选择的位置:', location);

      // 实例化高德SDK并调用 getPoiAround 获取 POI 数据
      const amap = new AMapWX({ key: '183ebcbcecc78388d3c07eca1d58fe10' });
      const centerStr = `${location.longitude},${location.latitude}`;
      const poiRestaurants = await new Promise((resolve, reject) => {
        amap.getPoiAround({
          location: centerStr,
          querytypes: AMAP_TYPES,
          // 高德微信SDK包内部使用 v3 接口，此处半径通过 keywords/过滤不一定生效；
          // 为保证与你提供的 v5 REST 一致，我们同时给出手写 v5 请求（见下方），并以 v5 为准。
          success: (res) => {
            try {
              const pois = (res && res.markers) ? res.markers : [];
              console.debug('[高德SDK v3] getPoiAround 返回 markers 数量:', pois.length);
            } catch (e) { /* 忽略解析错误 */ }
            resolve(res && res.markers ? res.markers : []);
          },
          fail: (err) => {
            console.error('[高德SDK v3] getPoiAround 失败:', err);
            resolve([]); // 不中断流程，使用 v5 结果或回退
          }
        });
      });

      // 直接调用你指定的 v5 REST API，使用 radius=20000 与 sortrule=weight，types 列表保持不变
      const v5Url = `https://restapi.amap.com/v5/place/around?location=${centerStr}&radius=20000&types=${encodeURIComponent(AMAP_TYPES)}&extensions=all&sortrule=weight&key=181d090075117c4211b8402639cd68fe`;
      let v5Pois = [];
      try {
        const v5Res = await new Promise((resolve) => {
          wx.request({
            url: v5Url,
            method: 'GET',
            success: (res) => resolve(res),
            fail: (err) => resolve({ data: null, err })
          })
        });
        const data = v5Res && v5Res.data ? v5Res.data : null;
        const status = data && (data.status || data.statusCode);
        const info = data && data.info;
        console.debug('[高德REST v5] status:', status, 'info:', info);
        if (data && Array.isArray(data.pois)) {
          v5Pois = data.pois;
          console.debug('[高德REST v5] POI数量:', v5Pois.length);
          // 输出前5条POI的扩展字段示例，便于核对photos/biz_ext.rating/cost
          try {
            const sample = v5Pois.slice(0, 5).map(p => ({ name: p.name, photos: p.photos, biz_ext: p.biz_ext }));
            console.debug('[高德REST v5] 示例POI扩展字段(photos/biz_ext):', sample);
          } catch (logErr) {
            console.warn('[高德REST v5] 示例扩展字段日志失败:', logErr);
          }
        } else {
          console.warn('[高德REST v5] 返回无pois字段或格式异常:', data);
        }
      } catch (e) {
        console.error('[高德REST v5] 请求失败:', e);
      }

      // 统一将 POI 映射到转盘使用的数据结构（优先使用 v5，v3 作为补充），并限制Amap前60用于排序与缓存
      const v5PoisLimited = (v5Pois && v5Pois.length) ? v5Pois.slice(0, 60) : [];
      const combinePois = (v5PoisLimited || []).concat(poiRestaurants || []);
      const restaurants = (combinePois || []).map((p, idx) => {
        // v5字段：name, distance, category, location(经纬度字符串), address; v3(markers)可能有 id/title/longitude/latitude
        const rawName = p.name || p.title || `餐厅${idx+1}`;
        const name = this.cleanRestaurantName(rawName);
        const category = p.category || (p.desc || '餐饮');
        const address = p.address || '';
        let latitude = p.latitude; let longitude = p.longitude; let distance = p.distance;
        if (p.location && typeof p.location === 'string' && p.location.includes(',')) {
          const [lngStr, latStr] = p.location.split(',');
          longitude = parseFloat(lngStr);
          latitude = parseFloat(latStr);
        }
        if (typeof distance !== 'number' || isNaN(distance)) {
          distance = locationService.calculateDistance(location.latitude, location.longitude, latitude, longitude);
        }
        // 提取扩展字段：照片、评分、人均
        const photos = Array.isArray(p.photos) ? p.photos : [];
        let photoUrl = '';
        if (photos.length) {
          const first = photos[0] || {};
          photoUrl = first.url || first.photoUrl || '';
        }
        // 强制HTTPS，避免http资源在小程序受限
        let photoUrlHttps = (typeof photoUrl === 'string' && photoUrl.startsWith('http://')) ? ('https://' + photoUrl.slice(7)) : photoUrl;
        const biz = p.biz_ext || {};
        let ratingNum = undefined;
        if (biz && biz.rating != null) {
          const rStr = String(biz.rating).trim();
          const rVal = parseFloat(rStr);
          if (!isNaN(rVal)) ratingNum = rVal;
        }
        let costNum = undefined;
        if (biz && biz.cost != null) {
          if (typeof biz.cost === 'string') {
            const cVal = parseFloat(biz.cost);
            if (!isNaN(cVal)) costNum = cVal;
          } else if (Array.isArray(biz.cost) && biz.cost.length) {
            const cVal = parseFloat(biz.cost[0]);
            if (!isNaN(cVal)) costNum = cVal;
          }
        }
        // 对AMap外链图片进行质量优化
        const optimizedPhotoUrl = this.optimizeAmapPhotoUrl(photoUrlHttps);
        const icon = optimizedPhotoUrl || (this.data.wheelType === 'takeout' ? cloudImageManager.getCloudImageUrl('takeout', 'png') : (this.data.wheelType === 'beverage' ? cloudImageManager.getCloudImageUrl('beverage', 'png') : this.getRestaurantIconPath(name)));
        console.debug('[定位] POI字段检查:', { name, photosCount: photos.length, ratingRaw: biz && biz.rating, costRaw: biz && biz.cost, iconSource: optimizedPhotoUrl ? 'photos[0]+optimized' : 'fallback' });
        return {
          id: p.id || p.poiId || `amap_${idx}`,
          name,
          distance: distance || 0,
          category,
          latitude,
          longitude,
          address,
          // 业务展示字段
          icon,
          rating: ratingNum,
          cost: costNum,
          // 保留原始Amap数据用于后续日志与导航
          amapData: { latitude, longitude, address, original: p }
        };
      });

      console.debug('[定位] 合并POI得到附近餐厅:', restaurants);

      // 获取基于位置的推荐（前60作为优先级基准，展示数量随轮盘类型变化）
      const basePriority = ranking.prioritizeRestaurants(restaurants, 60) || [];
      const topN = this.data.wheelType === 'restaurant' ? 20 : 12;
      const locationBasedRecommendations = basePriority.slice(0, topN);
      console.debug(`[定位] 基于位置的推荐(展示TOP${topN}):`, locationBasedRecommendations);
      // 输出TOPN的高德扩展字段（rating/cost）与照片URL（若存在）
      try {
        const topNList = locationBasedRecommendations.slice(0, topN).map(r => {
          const orig = r && r.amapData && r.amapData.original ? r.amapData.original : null;
          const photos = orig && Array.isArray(orig.photos) ? orig.photos : [];
          const photoUrls = photos
            .map(ph => ph && (ph.url || ph.photoUrl || ''))
            .filter(u => typeof u === 'string' && u.length)
            .map(u => (u.startsWith('http://') ? ('https://' + u.slice(7)) : u));
          const biz = orig && orig.biz_ext ? orig.biz_ext : {};
          const ratingRaw = biz && biz.rating != null ? biz.rating : null;
          const costRaw = biz && biz.cost != null ? biz.cost : null;
          return {
            id: String(r.id),
            name: r.name,
            ratingRaw,
            costRaw,
            ratingNormalized: r.rating,
            costNormalized: r.cost,
            photoUrls
          };
        });
        console.debug(`[定位] TOP${topN} 验证字段（id/name/ratingRaw/costRaw/photoUrls）:`, topNList);
      } catch (e) {
        console.warn(`[定位] TOP${topN} 字段输出失败:`, e);
      }

      const displayName = this.truncateLocationName(location.name);
      this.setData({
        locationStatus: 'success',
        locationText: displayName,
        userLocation: location,
        nearbyRestaurants: restaurants,
        nearbyLoading: false
      });

      // 定位成功后加载今日选择页“附近优惠”数据（与领券中心一致）
      this.loadNearbyOffers();

      // 缓存用户选择的位置到本地存储（双向同步）
      try { wx.setStorageSync('userLocation', { ...location, ts: Date.now() }); } catch(e) {}

      // 缓存定位推荐数据与优先级基准，用于 initWheel 与窗口顺延
      this._basePriorityList = basePriority;
      this._priorityOffset = 0; // 定位后重置窗口偏移
      // 为餐厅轮盘缓存完整 TOP20，避免在外卖/茶饮界面只缓存12条
      const locationBasedRecommendationsForRestaurant = basePriority.slice(0, 20);
      this._cachedLocationRecommendations = locationBasedRecommendationsForRestaurant;

      // 根据当前轮盘类型决定是否立即刷新轮盘（仅餐厅轮盘刷新）
      if (this.data.wheelType === 'restaurant') {
        // 使用餐厅 TOP20 刷新当前餐厅轮盘
        this.updateWheelWithLocationData(locationBasedRecommendationsForRestaurant);
        // 显示成功提示
        this.showTopToast('已获取附近餐厅推荐');
      } else {
        // 外卖/茶饮界面：不影响当前轮盘，只更新餐厅轮盘缓存，用户切到餐厅时生效
        console.debug('[定位] 当前非餐厅轮盘，已更新餐厅轮盘缓存，不刷新当前轮盘');
        this.showTopToast('已更新餐厅转盘的附近餐厅数据');
      }

    } catch (error) {
      console.error('[定位] 获取位置失败:', error);
      
      // 区分用户取消和真正的错误
      if (error.message && error.message.includes('用户取消')) {
        this.setData({
          locationStatus: 'idle',
          locationText: '选择位置'
        });
        // 用户取消不显示错误提示
      } else {
        this.setData({
          locationStatus: 'error',
          locationText: '定位失败'
        });
        this.showTopToast('定位失败，请重试');
      }
    }
  },

  // 使用基于位置的数据更新轮盘
  updateWheelWithLocationData(locationBasedRecommendations) {
    if (!Array.isArray(locationBasedRecommendations) || locationBasedRecommendations.length === 0) {
      console.warn('[定位轮盘] 没有基于位置的推荐数据');
      return;
    }

    // 取前N个推荐餐厅（餐厅取20，其他类型使用全部长度）
    const recs = locationBasedRecommendations.slice(0, this.data.wheelType === 'restaurant' ? 20 : locationBasedRecommendations.length);
    
    const count = this.data.wheelType === 'restaurant' ? 20 : recs.length;
    const step = 360 / count;
    const { wheelRadius, labelOuterMargin, labelInnerMargin, labelMinStep, labelMaxStep } = this.data;

    const segments = Array.from({ length: count }, (_, idx) => {
      const r = recs[idx] || { name: '', id: `empty_${idx}`, type: 'restaurant' };
      const rawName = r.name || '';
      const name = this.cleanRestaurantName(rawName);
      const labelName = this.truncateRestaurantLabel(name, 12);
      const nameChars = String(labelName).split('');
      const outer = Math.max(0, wheelRadius - labelOuterMargin);
      const inner = Math.max(0, labelInnerMargin);
      const available = Math.max(0, outer - inner);
      
      let chars = [];
      if (nameChars.length <= 1) {
        chars = [{ ch: nameChars[0] || '', pos: Math.max(inner, Math.min(outer, Math.round((outer + inner) / 2))) }];
      } else {
        const rawStep = available / (nameChars.length - 1);
        const stepLen = Math.max(labelMinStep, Math.min(labelMaxStep, rawStep));
        const start = outer;
        chars = nameChars.map((ch, cidx) => ({ ch, pos: Math.max(inner, Math.round(start - cidx * stepLen)) }));
      }

      return {
          id: String(r.id),
          name,
          type: r.type || 'restaurant',
          icon: (r && r.icon) ? r.icon : (this.data.wheelType === 'takeout' ? cloudImageManager.getCloudImageUrl('takeout', 'png') : (this.data.wheelType === 'beverage' ? cloudImageManager.getCloudImageUrl('beverage', 'png') : this.getRestaurantIconPath(name))),
          promoText: r.promoText || '',
          angle: idx * step + step / 2,
          slotNo: idx + 1,
          // 位置相关信息
          distance: r.distance,
          priority: r.priority,
          isFromAmap: !!(r && r.isFromAmap),
          isPreselected: !!(r && r.isPreselected),
          isUserAdded: !!(r && (r.isUserAdded || (typeof r.id === 'string' && r.id.startsWith('user_added_')))),
        // 业务字段透传与展示
        tags: (function(){const base=Array.isArray(r && r.tags)? r.tags: []; const bt=(r && r.businessTag) || (r && r.category); return bt ? [...base, bt] : base; })(),
        rating: (r && typeof r.rating === 'number') ? r.rating : undefined,
        cost: (r && typeof r.cost === 'number') ? r.cost : undefined,
        ratingDisplay: (r && typeof r.rating === 'number' && r.rating>0) ? (Number(r.rating).toFixed(1) + '分') : '',
        costDisplay: (r && typeof r.cost === 'number' && r.cost>0) ? ('¥' + Number(r.cost).toFixed(0)) : '',
        // 透传经纬度与地址（优先 amapData），供导航使用
        latitude: (r && r.amapData && r.amapData.latitude != null) ? r.amapData.latitude : r.latitude,
        longitude: (r && r.amapData && r.amapData.longitude != null) ? r.amapData.longitude : r.longitude,
        address: (r && r.amapData && r.amapData.address) ? r.amapData.address : r.address,
        amapData: (r && r.amapData && (r.amapData.latitude != null) && (r.amapData.longitude != null)) ? { latitude: r.amapData.latitude, longitude: r.amapData.longitude, address: r.amapData.address, original: r.amapData.original } : ((r && r.latitude != null && r.longitude != null) ? { latitude: r.latitude, longitude: r.longitude, address: r.address } : undefined),
        chars
      };
    });

    this.setData({ 
      segments,
      displayOrder: Array.from({ length: count }, (_, i) => i + 1)
    });

    // 更新背景（非餐厅动态）
    try {
      const bg = this.computeWheelBackground(this.data.currentPaletteKey, segments.length, this.data.wheelType);
      this.setData({ wheelBackground: bg });
    } catch (eBg) {
      console.warn('[轮盘背景][定位] 生成失败，回退到 CSS 类', eBg);
      this.setData({ wheelBackground: '' });
    }
  },

  // 截取位置名称，限制在20个字节内
  truncateLocationName(name) {
    if (!name) return '';
    
    // 计算字节长度（中文字符占3个字节，英文字符占1个字节）
    let byteLength = 0;
    let truncatedName = '';
    
    for (let i = 0; i < name.length; i++) {
      const char = name[i];
      const charByteLength = /[\u4e00-\u9fa5]/.test(char) ? 3 : 1;
      
      if (byteLength + charByteLength <= 20) {
        byteLength += charByteLength;
        truncatedName += char;
      } else {
        break;
      }
    }
    
    return truncatedName === name ? name : truncatedName + '...';
  },

  // 新增：餐厅名称清洗（去括号及其内容；若中英混合，仅保留中文部分）
  cleanRestaurantName(name) {
    if (!name) return '';
    let s = String(name).trim();
    // 去除各类括号及其内容：()、（）、[]、【】
    s = s.replace(/（[^）]*）/g, '')
         .replace(/\([^)]*\)/g, '')
         .replace(/【[^】]*】/g, '')
         .replace(/\[[^\]]*\]/g, '');
    s = s.replace(/\s+/g, ' ').trim();

    const hasCn = /[\u4e00-\u9fa5]/.test(s);
    const hasEn = /[A-Za-z]/.test(s);
    if (hasCn && hasEn) {
      const parts = s.match(/[\u4e00-\u9fa5·•]+/g);
      const onlyCn = parts ? parts.join('') : '';
      if (onlyCn) s = onlyCn;
    }
    return s || String(name).trim();
  },

  // 新增：转盘标签仅展示前12个字节（中文按2字节、英文按1字节）
  truncateRestaurantLabel(name, maxBytes = 12) {
    if (!name) return '';
    let bytes = 0;
    let out = '';
    for (const ch of String(name)) {
      const cost = /[\u4e00-\u9fa5]/.test(ch) ? 2 : 1;
      if (bytes + cost > maxBytes) break;
      bytes += cost;
      out += ch;
    }
    return out;
  },

  // 恢复位置信息显示
  restoreLocationDisplay() {
    const userLocation = this.data.userLocation;
    if (userLocation && userLocation.name) {
      const displayName = this.truncateLocationName(userLocation.name);
      this.setData({
        locationStatus: 'success',
        locationText: displayName
      });
    }
  },

  // 首页：加载附近优惠（与领券中心逻辑一致）
  async loadNearbyOffers() {
    try {
      // 开始加载附近优惠：打开加载中状态
      this.setData({ nearbyLoading: true });
      const loc = this.data.userLocation;
      if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
        this.setData({ nearbyOffers: [], nearbyLoading: false });
        return;
      }

      // 采集附近餐厅（多半径聚合+去重）
      const targetCount = 60;
      const radiusSteps = [1500, 2500, 3500, 5000, 7000];
      let collected = [];
      let usedRadius = radiusSteps[0];
      for (const r of radiusSteps) {
        usedRadius = r;
        const res = await locationService.searchNearbyRestaurants({ latitude: loc.latitude, longitude: loc.longitude }, r);
        const arr = Array.isArray(res) ? res : [];
        // 按 id/name 去重聚合
        const map = new Map(collected.map(x => [String(x.id || x.name || ''), x]));
        for (const it of arr) {
          const key = String(it.id || it.name || '');
          if (!map.has(key)) { map.set(key, it); }
        }
        collected = Array.from(map.values());
        if (collected.length >= targetCount) break;
      }
      const nearbyArr = collected.slice(0, targetCount);
      console.info('[附近优惠][首页] 采集附近餐厅数:', nearbyArr.length, '使用半径:', usedRadius);

      const restaurantCards = [];
      const parseNum = (v) => { const n = (typeof v === 'string') ? parseFloat(v) : (typeof v === 'number' ? v : NaN); return isFinite(n) ? n : 0; };

      for (const r of nearbyArr) {
        const rName = r && (r.name || r.brandName || r.title) || '';
        if (!rName) continue;
        const qName = this.cleanRestaurantName ? this.cleanRestaurantName(rName) : (String(rName).trim());
        const lat = (r && typeof r.latitude === 'number') ? r.latitude : (r?.amapData?.latitude);
        const lng = (r && typeof r.longitude === 'number') ? r.longitude : (r?.amapData?.longitude);

        // 拉取外卖与到店商品（静默失败）
        let wmRes = null, osRes = null;
        try { wmRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 1, searchText: qName, latitude: lat, longitude: lng } }); } catch (e1) { /* 静默 */ }
        try { osRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 2, bizLine: 1, searchText: qName, latitude: lat, longitude: lng } }); } catch (e2) { /* 静默 */ }

        // 标准化解析响应
        const normalizeList = (res, source) => {
          const root = res?.result?.data || res?.result || {};
          const arr = Array.isArray(root?.data)
            ? root.data
            : (Array.isArray(root?.list)
              ? root.list
              : (Array.isArray(root?.items) ? root.items : []));
          return (arr || []).map(it => {
            const skuViewId = String(it?.couponPackDetail?.skuViewId || it?.skuViewId || '').trim();
            const brandName = it?.brandInfo?.brandName || it?.brandName || rName;
            const name = it?.couponPackDetail?.name || it?.name || it?.title || '';
            let headUrl = it?.couponPackDetail?.headUrl || it?.headUrl || it?.imgUrl || it?.image || it?.picUrl || '';
            if (typeof headUrl === 'string' && headUrl.startsWith('http://')) headUrl = 'https://' + headUrl.slice(7);
            const originalPrice = parseNum(it?.couponPackDetail?.originalPrice || it?.originalPrice || it?.originPrice);
            const sellPrice = parseNum(it?.couponPackDetail?.sellPrice || it?.sellPrice || it?.price || it?.currentPrice);
            return { skuViewId, brandName, name, headUrl, source, bizLine: Number(it?.bizLine ?? (source === 'onsite' ? 1 : 0)), originalPrice, sellPrice };
          }).filter(x => !!x.skuViewId);
        };

        const wmList = normalizeList(wmRes, 'takeout');
        const osList = normalizeList(osRes, 'onsite');
        const merged = wmList.concat(osList).slice(0, 6); // 每店最多取前6个用于查询链接

        // 查询推广链接，仅保留有小程序链接的商品
        const itemsWithLink = [];
        let idx = 0;
        const couponWorkersLimit = 3; // 每家餐厅内部并发不超过3
        const worker = async () => {
          while (idx < merged.length) {
            const it = merged[idx++];
            try {
              const lr = await wx.cloud.callFunction({ name: 'getMeituanReferralLink', data: { skuViewId: it.skuViewId } });
              const root = lr?.result?.data || lr?.result || {};
              const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;
              const linkMap = dataRoot?.referralLinkMap || dataRoot?.linkMap || dataRoot?.urlMap || {};
              const weapp = linkMap['4'] || linkMap[4] || linkMap.weapp || linkMap.mini;
              if (weapp) {
                itemsWithLink.push({ ...it, referralLinkMap: linkMap });
              }
            } catch (_) { /* 静默 */ }
          }
        };
        await Promise.all(new Array(couponWorkersLimit).fill(0).map(() => worker()));

        if (!itemsWithLink.length) {
          // 无商品可跳转：不渲染该餐厅卡片
          continue;
        }

        // 提取品牌logo（优先使用美团返回的 brandLogoUrl）
        const extractBrandLogoUrl = (resp) => {
          try {
            const root = resp?.result?.data || resp?.result || {};
            const arr = Array.isArray(root?.data)
              ? root.data
              : (Array.isArray(root?.list)
                ? root.list
                : (Array.isArray(root?.items) ? root.items : []));
            let c = '';
            for (const it of arr) {
              c = it?.brandInfo?.brandLogoUrl || it?.brandLogoUrl || '';
              if (c) break;
            }
            if (typeof c === 'string' && c.startsWith('http://')) c = 'https://' + c.slice(7);
            return c;
          } catch (e) { return ''; }
        };
        const logoCandidate = extractBrandLogoUrl(wmRes) || extractBrandLogoUrl(osRes) || '';
        let logoUrl = logoCandidate;
        if (!logoUrl) {
          // 统一本地兜底，不再尝试云端临时链接
          logoUrl = cloudImageManager.getCloudImageUrlSync('takeout', 'png');
        }

        restaurantCards.push({
          id: r.id || (rName + '_' + (r.distance || '')),
          name: rName,
          distance: typeof r.distance === 'number' ? r.distance : null,
          logoUrl,
          products: itemsWithLink
        });
      }

      const nearbyOffers = restaurantCards;
      const nearbyOffersLoop = []; // 移除重复循环，避免重复卡片
      this.setData({ nearbyOffers, nearbyOffersLoop, nearbyLoading: false });
    } catch (err) {
      console.warn('[附近优惠][首页] 加载失败', err);
      // 失败也需关闭加载中状态
      this.setData({ nearbyLoading: false });
    }
  },

  // 底部附近优惠卡片点击跳转到品牌详情（与领券中心对齐）
  onNearbyRestaurantTap(e) {
    try {
      const id = e.currentTarget.dataset.id;
      const list = Array.isArray(this.data.nearbyOffers) ? this.data.nearbyOffers : [];
      const restaurant = list.find(r => String(r.id) === String(id));
      if (!restaurant) return;
      const name = restaurant.name || '';
      const logo = restaurant.logoUrl || this.data.nearbyPlaceholderImageUrl;
      const products = Array.isArray(restaurant.products) ? restaurant.products : [];
      const url = `/pages/brand/detail?name=${encodeURIComponent(name)}&logo=${encodeURIComponent(logo)}`;
      wx.navigateTo({
        url,
        success: (res) => {
          try {
            res.eventChannel.emit('initData', { products });
          } catch (e) { console.warn('[附近优惠][跳转] 事件通道传递失败', e); }
        },
        fail: (err) => { console.warn('[附近优惠][跳转] 失败', err); }
      });
    } catch (err) {
      console.warn('[附近优惠][点击] 处理失败', err);
    }
  },

  // 顶部搜索入口：跳转到搜索二级页（样式与领券页一致）
  navigateToSearch() {
    try {
      wx.navigateTo({ url: '/pages/search/index' });
    } catch (err) {
      console.warn('[index] 跳转搜索页失败：', err);
    }
  }
});

console.debug('[定位轮盘] 已更新轮盘数据，基于位置推荐');