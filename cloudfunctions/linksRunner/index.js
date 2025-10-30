// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const SEED_BRANDS = [
  "肯德基", "汉堡王", "星巴克", "喜茶", "奈雪的茶", "麦当劳", "必胜客", "达美乐", "海底捞", "和府捞面",
  "味千拉面", "一风堂", "小杨生煎", "永和大王", "吉野家", "CoCo都可", "一点点", "乐乐茶", "7分甜", "太二酸菜鱼"
];

async function ensureCollection(db, name) {
  try { await db.createCollection(name); } catch (e) {}
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const stateColl = db.collection('MeituanBrandDailyState');
  const limitSkuCount = (typeof event?.limitSkuCount === 'number' && event.limitSkuCount > 0) ? event.limitSkuCount : 5;

  await ensureCollection(db, 'MeituanBrandDailyState');

  // 初始化或读取状态
  let stateDoc;
  try {
    const docRes = await stateColl.doc('default').get();
    stateDoc = docRes && docRes.data ? docRes.data : null;
  } catch (e) {
    stateDoc = null;
  }
  if (!stateDoc) {
    stateDoc = { _id: 'default', couponsCursor: 0, linksCursor: 0, retryCounts: {}, updatedAt: Date.now() };
    try { await stateColl.add({ data: stateDoc }); } catch (e) {}
  }

  const idx = Number(stateDoc.linksCursor || 0) % SEED_BRANDS.length;
  const brandName = SEED_BRANDS[idx];
  console.log('[linksRunner] 处理品牌：', brandName, ' idx=', idx);

  // 调用单品牌 worker
  let ok = false;
  try {
    const res = await cloud.callFunction({
      name: 'fetchBrandLinksWorker',
      data: { brandName, limitSkuCount }
    });
    const result = res && res.result;
    ok = !!(result && result.ok);
    console.log('[linksRunner] worker 返回：', result);
  } catch (e) {
    console.warn('[linksRunner] worker 调用失败：', e && e.message);
  }

  // 更新游标/重试
  try {
    const update = { updatedAt: Date.now() };
    if (ok) {
      update.linksCursor = (idx + 1) % SEED_BRANDS.length;
      update.retryCounts = stateDoc.retryCounts || {};
      delete update.retryCounts[brandName];
    } else {
      const rc = Object.assign({}, stateDoc.retryCounts || {});
      rc[brandName] = (rc[brandName] || 0) + 1;
      if (rc[brandName] >= 3) {
        update.linksCursor = (idx + 1) % SEED_BRANDS.length;
        rc[brandName] = 0;
      } else {
        update.linksCursor = idx; // 保持不推进
      }
      update.retryCounts = rc;
    }
    try {
      await stateColl.doc('default').update({ data: update });
    } catch (e) {
      // 兜底 upsert（若文档不存在则创建）
      await stateColl.add({ data: { _id: 'default', ...stateDoc, ...update } });
    }
  } catch (e) {
    console.warn('[linksRunner] 更新游标失败：', e && e.message);
  }

  return { ok: true, brandName, advanced: !!ok };
};