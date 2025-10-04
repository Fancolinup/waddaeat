// pages/profile/selections/index.js
const dm = require('../../../utils/dataManager');
const { cloudImageManager } = require('../../../utils/cloudImageManager');
let scoring = null;
try { scoring = require('../../../utils/scoringManager'); } catch (e) { scoring = null; }
let pref = null;
try { pref = require('../../../utils/preferenceLearner'); } catch (e) { pref = null; }

Page({
  data: {
    // 选中品牌气泡模型：[{ name, selected, userAdded, logoPath }]
    brands: [],
    // 初始品牌集合（用于对比增删）
    originalBrands: [],
    // 是否有未保存改动
    dirty: false,
    // pinyin 映射（用于logo路径推断）
    pinyinMap: {},
    // 最近“就它了”记录
    recentAccepts: [],
    // logo加载失败重试计数（按品牌名记录）
    logoRetryMap: {}
  },
  onLoad() {
    console.log('[Selections] 页面加载开始');
    // 预载 pinyin 映射
    try {
      const pinyin = require('../../../restaurant_pinyin.js');
      console.log('[Selections] 拼音映射加载成功:', Object.keys(pinyin || {}).length, '个映射');
      console.log('[Selections] 拼音映射内容示例:', Object.entries(pinyin || {}).slice(0, 5));
      this.setData({ pinyinMap: pinyin || {} });
    } catch (e) {
      console.error('[Selections] 拼音映射加载失败:', e);
      this.setData({ pinyinMap: {} });
    }
  },
  onShow() {
    this.refresh();
  },
  onPullDownRefresh() {
    this.refresh(() => wx.stopPullDownRefresh());
  },
  // 根据 userData 构造品牌气泡
  refresh(cb) {
    try {
      const userData = dm.getUserData();
      // 构造品牌模型
      let brands = (userData && Array.isArray(userData.welcomeSelectionsByBrand))
        ? userData.welcomeSelectionsByBrand.slice() : [];
      if (!brands.length) {
        const cached = wx.getStorageSync('welcomeSelectionsByBrand');
        if (Array.isArray(cached)) brands = cached.slice();
      }
      const models = this.buildBrandModels(brands);

      // 构造最近“就它了”列表（仅保留用户手动点击“就它”的记录；取最近20条）
      const his = Array.isArray(userData.decisionHistory) ? userData.decisionHistory.slice() : [];
      const accepts = his
        .filter(r => {
          if (!r) return false;
          const isAccept = r.action === 'accept';
          // 计入转盘“就它了”以及备选清单的确认
          const isFromJustIt = r.source === 'roulette' || r.type === 'roulette' || r.origin === 'justit' || r.source === 'shortlist';
          return isAccept && isFromJustIt;
        })
        .sort((a, b) => {
          const ta = new Date(a.timestamp || a.time || 0).getTime();
          const tb = new Date(b.timestamp || b.time || 0).getTime();
          return tb - ta;
        })
        .slice(0, 20)
        .map((r, idx) => {
          const name = r.name || r.brand || r.restaurantName || this.getNameById(r.id || r.restaurantId) || '未知餐厅';
          return {
            name,
            timeText: this.formatTime(r.timestamp || r.time),
            logoPath: this.resolveLogo(name),
            wheelType: r.wheelType || 'restaurant'
          };
        });

      this.setData({
        brands: models,
        originalBrands: models.filter(x => x.selected).map(x => x.name),
        dirty: false,
        recentAccepts: accepts
      });
    } catch (e) {
      console.warn('[Selections] refresh error', e);
    } finally {
      cb && cb();
    }
  },
  // 根据id从静态数据获取名称
  getNameById(id){
    if (!id) return '';
    try {
      const ds = require('../../../restaurant_data.js');
      const list = Array.isArray(ds) ? ds : (ds && (ds.restaurants || ds.list)) || [];
      const it = list.find(r => String(r.id != null ? r.id : r.sid) === String(id));
      return it ? (it.name || it.brand || it.title || '') : '';
    } catch(e){ return ''; }
  },
  formatTime(ts){
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const y = d.getFullYear();
      const m = (d.getMonth()+1).toString().padStart(2,'0');
      const day = d.getDate().toString().padStart(2,'0');
      const h = d.getHours().toString().padStart(2,'0');
      const mi = d.getMinutes().toString().padStart(2,'0');
      return `${y}-${m}-${day} ${h}:${mi}`;
    } catch(e){ return String(ts); }
  },
  onHistoryLogoError(e){
    const name = e.currentTarget.dataset.name;
    console.log('[Selections] 历史记录logo加载失败 - 餐厅名称:', name);
    console.log('[Selections] 错误详情:', e.detail);
    const idx = this.data.recentAccepts.findIndex(item => item.name === name);
    if (idx === -1) {
      console.warn('[Selections] 未找到对应的历史记录项:', name);
      return;
    }
    
    // 使用云端占位符图片，确保一定可见
    const placeholderUrl = cloudImageManager.getCloudImageUrl('placeholder', 'png');
    console.log('[Selections] 设置占位符URL:', placeholderUrl);
    this.setData({ [`recentAccepts[${idx}].logoPath`]: placeholderUrl });
    console.log('[Selections] 历史记录logo加载失败，使用占位符:', name);
  },
  // 将品牌名数组转换为界面模型
  buildBrandModels(brandNames) {
    console.log('[Selections] 构建品牌模型，输入品牌:', brandNames);
    const uniq = Array.from(new Set((brandNames || []).map(n => String(n).trim()).filter(Boolean)));
    console.log('[Selections] 去重后品牌:', uniq);
    let ds = null;
    try { ds = require('../../../restaurant_data.js'); } catch(e) { ds = null; }
    const list = Array.isArray(ds) ? ds : (ds && (ds.restaurants || ds.list)) || [];
    const models = uniq.map(name => {
      const found = list.find(r => (r.name || r.brand || r.title) === name);
      const logoPath = this.resolveLogo(name);
      console.log('[Selections] 品牌模型:', name, '-> logoPath:', logoPath);
      return {
        name,
        selected: true,
        userAdded: !found,
        logoPath
      };
    });
    console.log('[Selections] 最终品牌模型:', models);
    return models;
  },
  // 解析 logo 路径（优先按拼音命名；按 png->jpg->webp 回退；最后占位）
  resolveLogo(name) {
    try {
      console.log('[Selections] 解析logo路径 - 餐厅名称:', name);
      console.log('[Selections] 拼音映射数据:', this.data.pinyinMap);
      const py = this.data.pinyinMap[name];
      console.log('[Selections] 找到拼音映射:', name, '->', py);
      if (py) {
        const logoUrl = cloudImageManager.getCloudImageUrl(py, 'png');
        console.log('[Selections] 生成logo URL:', logoUrl);
        return logoUrl;
      } else {
        console.warn('[Selections] 未找到拼音映射，餐厅名称:', name);
        // 使用云端placeholder图片
        return cloudImageManager.getCloudImageUrl('placeholder', 'png');
      }
    } catch (e) {
      console.error('[Selections] 解析logo路径出错:', e);
    }
    // 使用云端placeholder图片
    return cloudImageManager.getCloudImageUrl('placeholder', 'png');
  },
  onLogoError(e){
    const name = e.currentTarget.dataset.name;
    console.log('[Selections] Logo加载失败，餐厅名称:', name);
    // 使用云端placeholder图片
    const logoPath = cloudImageManager.getCloudImageUrl('placeholder', 'png');
    this.setData({
      [`brands[${e.currentTarget.dataset.index}].logoPath`]: logoPath
    });
  },
  // 切换选中
  toggleSelect(e) {
    const name = e.currentTarget.dataset.name;
    const idx = this.data.brands.findIndex(b => b.name === name);
    if (idx === -1) return;
    const key = `brands[${idx}].selected`;
    this.setData({ [key]: !this.data.brands[idx].selected, dirty: true });
  },
  // 删除品牌
  deleteBrand(e) {
    const name = e.currentTarget.dataset.name;
    const remain = this.data.brands.filter(b => b.name !== name);
    this.setData({ brands: remain, dirty: true });
  },
  // 新增品牌
  addBrand() {
    wx.showModal({
      title: '添加品牌',
      content: '',
      editable: true,
      showCancel: true,
      confirmText: '添加',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const name = res.content.trim();
          if (this.data.brands.some(b=>b.name===name)){
            wx.showToast({ title: '已在列表中', icon: 'none' });
            return;
          }
          const add = { name, selected: true, userAdded: true, logoPath: this.resolveLogo(name) };
          this.setData({ brands: [...this.data.brands, add], dirty: true });
        }
      }
    });
  },
  // 计算变更并保存 + 调用评分与偏好学习
  onConfirm() {
    if (!this.data.dirty) return;
    const nowSelected = this.data.brands.filter(b => b.selected).map(b => b.name);
    const orig = this.data.originalBrands || [];
    const setNow = new Set(nowSelected);
    const setOrig = new Set(orig);
    const added = nowSelected.filter(n => !setOrig.has(n));
    const removed = orig.filter(n => !setNow.has(n));

    // 持久化欢迎页品牌选择
    try {
      dm.updateUserData('welcomeSelectionsByBrand', nowSelected);
      wx.setStorageSync('welcomeSelectionsByBrand', nowSelected);
      wx.setStorageSync('hasShownWelcome', true);
    } catch (e) { console.warn('[Selections] persist brand list failed', e); }

    // 增强的数据同步机制：确保 welcomeSelections（按ID）与 welcomeSelectionsByBrand 一致
    try {
      let userData = dm.getUserData();
      let currentIds = Array.isArray(userData.welcomeSelections) ? userData.welcomeSelections.slice() : [];
      const idsSet = new Set(currentIds.map(String));
      const ds = require('../../../restaurant_data.js');
      const list = Array.isArray(ds) ? ds : (ds && (ds.restaurants || ds.list)) || [];
      
      console.log('[Selections] 数据同步开始 - 添加品牌:', added, '移除品牌:', removed);
      
      // 添加：把同名餐厅 id 全部加入
      added.forEach(name => {
        const matches = list.filter(r => (r.name || r.brand || r.title) === name);
        if (matches.length) {
          matches.forEach(r => {
            const id = String(r.id != null ? r.id : r.sid);
            idsSet.add(id);
            console.log(`[Selections] 添加系统餐厅ID: ${id} (${name})`);
          });
        } else {
          // 无匹配则创建用户自定义虚拟ID，确保使用user_added_前缀
          const userAddedId = `user_added_${name}`;
          idsSet.add(userAddedId);
          console.log(`[Selections] 添加用户自定义餐厅ID: ${userAddedId}`);
        }
      });
      
      // 移除：删掉同名餐厅 id
      removed.forEach(name => {
        const matches = list.filter(r => (r.name || r.brand || r.title) === name).map(r => String(r.id != null ? r.id : r.sid));
        matches.forEach(id => {
          idsSet.delete(String(id));
          console.log(`[Selections] 移除系统餐厅ID: ${id} (${name})`);
        });
        const userAddedId = `user_added_${name}`;
        idsSet.delete(userAddedId);
        console.log(`[Selections] 移除用户自定义餐厅ID: ${userAddedId}`);
      });
      
      const nextIds = Array.from(idsSet);
      console.log('[Selections] 最终同步的餐厅ID列表:', nextIds);
      
      dm.updateUserData('welcomeSelections', nextIds);
      wx.setStorageSync('welcomeSelections', nextIds);
      
      // 数据一致性验证
      const userAddedCount = nextIds.filter(id => id.startsWith('user_added_')).length;
      const brandAddedCount = nowSelected.filter(name => !list.some(r => (r.name || r.brand || r.title) === name)).length;
      if (userAddedCount !== brandAddedCount) {
        console.warn(`[Selections] 数据一致性警告: user_added_餐厅数量(${userAddedCount}) != 品牌自定义数量(${brandAddedCount})`);
      }
    } catch (e) { console.warn('[Selections] sync ID list failed', e); }

    // 写回评分与偏好
    try {
      const userData = dm.getUserData();
      const ds = require('../../../restaurant_data.js');
      const list = Array.isArray(ds) ? ds : (ds && (ds.restaurants || ds.list)) || [];

      const handle = (brandName, action) => {
        // 找到所有同名餐厅，否则构造虚拟自定义餐厅
        const matches = list.filter(r => (r.name || r.brand || r.title) === brandName);
        if (matches.length === 0) {
          const rid = `user_added_${brandName}`;
          const restaurantData = { name: brandName };
          if (scoring && typeof scoring.updateRestaurantScore === 'function') {
            scoring.updateRestaurantScore(userData, rid, action, restaurantData);
          }
          if (pref && typeof pref.updateUserPreference === 'function') {
            const feedback = action === 'accept' ? 'like' : 'dislike';
            pref.updateUserPreference(rid, feedback);
          }
          if (typeof dm.addDecisionRecord === 'function') {
            dm.addDecisionRecord({ action, type: 'profile-selection', restaurantId: rid, brand: brandName });
          }
          return;
        }
        matches.forEach(r => {
          const rid = String(r.id != null ? r.id : r.sid);
          const restaurantData = { name: r.name || r.brand || r.title, basePreferenceScore: r.basePreferenceScore };
          if (scoring && typeof scoring.updateRestaurantScore === 'function') {
            scoring.updateRestaurantScore(userData, rid, action, restaurantData);
          }
          if (pref && typeof pref.updateUserPreference === 'function') {
            const feedback = action === 'accept' ? 'like' : 'dislike';
            pref.updateUserPreference(rid, feedback);
          }
          if (typeof dm.addDecisionRecord === 'function') {
            dm.addDecisionRecord({ action, type: 'profile-selection', restaurantId: rid, brand: restaurantData.name });
          }
        });
      };

      added.forEach(name => handle(name, 'accept'));
      removed.forEach(name => handle(name, 'reject'));
    } catch (e) {
      console.warn('[Selections] scoring/preference writeback failed', e);
    }

    this.setData({ originalBrands: nowSelected, dirty: false });
    wx.showToast({ title: '已更新', icon: 'success' });
  },
  // 单元格点击兼容（保留但不使用）
  tapItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '即将打开详情：' + id, icon: 'none' });
  }
});