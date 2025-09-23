// 自动内容提供器（基于主包 Pilot dialogues.json）
// 通过 JavaScript 模块包装，避免直接 require JSON 在部分基础库不兼容的问题

function loadJsonSafely() {
  // 优先直接 require（开发者工具和部分基础库支持）
  try {
    const data = require('../Pilot dialogues.json');
    return data && typeof data === 'object' ? data : null;
  } catch (eRequire) {
    // 兜底：使用文件系统读取（某些环境下更兼容）
    try {
      const fsm = wx.getFileSystemManager && wx.getFileSystemManager();
      if (fsm) {
        const candidates = [
          'Pilot dialogues.json',
          '/Pilot dialogues.json',
          './Pilot dialogues.json',
          '../Pilot dialogues.json',
          '../../Pilot dialogues.json'
        ];
        for (let i = 0; i < candidates.length; i++) {
          try {
            const content = fsm.readFileSync(candidates[i], 'utf-8');
            if (content) {
              const parsed = JSON.parse(content);
              if (parsed && typeof parsed === 'object') {
                console.log('[pilotDialoguesJson] 通过 FileSystem 读取成功:', candidates[i]);
                return parsed;
              }
            }
          } catch (ignore) { /* continue */ }
        }
      }
    } catch (fsErr) { /* ignore */ }
  }
  return null;
}

// 标准化数据格式，处理JSON和JS文件的结构差异
function normalizeData(rawData) {
  if (!rawData) return null;
  
  const normalized = {
    workQuotes: [],
    voteTopics: []
  };
  
  // 处理workQuotes
  if (Array.isArray(rawData.workQuotes)) {
    normalized.workQuotes = rawData.workQuotes.map(quote => {
      if (quote.content && typeof quote.content === 'object' && quote.content.zh) {
        // JSON格式：content.zh/en结构，保持原始格式以便语录页面正确显示中英文
        return {
          id: quote.id,
          content: {
            zh: quote.content.zh,
            en: quote.content.en
          },
          mood: quote.mood,
          tags: quote.tags || [quote.mood].filter(Boolean)
        };
      } else if (quote.content && typeof quote.content === 'string') {
        // JS格式：content直接字符串
        return {
          id: quote.id,
          content: quote.content,
          tags: quote.tags || []
        };
      }
      return quote;
    });
  }
  
  // 处理voteTopics
  if (Array.isArray(rawData.voteTopics)) {
    normalized.voteTopics = rawData.voteTopics.map(topic => ({
      id: topic.id,
      topic: topic.topic,
      optionA: typeof topic.optionA === 'object' ? topic.optionA.text : topic.optionA,
      optionB: typeof topic.optionB === 'object' ? topic.optionB.text : topic.optionB,
      tags: topic.tags || []
    }));
  }
  
  return normalized;
}

const jsonData = loadJsonSafely();
const normalizedData = normalizeData(jsonData);

let exported = null;
if (normalizedData && normalizedData.workQuotes.length > 0) {
  exported = normalizedData;
  console.log('[pilotDialoguesJson] 成功加载主包JSON数据，语录数量:', normalizedData.workQuotes.length);
} else {
  // 最后兜底：采用旧版 JS 模块，保证页面可用
  try {
    const legacy = require('./pilotDialogues.js');
    const normalizedLegacy = normalizeData(legacy);
    exported = normalizedLegacy || { workQuotes: [], voteTopics: [] };
    console.log('[pilotDialoguesJson] 回退到JS兜底数据');
  } catch (eLegacy) {
    exported = { workQuotes: [], voteTopics: [] };
    console.log('[pilotDialoguesJson] 所有数据源均失败，使用空数据');
  }
}

module.exports = exported;