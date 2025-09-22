// pages/profile/favorites/index.js
const { getUserData, getAppContent } = require('../../../utils/dataManager');

Page({
  data: {
    favoritesCount: 0,
    favoritesList: []
  },
  onShow() { this.loadFavorites(); },
  loadFavorites() {
    try {
      const userData = getUserData();
      const content = getAppContent();
      const quotesById = {}; const topicsById = {};
      (content.quotes || []).forEach(q => { quotesById[String(q.id)] = q; });
      (content.topics || []).forEach(t => { topicsById[String(t.id)] = t; });
      const fav = userData.contentInteractions?.favorites || { quotes: [], votes: [] };
      const list = [];
      // 语录收藏：展示语录文本与标签
      (fav.quotes || []).forEach(qid => {
        const idStr = String(qid).replace(/^quote_/i, '');
        const q = quotesById[idStr];
        if (q) list.push({ id: 'quote_' + idStr, type: 'quote', content: q.content || '', tags: q.tags || [] });
      });
      // 投票收藏：展示题干、两个选项与我的选择
      (fav.votes || []).forEach(v => {
        const t = topicsById[String(v.id)];
        if (t) list.push({ id: 'vote_' + t.id, type: 'vote', topic: t.topic || '', optionA: t.optionA, optionB: t.optionB, myOption: v.myOption || '' });
      });
      this.setData({ favoritesList: list, favoritesCount: ((fav.quotes || []).length) + ((fav.votes || []).length) });
    } catch (e) { console.warn('[Favorites] 加载失败:', e); }
  }
});