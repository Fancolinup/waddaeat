// 测试语录显示页面
const { ensureContentProviderReady, getAppContent } = require('../../utils/dataManager');

Page({
  data: {
    isLoading: true,
    quotesCount: 0,
    topicsCount: 0,
    currentQuote: null,
    currentTopic: null,
    quoteIndex: 0,
    topicIndex: 0,
    allQuotes: [],
    allTopics: []
  },

  onLoad: function() {
    this.loadTestData();
  },

  loadTestData: function() {
    try {
      console.debug('[TestVoice] 开始加载测试数据');
      
      const content = getAppContent();
      console.debug('[TestVoice] 获取到内容:', content);
      
      const quotes = content.quotes || [];
      const topics = content.topics || [];
      
      console.debug('[TestVoice] 语录数量:', quotes.length);
      console.debug('[TestVoice] 话题数量:', topics.length);
      
      if (quotes.length > 0) {
        console.debug('[TestVoice] 第一条语录:', quotes[0]);
      }
      
      this.setData({
        isLoading: false,
        quotesCount: quotes.length,
        topicsCount: topics.length,
        allQuotes: quotes,
        allTopics: topics,
        currentQuote: quotes.length > 0 ? quotes[0] : null,
        currentTopic: topics.length > 0 ? topics[0] : null
      });
      
    } catch (error) {
      console.error('[TestVoice] 加载数据失败:', error);
      this.setData({
        isLoading: false
      });
    }
  },

  nextQuote: function() {
    const { allQuotes, quoteIndex } = this.data;
    if (allQuotes.length === 0) return;
    
    const nextIndex = (quoteIndex + 1) % allQuotes.length;
    this.setData({
      quoteIndex: nextIndex,
      currentQuote: allQuotes[nextIndex]
    });
  },

  nextTopic: function() {
    const { allTopics, topicIndex } = this.data;
    if (allTopics.length === 0) return;
    
    const nextIndex = (topicIndex + 1) % allTopics.length;
    this.setData({
      topicIndex: nextIndex,
      currentTopic: allTopics[nextIndex]
    });
  }
});