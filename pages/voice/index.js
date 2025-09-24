// pages/voice/index.js
// 职场嘴替页面 - 单卡片展示设计
const { ensureContentProviderReady, getAppContent, updateUserData, getUserData, addPoints } = require('../../utils/dataManager');

Page({
  data: {
    // 加载状态
    isLoading: true,
    
    // 卡片数据
    allCards: [], // 所有卡片数据
    currentIndex: 0, // 当前卡片索引
    currentCard: {}, // 当前显示的卡片
    
    // 卡片位置和动画（用于movable-view）
    cardX: 0,
    cardY: 0,
    cardAnimation: false,
    
    // 内部内容的视觉状态（旋转/缩放/透明）
    cardRotate: 0, // deg
    cardScale: 1,
    cardOpacity: 1,
    contentAnimClass: '', // 内容卡片的动画类名（回弹/滑出）
    
    // 用户交互状态
    likedQuotes: [], // 已点赞的语录
    votedTopics: {}, // 已投票的话题
    selectedOption: '', // 当前选中的投票选项
    showVoteResult: false, // 是否显示投票结果
    voteResultA: 0, // 选项A的百分比
    voteResultB: 0, // 选项B的百分比
    
    // 动画状态
    showLikeAnimation: false,
    
    // 筛选功能
    showFilterModal: false,
    filterType: 'all', // all, quote, vote
    selectedTags: [],
    popularTags: ['心态', '工作哲学', '反PUA', '工作生活平衡', '职场智慧'],
    
    // 手势识别
    startX: 0,
    startY: 0,
    moveX: 0,
    moveY: 0,
    isDragging: false,
    swipeDirection: '' // 滑动方向: left, right, up
  },

  onLoad: function(options) {
    console.log('[Voice] 页面加载');
    // 移除分包内容提供器注入，统一从主包 JSON/JS 读取
    this.initContent();
  },

  onShow: function() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
  },

  /**
   * 初始化内容
   */
  initContent: function() {
    const self = this;
    self.setData({ isLoading: true });
    
    // 确保内容提供器就绪
    ensureContentProviderReady(function(success) {
      if (success) {
        self.loadContent();
      } else {
        console.warn('[Voice] 内容提供器加载失败，使用空数据');
        self.setData({ isLoading: false });
      }
    });
  },

  /**
   * 加载内容数据
   */
  loadContent: function() {
    try {
      const content = getAppContent();
      const userData = getUserData();
      
      // 合并语录和投票数据
      const allCards = [];
      
      // 添加语录卡片
      if (content.quotes && content.quotes.length > 0) {
        content.quotes.forEach(function(quote) {
          allCards.push({
            id: 'quote_' + quote.id,
            type: 'quote',
            content: this.normalizeQuoteContent(quote.content),
            tags: quote.tags || [],
            likeCount: Math.floor(Math.random() * 1000) + 100 // 伪数据
          });
        }.bind(this));
      }
      
      // 添加投票卡片
      if (content.topics && content.topics.length > 0) {
        content.topics.forEach(function(topic) {
          allCards.push({
            id: 'vote_' + topic.id,
            type: 'vote',
            topic: topic.topic,
            optionA: topic.optionA,
            optionB: topic.optionB,
            tags: topic.tags || [],
            likeCount: Math.floor(Math.random() * 800) + 50 // 伪数据
          });
        });
      }
      
      // 随机打乱顺序
      this.shuffleArray(allCards);
      
      this.setData({
        allCards: allCards,
        currentCard: allCards[0] || {},
        likedQuotes: userData.contentInteractions.likedQuotes || [],
        votedTopics: userData.contentInteractions.votedTopics || {},
        isLoading: false
      });
      
      console.log('[Voice] 内容加载完成，卡片数量:', allCards.length);
    } catch (error) {
      console.error('[Voice] 加载内容失败:', error);
      this.setData({ isLoading: false });
    }
  },

  /**
   * 数组随机打乱
   */
  shuffleArray: function(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },

  /**
   * 卡片触摸开始事件
   */
  onCardTouchStart: function(e) {
    const touch = (e.touches && e.touches[0]) || {};
    const startX = touch.clientX != null ? touch.clientX : touch.pageX;
    const startY = touch.clientY != null ? touch.clientY : touch.pageY;

    this.setData({
      startX: startX || 0,
      startY: startY || 0,
      cardAnimation: false,
      contentAnimClass: '',
      swipeDirection: ''
    });
  },

  /**
   * 使用 touchmove 驱动的拖拽反馈
   */
  onCardTouchMove: function(e) {
    const touch = (e.touches && e.touches[0]) || {};
    const x = touch.clientX != null ? touch.clientX : touch.pageX;
    const y = touch.clientY != null ? touch.clientY : touch.pageY;

    const deltaX = (x || 0) - this.data.startX;
    const deltaY = (y || 0) - this.data.startY;

    // 视觉反馈
    const rotate = deltaX * 0.06;
    const maxScaleDrop = 0.06;
    const scale = 1 - Math.min(Math.abs(deltaX) / 800, maxScaleDrop);
    const opacity = 1 - Math.min(Math.abs(deltaX) / 600, 0.25);

    // 判断方向（禁用上滑方向）
    let swipeDirection = '';
    const dirThreshold = 24;
    if (Math.abs(deltaX) > dirThreshold || Math.abs(deltaY) > dirThreshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeDirection = deltaX > 0 ? 'right' : 'left';
      } else {
        // 禁止设置为 'up'，避免出现上滑提示
        swipeDirection = '';
      }
    }

    this.setData({
      cardX: deltaX,
      cardY: deltaY,
      moveX: x || 0, // 记录实际触摸位置
      moveY: y || 0, // 记录实际触摸位置
      isDragging: true,
      swipeDirection,
      cardRotate: rotate,
      cardScale: scale,
      cardOpacity: opacity
    });
  },

  /**
   * 卡片移动事件（movable-view 的 bindchange，保留备用）
   */
  onCardMove: function(e) {
    const { x, y } = e.detail; 
    const deltaX = x;
    const deltaY = y;

    const rotate = deltaX * 0.06; 
    const maxScaleDrop = 0.06;
    const scale = 1 - Math.min(Math.abs(deltaX) / 800, maxScaleDrop);
    const opacity = 1 - Math.min(Math.abs(deltaX) / 600, 0.25);

    // 判断滑动方向（禁用上滑方向）
    let swipeDirection = '';
    const dirThreshold = 24; 
    if (Math.abs(deltaX) > dirThreshold || Math.abs(deltaY) > dirThreshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeDirection = deltaX > 0 ? 'right' : 'left';
      } else {
        swipeDirection = '';
      }
    }

    this.setData({
      cardX: deltaX,
      cardY: deltaY,
      moveX: deltaX,
      moveY: deltaY,
      isDragging: true,
      swipeDirection,
      cardRotate: rotate,
      cardScale: scale,
      cardOpacity: opacity
    });
  },

  /**
   * 卡片触摸结束事件
   */
  onCardTouchEnd: function() {
    const { cardX, cardY, startX, startY, moveX, moveY } = this.data;
    const threshold = 80; // 降低阈值，让卡片更容易触发滑出
    
    this.setData({ isDragging: false });
    
    // 计算滑动速度（简单的速度估算）
    const velocityX = (moveX - startX) * 0.1;
    const velocityY = (moveY - startY) * 0.1;
    
    if (Math.abs(cardX) > Math.abs(cardY)) {
      // 水平滑动优先
      if (cardX <= -threshold || velocityX < -5) {
        this.slideOutWithMomentum('left', velocityX);
        return;
      }
      if (cardX >= threshold || velocityX > 5) {
        this.slideOutWithMomentum('right', velocityX);
        return;
      }
    } else {
      // 垂直方向：禁用上滑分享
      // 直接回弹
    }

    // 回弹
    this.resetCardPosition();
  },

  /**
   * 带惯性的卡片滑出动画
   */
  slideOutWithMomentum: function(direction, velocity) {
    const { cardX, cardY, cardRotate } = this.data;
    
    // 计算最终位置（基于当前位置和速度）
    const finalX = direction === 'left' ? 
      Math.min(cardX - Math.abs(velocity) * 20 - 400, -600) : 
      Math.max(cardX + Math.abs(velocity) * 20 + 400, 600);
    
    const finalRotate = direction === 'left' ? 
      Math.min(cardRotate - 15, -25) : 
      Math.max(cardRotate + 15, 25);
    
    console.log(`[Voice] 卡片向${direction === 'left' ? '左' : '右'}滑出，惯性速度:`, velocity);
    
    // 启用动画并设置最终位置
    this.setData({
      cardAnimation: true,
      cardX: finalX,
      cardY: cardY - 50, // 稍微向上移动
      cardRotate: finalRotate,
      cardScale: 0.8,
      cardOpacity: 0
    });
    
    // 等待动画完成后处理卡片切换
    setTimeout(() => {
      if (direction === 'left') {
        this.handleCardSkip();
      } else {
        this.handleCardLike();
      }
    }, 400); // 增加动画时间
  },

  /**
   * 处理卡片跳过（左滑）
   */
  handleCardSkip: function() {
    console.log('[Voice] 处理卡片跳过');
    this.nextCard();
  },

  /**
   * 处理卡片点赞（右滑）
   */
  handleCardLike: function() {
    const { currentCard } = this.data;
    if (!currentCard || !currentCard.id) {
      this.nextCard();
      return;
    }

    console.log('[Voice] 处理卡片点赞:', currentCard.id);

    try {
      // 收藏逻辑：检查是否已收藏，避免重复
      const userData = getUserData();
      const favorites = userData.contentInteractions?.favorites || { quotes: [], votes: [] };
      let alreadyFavorited = false;

      if (currentCard.type === 'quote') {
        alreadyFavorited = favorites.quotes.includes(currentCard.id);
        if (!alreadyFavorited) {
          favorites.quotes.push(currentCard.id);
          addPoints('bookmark', currentCard.id);
        }
      } else if (currentCard.type === 'vote') {
        const topicId = parseInt(currentCard.id.replace('vote_', ''));
        const myOption = this.data.selectedOption || '';
        alreadyFavorited = favorites.votes.some(v => v.id === topicId);
        if (!alreadyFavorited) {
          favorites.votes.push({ id: topicId, myOption });
          addPoints('bookmark', currentCard.id);
        }
      }

      // 更新收藏数据
      if (!alreadyFavorited) {
        updateUserData('contentInteractions.favorites', favorites);
        console.log('[Voice] 已收藏卡片:', currentCard.id);
      }
    } catch (e) {
      console.warn('[Voice] 点赞/收藏处理异常:', e);
    }

    // 显示点赞动画
    this.setData({ showLikeAnimation: true });
    
    // 隐藏点赞动画
    setTimeout(() => {
      this.setData({ showLikeAnimation: false });
    }, 1000);
    
    this.nextCard();
  },

  /**
   * 跳过当前卡片（左滑）
   */
  slideOutLeft: function() {
    console.log('[Voice] 卡片向左滑出');

    // 内部内容滑出动画
    this.setData({
      contentAnimClass: 'animate-out out-left',
      swipeDirection: '',
      showLikeAnimation: false
    });

    // 等动画结束后切换下一张
    setTimeout(() => {
      this.nextCard();
    }, 260);
  },

  /**
   * 点赞当前卡片（右滑）
   */
  likeCard: function() {
    const { currentCard } = this.data;
    if (!currentCard || !currentCard.id) return;

    console.log('[Voice] 点赞/收藏卡片:', currentCard.id);

    try {
      // 收藏逻辑：检查是否已收藏，避免重复
      const userData = getUserData();
      const favorites = userData.contentInteractions?.favorites || { quotes: [], votes: [] };
      let alreadyFavorited = false;

      if (currentCard.type === 'quote') {
        alreadyFavorited = favorites.quotes.includes(currentCard.id);
        if (!alreadyFavorited) {
          favorites.quotes.push(currentCard.id);
          // 积分：收藏，使用卡片ID作为去重标识
          addPoints('bookmark', currentCard.id);
        }
      } else if (currentCard.type === 'vote') {
        const topicId = parseInt(currentCard.id.replace('vote_', ''));
        const myOption = this.data.selectedOption || '';
        alreadyFavorited = favorites.votes.some(v => v.id === topicId);
        if (!alreadyFavorited) {
          favorites.votes.push({ id: topicId, myOption });
          // 积分：收藏，使用卡片ID作为去重标识
          addPoints('bookmark', currentCard.id);
        }
      }

      // 更新收藏数据
      if (!alreadyFavorited) {
        updateUserData('contentInteractions.favorites', favorites);
        console.log('[Voice] 已收藏卡片:', currentCard.id);
      }
    } catch (e) {
      console.warn('[Voice] 点赞/收藏处理异常:', e);
    }

    // 内部内容滑出动画（向右）
    this.setData({
      contentAnimClass: 'animate-out out-right',
      swipeDirection: '',
      showLikeAnimation: true
    });

    // 隐藏点赞动画：延长显示时长 0.5s（原 800ms -> 1300ms）
    setTimeout(() => {
      this.setData({ showLikeAnimation: false });
    }, 1300);

    // 切换到下一张维持原时长 260ms
    setTimeout(() => {
      this.nextCard();
    }, 260);
  },

  /**
   * 上滑分享
   */
  shareCard: function() {
    // 禁用：避免通过手势触发，保留函数以兼容调用但不执行上滑动画
    try {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    } catch (e) {}
    // 不再触发 out-up 动画，直接回弹
    this.resetCardPosition();
  },

  /**
   * 切换到下一张卡片
   */
  nextCard: function() {
    const { allCards, currentIndex } = this.data;
    
    if (allCards.length === 0) {
      console.warn('[Voice] 没有可用的卡片数据');
      return;
    }
    
    // 计算下一张卡片的索引
    let nextIndex = currentIndex + 1;
    if (nextIndex >= allCards.length) {
      // 重新洗牌
      const shuffledCards = [...allCards];
      this.shuffleArray(shuffledCards);
      this.setData({
        allCards: shuffledCards,
        currentIndex: 0,
        currentCard: shuffledCards[0]
      });
    } else {
      this.setData({
        currentIndex: nextIndex,
        currentCard: allCards[nextIndex]
      });
    }
    
    // 重置所有状态
    this.setData({
      selectedOption: '',
      showVoteResult: false,
      voteResultA: 0,
      voteResultB: 0,
      cardX: 0,
      cardY: 0,
      cardAnimation: false,
      swipeDirection: '',
      isDragging: false,
      moveX: 0,
      moveY: 0,
      cardRotate: 0,
      cardScale: 1,
      cardOpacity: 1,
      contentAnimClass: ''
    });
  },

  /**
   * 重置卡片位置（回弹到原位）
   */
  resetCardPosition: function() {
    this.setData({
      // movable-view 归零 - 确保回到几何中心
      cardX: 0,
      cardY: 0,
      moveX: 0,
      moveY: 0,
      isDragging: false,
      swipeDirection: '',
      // 内部内容回弹动画
      contentAnimClass: 'animate-back',
      cardRotate: 0,
      cardScale: 1,
      cardOpacity: 1,
      cardAnimation: true
    });
    
    // 短暂延时后移除动画类和动画状态
    setTimeout(() => {
      this.setData({ 
        contentAnimClass: '',
        cardAnimation: false
      });
    }, 380);
  },

  /**
   * 投票选项点击
   */
  onVoteOptionTap: function(e) {
    const option = e.currentTarget.dataset.option;
    const { currentCard, votedTopics } = this.data;
    const topicId = parseInt(currentCard.id.replace('vote_', ''));
    
    // 如果已经投过票，不允许重复投票
    if (votedTopics[topicId]) {
      wx.showToast({
        title: '您已经投过票了',
        icon: 'none'
      });
      return;
    }
    
    // 积分：投票，使用话题ID作为去重标识
    try { addPoints('vote', `topic_${topicId}`); } catch (e) { console.warn('addPoints vote error', e); }

    // 记录选项并显示结果
    this.setData({
      selectedOption: option,
      showVoteResult: true
    });
    
    // 伪随机百分比（与预览逻辑一致）
    const randomBase = Math.floor(Math.random() * 40) + 30; // 30 - 70
    const a = option === 'A' ? Math.max(randomBase, 55) : Math.min(100 - randomBase, 45);
    const b = 100 - a;
    
    this.setData({
      voteResultA: a,
      voteResultB: b
    });
    
    // 存储投票结果
    const newVoted = Object.assign({}, votedTopics, { [topicId]: option });
    updateUserData('contentInteractions.votedTopics', newVoted);
    this.setData({ votedTopics: newVoted });
  },

  /** 过滤弹窗与筛选逻辑（原有实现保留） */
  onFilterTap: function() {
    this.setData({ showFilterModal: true });
  },

  onFilterModalClose: function() {
    this.setData({ showFilterModal: false });
  },

  stopPropagation: function() {},

  onFilterTypeChange: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ filterType: type });
  },

  onTagFilterToggle: function(e) {
    const tag = e.currentTarget.dataset.tag;
    const set = new Set(this.data.selectedTags);
    if (set.has(tag)) set.delete(tag); else set.add(tag);
    this.setData({ selectedTags: Array.from(set) });
  },

  onFilterReset: function() {
    this.setData({ filterType: 'all', selectedTags: [] });
  },

  onFilterConfirm: function() {
    this.setData({ showFilterModal: false }, () => this.applyFilter());
  },

  applyFilter: function() {
    const { filterType, selectedTags } = this.data;
    const content = getAppContent();

    let filtered = [];
    if (filterType === 'all' || filterType === 'quote') {
      (content.quotes || []).forEach((q) => {
        if (selectedTags.length === 0 || (q.tags || []).some(t => selectedTags.includes(t))) {
          filtered.push({
            id: 'quote_' + q.id,
            type: 'quote',
            content: this.normalizeQuoteContent(q.content),
            tags: q.tags || [],
            likeCount: Math.floor(Math.random() * 1000) + 100
          });
        }
      });
    }
    if (filterType === 'all' || filterType === 'vote') {
      (content.topics || []).forEach((t) => {
        if (selectedTags.length === 0 || (t.tags || []).some(tag => selectedTags.includes(tag))) {
          filtered.push({
            id: 'vote_' + t.id,
            type: 'vote',
            topic: t.topic,
            optionA: t.optionA,
            optionB: t.optionB,
            tags: t.tags || [],
            likeCount: Math.floor(Math.random() * 800) + 50
          });
        }
      });
    }

    this.shuffleArray(filtered);

    this.setData({
      allCards: filtered,
      currentIndex: 0,
      currentCard: filtered[0] || {},
      // 重置互动状态
      selectedOption: '',
      showVoteResult: false,
      voteResultA: 0,
      voteResultB: 0,
      cardX: 0,
      cardY: 0,
      cardRotate: 0,
      cardScale: 1,
      cardOpacity: 1,
      contentAnimClass: ''
    });
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

  // 生成当前卡片的分享图片
  generateCardShareImage: function(callback) {
    const canvasId = 'shareCanvas';
    const ctx = wx.createCanvasContext(canvasId, this);
    const width = 750;
    const height = 600;
    
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
     
     // 内容区域
     const contentAreaX = cardPadding + 24;
     const contentAreaY = cardPadding + 40 + 40;
     const contentAreaW = width - (cardPadding + 24) * 2;
     
     const currentCard = this.data.currentCard;
     
     if (currentCard.type === 'quote') {
       // 语录内容
       ctx.setFillStyle('rgba(255, 255, 255, 0.95)');
       ctx.setFontSize(36);
       const quoteText = `"${currentCard.content.zh}"`;
       this.drawWrappedText(ctx, quoteText, contentAreaX, contentAreaY, contentAreaW, 54, 4);
       
       // 英文内容
       ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
       ctx.setFontSize(24);
       this.drawWrappedText(ctx, currentCard.content.en, contentAreaX, contentAreaY + 4 * 54 + 20, contentAreaW, 36, 3);
     } else {
       // 投票话题
       ctx.setFillStyle('rgba(255, 255, 255, 0.95)');
       ctx.setFontSize(32);
       this.drawWrappedText(ctx, currentCard.topic, contentAreaX, contentAreaY, contentAreaW, 48, 3);
       
       // 投票选项
       ctx.setFontSize(24);
       ctx.setFillStyle('rgba(255, 255, 255, 0.85)');
       const optionY = contentAreaY + 3 * 48 + 30;
       ctx.fillText(`A. ${currentCard.optionA}`, contentAreaX, optionY);
       ctx.fillText(`B. ${currentCard.optionB}`, contentAreaX, optionY + 40);
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
          callback && callback(null, res.tempFilePath);
        },
        fail: (err) => {
          callback && callback(err);
        }
      }, this);
    });
  },

  // 文本换行绘制辅助函数
  drawWrappedText: function(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split('');
    let line = '';
    let lineCount = 0;
    
    for (let i = 0; i < words.length && lineCount < maxLines; i++) {
      const testLine = line + words[i];
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, x, y + lineCount * lineHeight);
        line = words[i];
        lineCount++;
      } else {
        line = testLine;
      }
    }
    
    if (lineCount < maxLines && line !== '') {
      ctx.fillText(line, x, y + lineCount * lineHeight);
    }
  },

  onShareAppMessage: function() {
    const promise = new Promise(resolve => {
      try { addPoints && addPoints('share'); } catch (e) { console.warn('addPoints share error', e); }
      // 尝试生成当前卡片的完整截图
      this.generateCardShareImage((err, path) => {
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
    return {
      title: '这简直是我的职场嘴替！',
      path: '/pages/voice/index',
      promise
    };
  }
});