// pages/index/index.js
const { getUserData, updateUserData, addDecisionRecord, addPoints } = require('../../utils/dataManager');
const { generateRecommendations } = require('../../utils/recommendation');
const { updateRestaurantScore } = require('../../utils/scoringManager');
const { updateUserPreference } = require('../../utils/preferenceLearner');
const { cloudImageManager } = require('../../utils/cloudImageManager');
const takeoutData = require('../../data/takeout');
const beverageData = require('../../data/beverage');
const pinyin = require('../../restaurant_pinyin.js');
// removed: const shareWording = require('../../shareWording.json');

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

    // UI 状态
    showDecisionLayer: false,
    showShareArea: true,
    spinClass: '',

    // 手势检测
    touchStartY: 0,
    touchStartTime: 0,

    // 备选
    shortlist: [],
    
    // 云图片占位符
    placeholderImageUrl: '/images/placeholder.svg',
    placeholderSlots: [0,0,0],
    activeShortlistId: '',

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

    // 配色切换
    currentPaletteKey: 'b',
    paletteKeys: ['b','a','f','g'],
    
    // 基于当前显示顺序的编号数组（1..12 -> segment索引），用于日志与后续扩展
    displayOrder: [],

    // 记录首页结果浮层 logo 的扩展名尝试次数：key=name 或拼音，value=0..3
    logoRetryMap: {},
    // 顶部toast显示
    showTopToast: false,
    topToastText: ''
  },

  onLoad() {
    this.initWheel(false);
    this.loadShareText();
    this.updateDateTime();
    this._clock = setInterval(() => this.updateDateTime(), 60 * 1000);
    this.updatePlaceholderSlots();

    // 默认每次进入页面均使用 B（不读取旧缓存），与需求保持一致
    try {
      this.setData({ currentPaletteKey: 'b' });
      wx.setStorageSync('paletteKey', 'b');
    } catch(e) {}
    
    // 延迟验证卡片居中位置
    setTimeout(() => {
      this.verifyCenterPosition();
    }, 500);

    // 预加载转盘切换按钮的云图标
    try {
      cloudImageManager.preloadImages(['canteen', 'takeout', 'beverage']);
    } catch (e) { console.warn('预加载切换按钮图标失败', e); }
  },

  onShow() {
    // 保持 share 文案更新
    this.loadShareText();
    // 自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  // 配色切换（循环 B→A→F→G）
  onTogglePalette() {
    const keys = this.data.paletteKeys || ['b','a','f','g'];
    const cur = this.data.currentPaletteKey || 'b';
    const idx = Math.max(0, keys.indexOf(cur));
    const next = keys[(idx + 1) % keys.length]; // 第一次点击从 b 切到 a
    this.setData({ currentPaletteKey: next });
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

  onUnload() {
    if (this._clock) {
      clearInterval(this._clock);
      this._clock = null;
    }
  },

  // 精确验证卡片居中位置
  verifyCenterPosition(phase = 'manual') {
    console.log('=== 开始验证卡片居中位置 ===');
    
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
      
      console.log('📱 视口信息:', {
        width: viewport.width,
        height: viewport.height,
        centerX: viewport.width / 2,
        centerY: viewport.height / 2
      });
      
      if (container) {
        console.log('📦 容器信息:', {
          width: container.width,
          height: container.height,
          left: container.left,
          top: container.top,
          centerX: container.left + container.width / 2,
          centerY: container.top + container.height / 2
        });
      }
      
      if (heroArea) {
        console.log('🎯 Hero区域信息:', {
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
        
        console.log('🎡 轮盘容器信息:', {
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
        
        console.log('📏 居中偏移分析:', {
          水平偏移: `${offsetX.toFixed(2)}px`,
          垂直偏移: `${offsetY.toFixed(2)}px`,
          水平居中: offsetX < 1 ? '✅ 完美居中' : offsetX < 5 ? '⚠️ 基本居中' : '❌ 偏移过大',
          垂直居中: offsetY < 1 ? '✅ 完美居中' : offsetY < 5 ? '⚠️ 基本居中' : '❌ 偏移过大'
        });
        
        // 计算相对于视口的位置百分比
        const xPercent = (rouletteCenterX / viewport.width * 100).toFixed(1);
        const yPercent = (rouletteCenterY / viewport.height * 100).toFixed(1);
        
        console.log('📊 位置百分比:', {
          水平位置: `${xPercent}%`,
          垂直位置: `${yPercent}%`,
          理想位置: '50.0%',
          水平偏差: `${Math.abs(50 - parseFloat(xPercent)).toFixed(1)}%`,
          垂直偏差: `${Math.abs(50 - parseFloat(yPercent)).toFixed(1)}%`
        });
        
        // 综合评估
        const isWellCentered = offsetX < 5 && offsetY < 5;
        console.log('🎯 居中评估结果:', isWellCentered ? '✅ 卡片居中良好' : '❌ 卡片居中需要调整');
        
      } else {
        console.warn('⚠️ 无法获取轮盘容器信息');
      }
      
      // 追加切换按钮与备选区的距离测量
      const area = res[4];
      const switcher = res[5];
      const shortlist = res[6];
      if (area && switcher && shortlist) {
        const distancePx = Math.max(0, shortlist.top - (area.top + switcher.height));
        console.log(`🔍 [verify] phase=${phase} 切换按钮到备选区的垂直距离=${distancePx.toFixed(2)}px`, { areaTop: area.top, switcherHeight: switcher.height, shortlistTop: shortlist.top });
      } else {
        console.warn('⚠️ 无法获取切换按钮/备选区的布局信息');
      }

      console.log('=== 卡片居中位置验证完成 ===');
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

  // 根据餐厅名称返回图标路径（找不到时回退到占位图）
  getRestaurantIconPath(name) {
    try {
      const map = this.getPinyinMap();
      const pkgA = this.getPackageAFullIcons();
      const pkgB = this.getPackageBFullIcons();

      let key = map && name ? (map[name] || name) : (name || 'placeholder');

      // 直配命中
      if (pkgA.includes(key) || pkgB.includes(key)) {
        return cloudImageManager.getCloudImageUrl(key);
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
          return cloudImageManager.getCloudImageUrl(v);
        }
      }

      // 兜底占位图
      return cloudImageManager.getCloudImageUrl('placeholder');
    } catch (e) {
      console.warn('getRestaurantIconPath 解析失败，使用占位图:', e);
      return cloudImageManager.getCloudImageUrl('placeholder');
    }
  },

  // 生成外卖转盘推荐（从takeout.json的category_name中选取）
  generateTakeoutRecommendations(count = 12) {
    try {
      const categories = takeoutData.takeout_categories || [];
      if (categories.length === 0) return [];
      
      // 随机选择 count 个类别
      const shuffled = [...categories].sort(() => Math.random() - 0.5);
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
          icon: py ? cloudImageManager.getCloudImageUrl(py, 'png') : cloudImageManager.getCloudImageUrl('placeholder', 'png'),
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
  generateBeverageRecommendations(count = 12) {
    try {
      const brands = beverageData.beverage_brands || [];
      if (brands.length === 0) return [];
      
      // 随机选择12个品牌
      const shuffled = [...brands].sort(() => Math.random() - 0.5);
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
        icon: (brand.pinyin ? cloudImageManager.getCloudImageUrl(brand.pinyin, 'png') : cloudImageManager.getCloudImageUrl('placeholder')),
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
      
      // 根据转盘类型生成不同数据
      if (this.data.wheelType === 'takeout') {
        recs = this.generateTakeoutRecommendations(12);
      } else if (this.data.wheelType === 'beverage') {
        recs = this.generateBeverageRecommendations(12);
      } else {
        recs = generateRecommendations(userData, 12);
      }
      const fmt = (v) => (typeof v === 'number' ? Number(v).toFixed(2) : '--');
      console.log(`[${ts()}] 推荐列表(生成/刷新)：`, recs.map((r, i) => `${i+1}.${r && r.name ? r.name : ''} [总:${fmt(r && r.recommendationScore)} 评:${fmt(r && r.specificScore)} 偏:${fmt(r && r.preferenceScore)}]`));
      const count = 12;
      const step = 360 / count;
      const { wheelRadius, labelOuterMargin, labelInnerMargin, labelMinStep, labelMaxStep } = this.data;
      const pointerAngle = 0; // 修正：指针在CSS中位于top位置，对应0°

      // 保持推荐顺序(1..12)，不因指针对齐而重排
      const segments = Array.from({ length: count }, (_, idx) => {
        const r = recs[idx];
        const name = (r && r.name) ? r.name : '';
        const nameChars = String(name).split('');
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
          icon: (r && r.icon) ? r.icon : this.getRestaurantIconPath(name),
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
      console.log(`[${ts()}] 生成转盘(12)：`, listLog);

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
        console.log(`[${ts()}] 换一批后推荐列表（带变更标记）：\n${diffLines.join('\n')}`);
      } else {
        const initLines = segments.map(s => `${s.slotNo}. ${s.name} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`);
        console.log(`[${ts()}] 初始推荐列表：\n${initLines.join('\n')}`);
      }

      // 调试：输出所有段的角度位置
      console.log(`[${ts()}] 段角度调试：`, segments.map((s, i) => `${s.slotNo}.${s.name}@${s.angle}°`));

      const base = { segments, selected: null, showDecisionLayer: false, displayOrder };
      if (!preserveRotation) {
        // 让 slot 1(segments[0]) 的中心角对齐到 pointerAngle
        const s0Angle = segments[0].angle; // step/2
        const rotationOffset = ((pointerAngle - s0Angle) % 360 + 360) % 360;
        base.rouletteRotation = rotationOffset;
        console.log(`[${ts()}] 初始对齐：基于段中心角 s0=${s0Angle}°，设置 rotation=${rotationOffset}°`);

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
        console.log(`[${ts()}] 初始化完成：当前指向 编号=${pointed.slotNo}，餐厅="${pointed.name}"`);
        
        // 调试：输出所有段旋转后的实际位置
        console.log(`[${ts()}] 旋转后段位置：`, segments.map((s, i) => {
          const rotatedAngle = ((s.angle + effectiveRot0) % 360 + 360) % 360;
          return `${s.slotNo}.${s.name}@${rotatedAngle.toFixed(1)}°`;
        }));
      }
      this.setData(base);
      // 初始化完成后，移除禁用动画类，允许后续旋转动画生效
      if (!preserveRotation) {
        wx.nextTick(() => {
          setTimeout(() => {
            this.setData({ spinClass: '' });
            this._initInProgress = false;
          }, 0);
        });
      }
      // 后台静默预加载本轮12个选项的图标，减少图片显示延迟
      try { this.preloadSegmentIcons(segments); } catch(_) {}
    } catch(e) {
      console.error(`[${ts()}] 初始化轮盘失败`, e);
      this.setData({ segments: [], selected: null, showDecisionLayer: false, displayOrder: [] });
    }
  },

  // 静默预加载12个选项的云端图片（不阻塞UI）
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
    // 隐藏结果浮层与分享区，清空选中
    this.setData({ showDecisionLayer: false, showShareArea: false, selected: null });

    // 刷新后自动旋转：先刷新12个推荐并完成显示（瞬时对齐），再在初始化完成后触发旋转
    console.log(`[${ts()}] 再转一次：换一批推荐（12家），并将指针对齐第1名，同时自动旋转`);
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

  onAccept() {
    const sel = this.data.selected;
    if (!sel) return;
    const userData = getUserData();
    updateRestaurantScore(userData, String(sel.id), 'accept', { name: sel.name });
    if (this.data.wheelType === 'restaurant') { try { updateUserPreference(String(sel.id), 'like'); } catch(e) {} }
    try { addDecisionRecord({ id: String(sel.id), name: sel.name, action: 'accept', source: 'roulette', wheelType: this.data.wheelType }); } catch(e) {}

    // 锁定分享餐厅，生成文案并展示分享区，隐藏结果浮层
    this.setData({ shareTargetName: sel.name, showShareArea: true, showDecisionLayer: false });
    this.loadShareText();
    wx.showToast({ title: '已记录，就它了', icon: 'success' });
  },

  onAddShortlist: async function() {
    const sel = this.data.selected;
    if (!sel) return;
    const list = this.data.shortlist.slice(0,3);
    if (list.find(x => x.id === sel.id)) { return; }
    if (list.length >= 3) { 
      wx.showToast({ title: '备选区已满，请先删除', icon: 'none' });
      // 备选区已满时，不隐藏浮层，让用户可以继续操作
      return; 
    }
    let item = { ...sel };
    try {
      const icon = item.icon;
      if (icon && typeof icon === 'string' && icon.indexOf('cloud://') === 0) {
        const lastSlash = icon.lastIndexOf('/');
        const filename = lastSlash >= 0 ? icon.substring(lastSlash + 1) : icon;
        const dot = filename.lastIndexOf('.');
        let name = filename;
        let ext = 'png';
        if (dot > 0) { ext = filename.substring(dot + 1); name = filename.substring(0, dot); }
        let url = '';
        try { url = await cloudImageManager.getTempHttpsUrl(name, ext); } catch (e1) {}
        if (!url || url.indexOf('cloud://') === 0) { try { url = await cloudImageManager.getTempHttpsUrl(name, 'jpg'); } catch (e2) {} }
        if (!url || url.indexOf('cloud://') === 0) { try { url = await cloudImageManager.getTempHttpsUrl(name, 'webp'); } catch (e3) {} }
        if (!url || url.indexOf('cloud://') === 0) { url = this.data.placeholderImageUrl || '/images/placeholder.svg'; }
        item.icon = url;
      }
    } catch (err) {
      console.warn('onAddShortlist temp url convert failed', err);
    }
    list.push(item);
    // 成功加入备选后隐藏结果浮层
    this.setData({ shortlist: list, showDecisionLayer: false });
    this.updatePlaceholderSlots();
    wx.showToast({ title: '已加入备选', icon: 'success' });
  },

  onRemoveShort(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ shortlist: this.data.shortlist.filter(x => x.id !== id) });
    this.updatePlaceholderSlots();
  },

  onTapShortlistCard(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id || !name) return;
    
    // 如果点击的是已选中的卡片，则取消选中
    if (this.data.activeShortlistId === id) {
      this.setData({ activeShortlistId: '', shareTargetName: '', showShareArea: false });
      return;
    }
    
    // 选中新的卡片
    this.setData({ activeShortlistId: id, shareTargetName: name, showShareArea: true });
    this.loadShareText();
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
        // 优先尝试从 shareWording.json 读取（存在则使用）
        const json = require('../../shareWording.json');
        if (Array.isArray(json)) {
          wordings = json;
        } else if (json && Array.isArray(json.wordings)) {
          wordings = json.wordings;
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

      // 拼装候选文案（含餐厅名的更具针对性）
      const candidates = [];
      if (name) {
        candidates.push(`今天就吃${name}吧？`);
        candidates.push(`不如试试${name}？`);
        candidates.push(`${name}看起来不错，一起？`);
        candidates.push(`我决定选${name}，走起！`);
      } else {
        candidates.push(...wordings);
      }

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
      try { addPoints && addPoints('share'); } catch (e) { console.warn('addPoints share error', e); }
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
        return cloudImageManager.getCloudImageUrl(key);
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
          return cloudImageManager.getCloudImageUrl(v);
        }
      }

      // 兜底占位图
      return cloudImageManager.getCloudImageUrl('placeholder');
    } catch (e) {
      console.warn('getRestaurantIconPath 解析失败，使用占位图:', e);
      return cloudImageManager.getCloudImageUrl('placeholder');
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
      const recs = generateRecommendations(userData, 12);
      const fmt = (v) => (typeof v === 'number' ? Number(v).toFixed(2) : '--');
      console.log(`[${ts()}] 推荐列表(生成/刷新)：`, recs.map((r, i) => `${i+1}.${r && r.name ? r.name : ''} [总:${fmt(r && r.recommendationScore)} 评:${fmt(r && r.specificScore)} 偏:${fmt(r && r.preferenceScore)}]`));
      const count = 12;
      const step = 360 / count;
      const { wheelRadius, labelOuterMargin, labelInnerMargin, labelMinStep, labelMaxStep } = this.data;
      const pointerAngle = 0; // 修正：指针在CSS中位于top位置，对应0°

      // 保持推荐顺序(1..12)，不因指针对齐而重排
      const segments = Array.from({ length: count }, (_, idx) => {
        const r = recs[idx];
        const name = (r && r.name) ? r.name : '';
        const nameChars = String(name).split('');
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
          icon: this.getRestaurantIconPath(name),
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
      console.log(`[${ts()}] 生成转盘(12)：`, listLog);

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
        console.log(`[${ts()}] 换一批后推荐列表（带变更标记）：\n${diffLines.join('\n')}`);
      } else {
        const initLines = segments.map(s => `${s.slotNo}. ${s.name} [总:${fmt(s.recommendationScore)} 评:${fmt(s.specificScore)} 偏:${fmt(s.preferenceScore)}]`);
        console.log(`[${ts()}] 初始推荐列表：\n${initLines.join('\n')}`);
      }

      // 调试：输出所有段的角度位置
      console.log(`[${ts()}] 段角度调试：`, segments.map((s, i) => `${s.slotNo}.${s.name}@${s.angle}°`));

      const base = { segments, selected: null, showDecisionLayer: false, displayOrder };
      if (!preserveRotation) {
        // 让 slot 1(segments[0]) 的中心角对齐到 pointerAngle
        const s0Angle = segments[0].angle; // step/2
        const rotationOffset = ((pointerAngle - s0Angle) % 360 + 360) % 360;
        base.rouletteRotation = rotationOffset;
        console.log(`[${ts()}] 初始对齐：基于段中心角 s0=${s0Angle}°，设置 rotation=${rotationOffset}°`);

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
        console.log(`[${ts()}] 初始化完成：当前指向 编号=${pointed.slotNo}，餐厅="${pointed.name}"`);
        
        // 调试：输出所有段旋转后的实际位置
        console.log(`[${ts()}] 旋转后段位置：`, segments.map((s, i) => {
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
    console.log(`[${ts()}] 手动刷新：换一批推荐（12家），并将指针对齐第1名`);
    // 重新生成12家推荐并重置旋转到slot1
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

    // 积分：转动转盘
    try { addPoints && addPoints('spin'); } catch (e) { console.warn('addPoints spin error', e); }

    // 恢复正常旋转：随机角度 + 多圈旋转
    const minSpins = 3; // 最少3圈
    const maxSpins = 6; // 最多6圈
    const randomSpins = minSpins + Math.random() * (maxSpins - minSpins);
    const randomAngle = Math.random() * 360; // 随机停止角度
    const totalDelta = randomSpins * 360 + randomAngle;
    
    console.log(`[${ts()}] 开始转动：+${totalDelta.toFixed(1)}°（${randomSpins.toFixed(1)}圈+${randomAngle.toFixed(1)}°），当前累计角度=${this.data.rouletteRotation}`);

    this.setData({ rouletteRotation: this.data.rouletteRotation + totalDelta, showDecisionLayer: false });

    // 与 .roulette-wheel 的 transition: 3.2s 对齐，延迟调整确保动画完成
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
          return;
        }

        // 转动结束日志：编号与命中餐厅
        console.log(`[${ts()}] 转动结束：指针编号=${hit.slotNo}，餐厅="${hit.name}"，finalRotation=${finalRotation.toFixed(1)}，effectiveRot=${effectiveRot.toFixed(1)}，step=${step}`);

        // 命中后重置首页 logo 扩展名重试计数
        this.setData({ selected: hit, showDecisionLayer: true, showShareArea: false, isSpinning: false, logoRetryMap: {} });
      } catch (e) {
        console.error(`[${ts()}] 转盘数据异常`, e);
        this.setData({ isSpinning: false });
      }
    }, 3400);

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
    console.log('🖐️ 触摸开始:', {
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
      console.log('👆 手势移动:', {
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
    
    console.log('🏁 触摸结束 - 手势分析:', {
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
    
    console.log('📋 手势识别条件检查:', conditions);
    
    const allConditionsMet = Object.values(conditions).every(c => c.passed);
    
    if (allConditionsMet) {
      console.log('✅ 上滑手势识别成功，触发分享功能');
      this.triggerShare();
    } else {
      const failedConditions = Object.entries(conditions)
        .filter(([key, condition]) => !condition.passed)
        .map(([key]) => key);
      console.log('❌ 上滑手势识别失败，未满足条件:', failedConditions);
    }
    
    // 清理移动日志计时器
    this._lastMoveLog = null;
  },

  // XR 场景就绪
  onXrReady({ detail }) {
    try {
      this._xrScene = detail && detail.value;
      console.log('XR scene ready:', !!this._xrScene);
    } catch(e) { console.warn('XR scene not ready', e); }
  },

  // 触发分享功能
  async triggerShare() {
    console.log('🚀 === 开始分享功能检查流程 ===');
    
    // 1. 检查微信环境和API可用性
    this.checkWeChatEnvironment();
    
    // 2. 检查分享组件状态
    this.checkShareComponents();
    
    try {
      console.log('📸 尝试XR-Frame分享系统');
      // 优先使用 XR-Frame ShareSystem
      const xrResult = await this.captureWithXR().catch((error) => {
        console.error('XR分享捕获异常:', error);
        return null;
      });
      
      if (xrResult === 'success') {
        console.log('✅ XR分享已完成，流程结束');
        return;
      } else if (xrResult) {
        console.log('📤 XR返回图片路径，调用微信分享:', xrResult);
        this.shareToWeChat(xrResult);
        return;
      } else {
        console.log('⚠️ XR分享未返回有效结果，继续Canvas方案');
      }
    } catch(e) {
      console.error('❌ XR分享失败:', e);
    }
    
    try {
      console.log('🖼️ 尝试Canvas截图方案');
      // 回落到 Canvas 截图
      const fallback = await this.captureWithCanvas();
      if (fallback) {
        console.log('📤 Canvas截图成功，调用微信分享:', fallback);
        this.shareToWeChat(fallback);
        return;
      } else {
        console.log('⚠️ Canvas截图未返回有效结果');
      }
    } catch(e) {
      console.error('❌ Canvas截图失败:', e);
    }
    
    console.log('📝 使用最终退化方案：仅文字分享');
    // 最终退化：仅文字分享
    this.shareToWeChat();
    
    console.log('🏁 === 分享功能检查流程结束 ===');
  },
  
  // 检查微信环境和API可用性
  checkWeChatEnvironment() {
    console.log('🔍 检查微信环境:');
    
    const checks = {
      微信对象: typeof wx !== 'undefined',
      分享API: typeof wx.shareAppMessage === 'function',
      截图API: typeof wx.canvasToTempFilePath === 'function',
      文件系统: typeof wx.getFileSystemManager === 'function',
      选择器查询: typeof wx.createSelectorQuery === 'function'
    };
    
    console.log('📋 微信API检查结果:', checks);
    
    const unavailableAPIs = Object.entries(checks)
      .filter(([key, available]) => !available)
      .map(([key]) => key);
      
    if (unavailableAPIs.length > 0) {
      console.warn('⚠️ 不可用的微信API:', unavailableAPIs);
    } else {
      console.log('✅ 所有微信API检查通过');
    }
    
    // 检查微信版本信息
    try {
      const systemInfo = wx.getSystemInfoSync();
      console.log('📱 系统信息:', {
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
    console.log('🔍 检查分享组件状态:');
    
    // 检查XR场景
    const xrStatus = {
      场景对象: !!this._xrScene,
      场景类型: typeof this._xrScene,
      XR元素存在: !!wx.createSelectorQuery().select('#xr-scene')
    };
    
    console.log('🎮 XR组件状态:', xrStatus);
    
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
      
      console.log('🖼️ Canvas组件状态:', canvasStatus);
    });
    
    // 检查数据状态
    const dataStatus = {
      选中餐厅: !!this.data.selected,
      餐厅名称: this.data.selected ? this.data.selected.name : '无',
      分享文案: this.data.shareText || '无',
      轮盘数据: this.data.segments ? this.data.segments.length : 0
    };
    
    console.log('📊 数据状态:', dataStatus);
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
                console.log('Canvas截图成功:', res2.tempFilePath);
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
  onSelectedLogoError() {
    try {
      const sel = this.data.selected;
      if (!sel || !sel.name) return;

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
      console.log(`[${ts()}] Logo加载失败：${sel.name} (${name}), 重试次数：${retryCount}`);

      let nextPromise;
      if (retryCount === 0) {
        // 先尝试 png（临时 https）
        nextPromise = Promise.resolve(cloudImageManager.getTempHttpsUrl(name, 'png'));
      } else if (retryCount === 1) {
        // 再尝试 jpg
        nextPromise = Promise.resolve(cloudImageManager.getTempHttpsUrl(name, 'jpg'));
      } else if (retryCount === 2) {
        // 再尝试 webp
        nextPromise = Promise.resolve(cloudImageManager.getTempHttpsUrl(name, 'webp'));
      } else {
        // 最终回退到本地占位图（项目内已有svg占位）
        nextPromise = Promise.resolve(this.data.placeholderImageUrl || '/images/placeholder.svg');
      }

      const newLogoRetryMap = { ...this.data.logoRetryMap };
      newLogoRetryMap[name] = retryCount + 1;

      nextPromise.then((nextUrl) => {
        this.setData({
          'selected.icon': nextUrl,
          logoRetryMap: newLogoRetryMap
        });
      }).catch(() => {
        // 兜底静默：使用本地占位图
        const fallback = this.data.placeholderImageUrl || '/images/placeholder.svg';
        this.setData({
          'selected.icon': fallback,
          logoRetryMap: newLogoRetryMap
        });
      });
    } catch (e) {
      console.warn('onSelectedLogoError 异常', e);
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
    
    // 创建新餐厅对象，参照欢迎页逻辑
    const newRestaurant = {
      id: userAddedId,
      sid: userAddedId,
      name: restaurantName,
      category: '自定义',
      rating: 0,
      icon: '/images/placeholder.svg',
      logoPath: '/images/placeholder.svg',
      hdLogoPath: '/images/placeholder.svg',
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

    // 立即刷新转盘：重新生成12家推荐并重置到第1名
    try {
      this.initWheel(false);
    } catch (e) {
      console.warn('刷新转盘失败', e);
    }
  }
});