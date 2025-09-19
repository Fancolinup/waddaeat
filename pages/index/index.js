// pages/index/index.js
const { getUserData, updateUserData, addDecisionRecord } = require('../../utils/dataManager');
const { generateRecommendations } = require('../../utils/recommendation');
const { updateRestaurantScore } = require('../../utils/scoringManager');
const { updateUserPreference } = require('../../utils/preferenceLearner');
// removed: const shareWording = require('../../shareWording.json');

// 调试时间戳辅助
const ts = () => new Date().toISOString();

Page({
  data: {
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

    // 备选
    shortlist: [],
    placeholderSlots: [0,0,0],
    activeShortlistId: '',

    // 分享
    shareText: '今天吃什么？',
    shareTargetName: '',

    // 顶部问候（UI已移除，逻辑保留以便未来需要）
    greeting: '',
    currentTime: '',

    // 文案径向布局参数（从外向内排列，末端离圆心 5rpx）
    labelOuterMargin: 60,      // 距离外缘的安全边距（rpx）— 更靠近边缘但不贴边
    labelInnerMargin: 40,      // 末端距离圆心（rpx）
    labelMinStep: 22,          // 字符最小步进（rpx）— 略增字距
    labelMaxStep: 34,          // 字符最大步进（rpx）— 略增字距

    // 配色切换
    currentPaletteKey: 'b',
    paletteKeys: ['b','a','f','g'],
    
    // 基于当前显示顺序的编号数组（1..12 -> segment索引），用于日志与后续扩展
    displayOrder: []
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

  onUnload() {
    if (this._clock) {
      clearInterval(this._clock);
      this._clock = null;
    }
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

  /** 获取品牌拼音映射（与欢迎页保持一致） */
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
      "谭鸭血": "tanyaxie",
      "大娘水饺": "daniangshuijiao",
      "苏小柳": "suxiaoliu",
      "蔡澜港式点心": "cailangangshidianxin",
      "添好运": "tianhaoyun",
      "很久以前羊肉串": "henjiuyiqianyangrouchuan",
    };
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
        return `/packageA/images/FullRest/${key}.png`;
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
          return `/packageA/images/FullRest/${v}.png`;
        }
      }

      // 兜底占位图
      return '/packageA/images/FullRest/placeholder.png';
    } catch (e) {
      console.warn('getRestaurantIconPath 解析失败，使用占位图:', e);
      return '/packageA/images/FullRest/placeholder.png';
    }
  },

  // 初始化轮盘（12个推荐）
  initWheel(preserveRotation = false) {
    try {
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
    if (this.data.isSpinning) return; // 防重复触发
    this.setData({ isSpinning: true });

    // 恢复正常旋转：随机角度 + 多圈旋转
    const minSpins = 3; // 最少3圈
    const maxSpins = 6; // 最多6圈
    const randomSpins = minSpins + Math.random() * (maxSpins - minSpins);
    const randomAngle = Math.random() * 360; // 随机停止角度
    const totalDelta = randomSpins * 360 + randomAngle;
    
    console.log(`[${ts()}] 开始转动：+${totalDelta.toFixed(1)}°（${randomSpins.toFixed(1)}圈+${randomAngle.toFixed(1)}°），当前累计角度=${this.data.rouletteRotation}`);

    this.setData({ rouletteRotation: this.data.rouletteRotation + totalDelta, showDecisionLayer: false });

    // 与 .roulette-wheel 的 transition: 2.8s 对齐，略放宽
    setTimeout(() => {
      const pointerAngle = 0; // 修正：指针在CSS中位于top位置，对应0°
      const count = this.data.segments.length;
      const step = 360 / count;
      const finalRotation = this.data.rouletteRotation; // 最终累计角度
      const effectiveRot = ((finalRotation % 360) + 360) % 360;

      // 基于段中心角的鲁棒命中：寻找与指针角差最小的段
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

      this.setData({ selected: hit, showDecisionLayer: true, showShareArea: false, isSpinning: false });
    }, 3100);
  },

  onReroll() {
    if (this.data.isSpinning) return; // 动画期间禁止再次触发
    const sel = this.data.selected;
    if (sel) {
      const userData = getUserData();
      updateRestaurantScore(userData, String(sel.id), 'reject', { name: sel.name });
      try { updateUserPreference(String(sel.id), 'dislike'); } catch(e) {}
      try { addDecisionRecord({ id: String(sel.id), name: sel.name, action: 'reject', source: 'roulette' }); } catch(e) {}
    }
    this.setData({ showDecisionLayer: false, showShareArea: false });
    // 保持累计角度与当前显示顺序；不刷新 segments
    this.spinRoulette();
  },

  onAccept() {
    const sel = this.data.selected;
    if (!sel) return;
    const userData = getUserData();
    updateRestaurantScore(userData, String(sel.id), 'accept', { name: sel.name });
    try { updateUserPreference(String(sel.id), 'like'); } catch(e) {}
    try { addDecisionRecord({ id: String(sel.id), name: sel.name, action: 'accept', source: 'roulette' }); } catch(e) {}

    // 锁定分享餐厅，生成文案并展示分享区，隐藏结果浮层
    this.setData({ shareTargetName: sel.name, showShareArea: true, showDecisionLayer: false });
    this.loadShareText();
    wx.showToast({ title: '已记录，就它了', icon: 'success' });
  },

  onAddShortlist() {
    const sel = this.data.selected;
    if (!sel) return;
    const list = this.data.shortlist.slice(0,3);
    if (list.find(x => x.id === sel.id)) { this.setData({ showDecisionLayer: false }); return; }
    if (list.length >= 3) { 
      this.setData({ showDecisionLayer: false }); 
      wx.showToast({ title: '备选区已满，请先删除', icon: 'none' });
      return; 
    }
    list.push(sel);
    this.setData({ shortlist: list, showDecisionLayer: false });
    this.updatePlaceholderSlots();
  },

  onRemoveShort(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ shortlist: this.data.shortlist.filter(x => x.id !== id) });
    this.updatePlaceholderSlots();
  },

  onTapShortlistCard(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id || !name) return;
    this.setData({ activeShortlistId: id, shareTargetName: name, showShareArea: true });
    this.loadShareText();
    setTimeout(() => {
      if (this.data.activeShortlistId === id) {
        this.setData({ activeShortlistId: '' });
      }
    }, 900);
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

   // Share wording（懒加载 + 文件系统兜底，兼容真机与开发者工具）
  loadShareText(excludeText = '') {
     // 内嵌文案数据作为兜底
     const fallbackWording = [
       "有没有人一起去{restaurant}，我觉得不错～",
       "要不要试试{restaurant}，今天感觉很合适！",
       "我提议{restaurant}，大家意下如何？",
       "今天突然很想吃{restaurant}，有人一起吗？",
       "吃{restaurant}可好？简单省事～",
       "刚想到{restaurant}，大家要不要去？",
       "要不要去{restaurant}，挺想吃的～",
       "{restaurant}怎么样？大家一起？",
       "饭点到了，别卷了，{restaurant}走起？",
       "今天就{restaurant}了，有意见吗？",
       "投票{restaurant}，同意的举手！",
       "不如去{restaurant}，省得纠结～",
       "突然想到{restaurant}，要不要试试？",
       "今天心情适合{restaurant}，走吗？",
       "决定了，{restaurant}！有人反对吗？",
       "要不{restaurant}？感觉挺好的～",
       "提名{restaurant}，大家觉得呢？",
       "今天就{restaurant}吧，别再犹豫了～",
       "心血来潮想吃{restaurant}，一起？",
       "不如{restaurant}，简单直接！"
     ];

     // 1) 动态 require（新基础库与开发者工具通常可用）
     let arr = [];
     try {
       const maybe = require('../../shareWording.json');
       if (Array.isArray(maybe)) {
         arr = maybe;
         console.log('通过require加载文案成功:', arr.length, '条');
       }
     } catch (e) {
       console.log('require加载失败:', e.message);
       // ignore and fallback
     }

     // 2) 文件系统兜底，多路径尝试
     if (!arr.length && wx.getFileSystemManager) {
       try {
         const fsm = wx.getFileSystemManager();
         const candidates = [
           'shareWording.json', '/shareWording.json', './shareWording.json',
           '../../shareWording.json', '../shareWording.json', 'utils/../shareWording.json'
         ];
         for (let i = 0; i < candidates.length && !arr.length; i++) {
           try {
             const content = fsm.readFileSync(candidates[i], 'utf-8');
             const parsed = JSON.parse(content);
             if (Array.isArray(parsed)) {
               arr = parsed;
               console.log('通过文件系统加载文案成功:', candidates[i], arr.length, '条');
             }
           } catch (ignore) {
             console.log('尝试路径失败:', candidates[i]);
           }
         }
       } catch (ignoreFs) {
         console.log('文件系统不可用:', ignoreFs.message);
       }
     }

     // 3) 使用内嵌文案作为最终兜底
     if (!arr.length) {
       arr = fallbackWording;
       console.log('使用内嵌文案:', arr.length, '条');
     }

     console.log('最终文案数组长度:', arr.length);

     // 4) 设置文案（优先使用锁定餐厅名），并避免与上次重复
     const targetName = this.data.shareTargetName || (this.data.selected ? this.data.selected.name : '它');
     if (arr.length) {
        // 先过滤掉与当前文案相同的模板
        let availableTemplates = arr.slice();
        if (excludeText) {
          availableTemplates = arr.filter(tpl => tpl.replace('{restaurant}', targetName) !== excludeText);
          // 如果过滤后没有可用模板，则使用全部模板
          if (availableTemplates.length === 0) {
            availableTemplates = arr.slice();
          }
        }
        
        const tpl = availableTemplates[Math.floor(Math.random() * availableTemplates.length)] || '';
        const text = tpl.replace('{restaurant}', targetName);
        this.setData({ shareText: text });
        
        // 添加调试信息
        console.log('刷新文案:', { excludeText, newText: text, targetName, availableCount: availableTemplates.length });
     } else {
       const fallbackText = `今天吃什么？不如试试${targetName}`;
       this.setData({ shareText: fallbackText });
       console.log('使用最终兜底文案:', fallbackText);
     }
   },

  // 维护备选占位数量（容量=3）
  updatePlaceholderSlots() {
    const n = Math.max(0, 3 - (this.data.shortlist ? this.data.shortlist.length : 0));
    this.setData({ placeholderSlots: Array(n).fill(0) });
  }
});