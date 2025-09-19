// pages/voice/index.js
// 职场嘴替页面 - 单卡片展示设计
const { ensureContentProviderReady, getAppContent, updateUserData, getUserData } = require('../../utils/dataManager');

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
            content: quote.content,
            tags: quote.tags || [],
            likeCount: Math.floor(Math.random() * 1000) + 100 // 伪数据
          });
        });
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

    // 判断方向
    let swipeDirection = '';
    const dirThreshold = 24;
    if (Math.abs(deltaX) > dirThreshold || Math.abs(deltaY) > dirThreshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeDirection = deltaX > 0 ? 'right' : 'left';
      } else if (deltaY < 0) {
        swipeDirection = 'up';
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
   * 卡片移动事件（movable-view 的 bindchange，保留备用）
   */
  onCardMove: function(e) {
    const { x, y } = e.detail; // movable-view 的当前位置（以可移动区域左上角为原点）
    
    // 直接使用当前位置作为位移（受控模式下更稳定）
    const deltaX = x;
    const deltaY = y;

    // 旋转/缩放/透明度的视觉反馈
    const rotate = deltaX * 0.06; // 轻微旋转
    const maxScaleDrop = 0.06;
    const scale = 1 - Math.min(Math.abs(deltaX) / 800, maxScaleDrop);
    const opacity = 1 - Math.min(Math.abs(deltaX) / 600, 0.25);

    // 判断滑动方向
    let swipeDirection = '';
    const dirThreshold = 24; // 方向判断阈值
    if (Math.abs(deltaX) > dirThreshold || Math.abs(deltaY) > dirThreshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeDirection = deltaX > 0 ? 'right' : 'left';
      } else if (deltaY < 0) {
        swipeDirection = 'up';
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
    const { cardX, cardY } = this.data;
    const threshold = 100; // 触发阈值，接近 HTML 预览效果

    this.setData({ isDragging: false });

    if (Math.abs(cardX) > Math.abs(cardY)) {
      // 水平滑动优先
      if (cardX <= -threshold) {
        this.slideOutLeft();
        return;
      }
      if (cardX >= threshold) {
        this.likeCard();
        return;
      }
    } else {
      // 垂直方向
      if (cardY <= -threshold) {
        this.shareCard();
        return;
      }
    }

    // 回弹
    this.resetCardPosition();
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
    console.log('[Voice] 点赞卡片:', currentCard.id);

    // 内部内容滑出动画（向右）
    this.setData({
      contentAnimClass: 'animate-out out-right',
      swipeDirection: '',
      showLikeAnimation: true
    });

    // 隐藏点赞动画
    setTimeout(() => {
      this.setData({ showLikeAnimation: false });
    }, 800);

    // 更新点赞数据
    if (currentCard.type === 'quote') {
      const quoteId = parseInt(currentCard.id.replace('quote_', ''));
      const likedQuotes = this.data.likedQuotes;
      if (likedQuotes.indexOf(quoteId) === -1) {
        likedQuotes.push(quoteId);
        updateUserData('contentInteractions.likedQuotes', likedQuotes);
        this.setData({ likedQuotes: likedQuotes });
      }
    }

    // 等动画结束后切换到下一张卡片
    setTimeout(() => {
      this.nextCard();
    }, 260);
  },

  /**
   * 上滑分享
   */
  shareCard: function() {
    const { currentCard } = this.data;
    console.log('[Voice] 分享卡片:', currentCard.id);

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // 上滑提示动画（不切换卡片，只回弹）
    this.setData({ contentAnimClass: 'animate-out out-up' });
    setTimeout(() => {
      this.resetCardPosition();
    }, 260);
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
      // movable-view 归零
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
      cardOpacity: 1
    });
    
    // 短暂延时后移除动画类
    setTimeout(() => {
      this.setData({ contentAnimClass: '' });
    }, 280);
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
          filtered.push({ id: 'quote_' + q.id, type: 'quote', content: q.content, tags: q.tags || [], likeCount: Math.floor(Math.random() * 1000) + 100 });
        }
      });
    }
    if (filterType === 'all' || filterType === 'vote') {
      (content.topics || []).forEach((t) => {
        if (selectedTags.length === 0 || (t.tags || []).some(tag => selectedTags.includes(tag))) {
          filtered.push({ id: 'vote_' + t.id, type: 'vote', topic: t.topic, optionA: t.optionA, optionB: t.optionB, tags: t.tags || [], likeCount: Math.floor(Math.random() * 800) + 50 });
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

  onShareAppMessage: function() {
    const { currentCard } = this.data;
    return {
      title: currentCard.type === 'quote' ? currentCard.content : currentCard.topic,
      path: '/pages/voice/index'
    };
  }
});