// packageB/pages/voice/index.js
// 职场嘴替页面（分包B）
const dataManager = require('../../../utils/dataManager');

Page({
  data: {
    // 显示状态
    isLoading: true,
    currentMode: 'quote', // 'quote' | 'vote'
    currentIndex: 0,
    
    // 数据源
    quotes: [],
    voteTopics: [],
    
    // 计算后数据（用于模板渲染）
    filteredItems: [],
    currentItem: null,
    
    // 筛选
    selectedTag: 'all',
    availableTags: ['all'],
    showFilterModal: false,
    
    // 已读记录
    readQuotes: [],
    readVotes: [],
    
    // 分享状态
    isGeneratingShare: false,
    shareImageUrl: ''
  },

  onLoad: function (options) {
    // 支持从分享进入指定模式/卡片
    const mode = options && options.mode ? options.mode : 'quote';
    const id = options && options.id ? options.id : null;
    this.setData({ currentMode: mode });

    // 移除分包内容提供器注入，改为统一由 dataManager 读取主包 JSON/JS

    this.loadData(id);

    // 显示分享菜单（含朋友圈）
    try {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    } catch (e) { /* ignore */ }
  },

  onShow: function () {
    // 自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  /**
   * 加载数据
   */
  loadData: function (targetId) {
    try {
      // 获取语录和投票数据
      const voiceData = dataManager.getAppContent();
      const quotes = voiceData.quotes || [];
      const voteTopics = voiceData.topics || [];
      
      // 规范化语录内容（兼容 {zh,en} 与字符串）
      const normalizedQuotes = quotes.map(q => ({
        ...q,
        content: this.normalizeQuoteContentToString(q.content),
        contentZhEn: this.normalizeQuoteContent(q.content)
      }));
      
      // 提取所有标签
      const quoteTags = [...new Set(normalizedQuotes.flatMap(q => q.tags || []))];
      const voteTags = [...new Set(voteTopics.flatMap(v => v.tags || []))];
      const allTags = [...new Set(['all', ...quoteTags, ...voteTags])];
      
      // 加载已读记录
      const readQuotes = wx.getStorageSync('voice_read_quotes') || [];
      const readVotes = wx.getStorageSync('voice_read_votes') || [];
      
      this.setData({
        quotes: normalizedQuotes,
        voteTopics,
        availableTags: allTags,
        readQuotes,
        readVotes,
        isLoading: false
      }, () => {
        // 计算筛选列表与当前项
        this.updateComputed(targetId);
      });
      
      console.log('职场嘴替数据加载完成:', {
        quotes: normalizedQuotes.length,
        voteTopics: voteTopics.length,
        tags: allTags.length
      });
      
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      console.error('职场嘴替数据加载失败:', error);
    }
  },

  /**
   * 根据当前模式/标签/索引，更新 filteredItems 与 currentItem
   */
  updateComputed: function (targetId) {
    const { currentMode, selectedTag, quotes, voteTopics, currentIndex } = this.data;
    const sourceItems = currentMode === 'quote' ? quotes : voteTopics;

    const filtered = selectedTag === 'all' 
      ? sourceItems 
      : sourceItems.filter(item => item.tags && item.tags.includes(selectedTag));

    // 计算索引：优先查找目标ID；否则使用当前索引并夹紧
    let idx = currentIndex;
    if (targetId) {
      const found = filtered.findIndex(i => String(i.id) === String(targetId));
      if (found >= 0) idx = found;
    }
    if (filtered.length === 0) {
      this.setData({ filteredItems: [], currentItem: null, currentIndex: 0 });
      return;
    }
    const clamped = Math.max(0, Math.min(idx, filtered.length - 1));

    // 针对投票话题，补充展示所需的百分比字段（占位/稳定伪随机）
    let currentItem = filtered[clamped];
    if (currentMode === 'vote' && currentItem) {
      const pA = this.estimatePercent(currentItem.id);
      currentItem = Object.assign({}, currentItem, { percentA: pA, percentB: 100 - pA });
    }

    // 预先计算 tagsText，避免在 WXML 中使用 join
    const tags = (currentItem && currentItem.tags) || [];
    const tagsText = tags.length ? ('#' + tags.join(' / #')) : '';

    this.setData({ filteredItems: filtered, currentItem: { ...currentItem, tagsText }, currentIndex: clamped }, () => {
      this.markAsRead();
    });
  },

  /**
   * 根据ID生成稳定的占位百分比（20%~80%）
   */
  estimatePercent: function (id) {
    const n = parseInt(id, 10);
    if (isNaN(n)) return 50;
    const v = (n * 37) % 61 + 20; // 20..80
    return Math.max(20, Math.min(80, v));
  },

  /**
   * 切换模式（语录/投票）
   */
  onModeChange: function (e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ currentMode: mode, currentIndex: 0 }, () => this.updateComputed());
  },

  /**
   * 上一项
   */
  onPrevious: function () {
    const items = this.data.filteredItems || [];
    if (items.length === 0) return;
    const newIndex = this.data.currentIndex > 0 ? this.data.currentIndex - 1 : items.length - 1;
    this.setData({ currentIndex: newIndex, currentItem: items[newIndex] }, () => this.markAsRead());
  },

  /**
   * 下一项
   */
  onNext: function () {
    const items = this.data.filteredItems || [];
    if (items.length === 0) return;
    const newIndex = this.data.currentIndex < items.length - 1 ? this.data.currentIndex + 1 : 0;
    this.setData({ currentIndex: newIndex, currentItem: items[newIndex] }, () => this.markAsRead());
  },

  /**
   * 选择筛选标签
   */
  onTagSelect: function (e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ selectedTag: tag, currentIndex: 0, showFilterModal: false }, () => this.updateComputed());
  },

  /** 显示/隐藏筛选弹窗 */
  showFilter: function () { this.setData({ showFilterModal: true }); },
  hideFilter: function () { this.setData({ showFilterModal: false }); },

  /**
   * 生成分享图片（旧版 Canvas API，兼容性更好）
   */
  generateShareImage: function (cb) {
    const dpr = wx.getSystemInfoSync().pixelRatio || 2;
    const width = 750;   // rpx 对标 px（导出按比例）
    const height = 600;
    const canvasId = 'shareCanvas';
    const ctx = wx.createCanvasContext(canvasId, this);

    // 页面背景渐变（模拟职场嘴替页面背景）
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#74b9ff');
    gradient.addColorStop(0.5, '#0984e3');
    gradient.addColorStop(1, '#6c5ce7');
    ctx.setFillStyle(gradient);
    ctx.fillRect(0, 0, width, height);

    // 卡片背景（使用与页面一致的玻璃效果背景色）
    const cardPadding = 32;
    ctx.setFillStyle('rgba(255, 255, 255, 0.18)');
    ctx.fillRect(cardPadding, cardPadding + 40, width - cardPadding * 2, height - cardPadding * 2 - 40);
    
    // 卡片边框
    ctx.setStrokeStyle('rgba(255, 255, 255, 0.35)');
    ctx.setLineWidth(2);
    ctx.strokeRect(cardPadding, cardPadding + 40, width - cardPadding * 2, height - cardPadding * 2 - 40);

    // 标题
    ctx.setFillStyle('rgba(255, 255, 255, 0.95)');
    ctx.setFontSize(28);
    ctx.setTextAlign('left');
    ctx.fillText('职场嘴替', cardPadding, 40);

    // 内容
    const { currentItem, currentMode } = this.data;
    const contentAreaX = cardPadding + 24;
    const contentAreaY = cardPadding + 40 + 40;
    const contentAreaW = width - (cardPadding + 24) * 2;

    ctx.setFillStyle('rgba(255, 255, 255, 0.95)');
    ctx.setFontSize(36);

    if (currentMode === 'quote') {
      const text = (currentItem && currentItem.content) ? `“${currentItem.content}”` : '';
      this.drawWrappedText(ctx, text, contentAreaX, contentAreaY, contentAreaW, 54, 6);
    } else {
      const title = currentItem ? currentItem.topic : '';
      ctx.setFillStyle('rgba(255, 255, 255, 0.95)');
      this.drawWrappedText(ctx, title, contentAreaX, contentAreaY, contentAreaW, 54, 3);

      // 选项
      ctx.setFontSize(28);
      ctx.setFillStyle('rgba(255, 255, 255, 0.85)');
      const top2 = contentAreaY + 3 * 54 + 20;
      const aText = `A. ${currentItem ? currentItem.optionA : ''}  ${currentItem ? (currentItem.percentA || 0) : 0}%`;
      const bText = `B. ${currentItem ? currentItem.optionB : ''}  ${currentItem ? (currentItem.percentB || 0) : 0}%`;
      ctx.fillText(aText, contentAreaX, top2);
      ctx.fillText(bText, contentAreaX, top2 + 40);
    }

    // 标签
    const tags = (currentItem && currentItem.tags) || [];
    if (tags.length) {
      ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
      ctx.setFontSize(22);
      const tagLine = `#${tags.join('  #')}`;
      this.drawWrappedText(ctx, tagLine, contentAreaX, height - cardPadding - 30, contentAreaW, 30, 2);
    }

    // 底部署名
    ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
    ctx.setFontSize(22);
    ctx.fillText('来自 Eatigo · 职场嘴替', width - cardPadding - 260, height - 16);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId,
        quality: 1,
        fileType: 'jpg',
        success: (res) => {
          const path = res.tempFilePath;
          this.setData({ shareImageUrl: path });
          cb && cb(null, path);
        },
        fail: (err) => {
          cb && cb(err);
        }
      }, this);
    });
  },

  /**
   * 文本换行绘制
   */
  drawWrappedText: function (ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    if (!text) return y;
    const chars = text.split('');
    let line = '';
    let lineCount = 0;
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && i > 0) {
        ctx.fillText(line, x, y);
        line = chars[i];
        y += lineHeight;
        lineCount++;
        if (maxLines && lineCount >= maxLines - 1) {
          // 最后一行截断
          const remain = chars.slice(i + 1).join('');
          let last = line + remain;
          // 简单截断加省略号
          while (ctx.measureText(last + '…').width > maxWidth && last.length > 0) {
            last = last.slice(0, -1);
          }
          ctx.fillText(last + '…', x, y);
          return y + lineHeight;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
    return y + lineHeight;
  },

  /**
   * 投票选择
   */
  onVoteSelect: function (e) {
    const option = e.currentTarget.dataset.option; // 'A' | 'B'
    const currentItem = this.data.currentItem;
    if (!currentItem || this.data.currentMode !== 'vote') return;

    // 记录到用户数据的contentInteractions
    try {
      const userData = dataManager.getUserData();
      const ci = userData.contentInteractions || { likedQuotes: [], votedTopics: {} };
      ci.votedTopics = ci.votedTopics || {};
      ci.votedTopics[currentItem.id] = option; // 仅记录选择的选项
      dataManager.updateUserData('contentInteractions', ci);
    } catch (err) {
      console.warn('保存投票结果失败（不影响流程）:', err);
    }

    wx.showToast({ title: `你选择了${option === 'A' ? 'A' : 'B'}`, icon: 'success' });
    // 标记已读并跳转到下一项
    this.markAsRead();
    setTimeout(() => { this.onNext(); }, 800);
  },

  /**
   * 分享按钮反馈（实际分享由 onShareAppMessage 或 showShareImageMenu 处理）
   */
  onShare: function () {
    if (!this.data.currentItem) return;
    if (this.data.isGeneratingShare) return;
    this.setData({ isGeneratingShare: true });

    this.generateShareImage((err, path) => {
      this.setData({ isGeneratingShare: false });
      if (err) {
        wx.showToast({ title: '生成图片失败', icon: 'error' });
        console.error('生成分享图失败: ', err);
        return;
      }
      // 若支持直接分享图片
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({
          path,
          success: () => {},
          fail: () => {}
        });
      } else {
        wx.previewImage({ urls: [path] });
      }
    });
  },

  /**
   * 微信分享配置
   */
  onShareAppMessage: function () {
    const promise = new Promise(resolve => {
      try { dataManager.addPoints && dataManager.addPoints('share'); } catch (e) { console.warn('addPoints share error', e); }
      // 尝试生成当前卡片的完整截图
      this.generateShareImage((err, path) => {
        if (err) {
          // 截图失败时仅返回文案
          resolve({ title: '这简直是我的职场嘴替！' });
        } else {
          resolve({ 
            title: '这简直是我的职场嘴替！',
            imageUrl: path 
          });
        }
      });
    });
    
    const item = this.data.currentItem;
    const mode = this.data.currentMode;
    if (!item) {
      return { 
        title: '这简直是我的职场嘴替！', 
        path: '/packageB/pages/voice/index',
        promise
      };
    }
    return {
      title: '这简直是我的职场嘴替！',
      path: `/packageB/pages/voice/index?mode=${mode}&id=${item.id}`,
      promise
    };
  },

  // 朋友圈分享
  onShareTimeline: function () {
    const item = this.data.currentItem;
    const mode = this.data.currentMode;
    const imageUrl = this.data.shareImageUrl || '';
    const query = item ? `mode=${mode}&id=${item.id}` : '';
    const title = item ? (mode === 'quote' ? '职场嘴替 - 语录分享' : '职场嘴替 - 投票话题') : '职场嘴替 - 让AI帮你说话';
    return { title, query, imageUrl };
  },

  /** 点赞/收藏（示意） */
  onLike: function () {
    const item = this.data.currentItem;
    if (!item) return;
    try {
      const userData = dataManager.getUserData();
      const favorites = userData.contentInteractions?.favorites || { quotes: [], votes: [] };
      let added = false;
      if (this.data.currentMode === 'quote') {
        const qid = 'quote_' + String(item.id);
        if (!favorites.quotes.includes(qid)) {
          favorites.quotes.push(qid);
          dataManager.addPoints('bookmark', qid);
          added = true;
        }
      } else {
        const vid = parseInt(item.id);
        if (!favorites.votes.some(v => v.id === vid)) {
          favorites.votes.push({ id: vid, myOption: '' });
          dataManager.addPoints('bookmark', 'vote_' + String(vid));
          added = true;
        }
      }
      if (added) {
        dataManager.updateUserData('contentInteractions.favorites', favorites);
      }
      wx.showToast({ title: '已点赞', icon: 'success' });
    } catch (e) {
      console.warn('点赞同步收藏失败:', e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },
  onBookmark: function () {
    const item = this.data.currentItem;
    if (!item) return;
    try {
      const userData = dataManager.getUserData();
      const favorites = userData.contentInteractions?.favorites || { quotes: [], votes: [] };
      let added = false;
      if (this.data.currentMode === 'quote') {
        const qid = 'quote_' + String(item.id);
        if (!favorites.quotes.includes(qid)) {
          favorites.quotes.push(qid);
          dataManager.addPoints('bookmark', qid);
          added = true;
        }
      } else {
        const vid = parseInt(item.id);
        if (!favorites.votes.some(v => v.id === vid)) {
          favorites.votes.push({ id: vid, myOption: '' });
          dataManager.addPoints('bookmark', 'vote_' + String(vid));
          added = true;
        }
      }
      if (added) {
        dataManager.updateUserData('contentInteractions.favorites', favorites);
      }
      wx.showToast({ title: '已收藏', icon: 'success' });
    } catch (e) {
      console.warn('收藏更新失败:', e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  /**
   * 标记为已读
   */
  markAsRead: function () {
    const item = this.data.currentItem;
    if (!item) return;
    const isQuote = this.data.currentMode === 'quote';
    const storageKey = isQuote ? 'voice_read_quotes' : 'voice_read_votes';
    const readKey = isQuote ? 'readQuotes' : 'readVotes';
    let list = [...this.data[readKey]];
    if (!list.includes(item.id)) {
      list.push(item.id);
      try { wx.setStorageSync(storageKey, list); } catch (e) { console.error('保存已读记录失败:', e); }
      this.setData({ [readKey]: list });
    }
  },

  // 归一化语录内容为 { zh, en }
  normalizeQuoteContent: function(raw) {
    if (raw && typeof raw === 'object') {
      const zh = typeof raw.zh === 'string' ? raw.zh : '';
      const en = typeof raw.en === 'string' ? raw.en : '';
      return { zh, en };
    }
    if (typeof raw === 'string') {
      return { zh: raw, en: '' };
    }
    return { zh: '', en: '' };
  },

  // 将语录内容归一化为字符串（优先中文）
  normalizeQuoteContentToString: function(raw) {
    if (raw && typeof raw === 'object') {
      return typeof raw.zh === 'string' ? raw.zh : (typeof raw.en === 'string' ? raw.en : '');
    }
    if (typeof raw === 'string') return raw;
    return '';
  }
});