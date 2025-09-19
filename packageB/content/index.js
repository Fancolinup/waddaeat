// packageB/content/index.js
// 内容提供器：对外暴露 getAppContent()，仅负责读取预设内容（只读）
let __cached = null;

function getAppContent() {
  if (__cached) return __cached;
  let data = null;
  try {
    data = require('./presets/Pilot dialogues.json');
  } catch (e1) {
    try {
      data = require('./presets/pilot_dialogues.json');
    } catch (e2) {
      console.warn('[voice-content] 无法加载预设内容文件 (Pilot dialogues.json)');
      data = null;
    }
  }
  const result = {
    quotes: (data && data.workQuotes) || [],
    topics: (data && data.voteTopics) || []
  };
  __cached = result;
  return result;
}

module.exports = { getAppContent };