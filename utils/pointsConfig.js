// 可手动调整的积分与等级规则配置

module.exports = {
  // 动作对应的积分增量
  actions: {
    spin: 2,       // 转盘一次
    vote: 1,       // 参与一次投票
    bookmark: 1,   // 收藏一次内容
    share: 3       // 分享一次
  },

  // 等级阈值（按积分从低到高）
  levels: [
    { name: '庶民', min: 0 },
    { name: '熟客', min: 10 },
    { name: '达人', min: 30 },
    { name: '大佬', min: 60 },
    { name: '传说', min: 100 }
  ]
};