// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function ensureCollection(db, name) {
  try { await db.createCollection(name); } catch (e) { /* ignore if exists */ }
}

// 品牌种子（与到店保持一致，后续可独立调整）
const SEED_BRANDS = [
  "肯德基", "汉堡王", "麦当劳", "星巴克", "喜茶", "奈雪的茶", "海底捞", "呷哺呷哺", "蓝蛙", "瑞幸咖啡", "蜜雪冰城"
];

// 轮询索引持久化
async function getAndAdvanceBrandRotation(db, keyName, totalCount) {
  await ensureCollection(db, 'ScheduleState');
  const coll = db.collection('ScheduleState');
  const docId = `rotation:${keyName}`;
  try { await coll.add({ data: { _id: docId, idx: 0, updatedAt: Date.now() } }); } catch (e) { /* ignore exists */ }
  let idx = 0;
  try {
    const r = await coll.doc(docId).get();
    idx = Number(r?.data?.idx || 0);
  } catch (eGet) {}
  const nextIdx = (Number.isFinite(idx) ? idx : 0) + 1;
  try { await coll.doc(docId).update({ data: { idx: nextIdx % Math.max(totalCount, 1), updatedAt: Date.now() } }); } catch (eUpd) {}
  return idx % Math.max(totalCount, 1);
}

exports.main = async (event, context) => {
  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  const platform = Number(event?.platform ?? 1);
  const onlyPending = event?.onlyPending !== undefined ? !!event.onlyPending : true;
  const maxRetries = typeof event?.maxRetries === 'number' ? event.maxRetries : 5;
  const delayMs = typeof event?.delayMs === 'number' ? event.delayMs : 8000;
  const limitBrandCount = typeof event?.limitBrandCount === 'number' ? event.limitBrandCount : undefined;
  const brandNamesParam = Array.isArray(event?.brandNames) ? event.brandNames : undefined;

  const db = cloud.database();
  // 确定品牌列表与轮询索引
  const brandNames = (brandNamesParam && brandNamesParam.length ? brandNamesParam : SEED_BRANDS);
  const rotationIndex = await getAndAdvanceBrandRotation(db, 'redpacket-daily', brandNames.length);
  const selectedBrand = brandNames[rotationIndex];
  const brands = [selectedBrand];

  try {
    // 阶段一：拉取数据，仅入库商品，不生成链接
    const dataRes = await cloud.callFunction({
      name: 'buildRedPacketCouponsWorker',
      data: {
        platform,
        onlyPending: false,
        maxRetries: Math.min(maxRetries, 2),
        delayMs: Math.min(delayMs, 1000),
        ...(limitBrandCount ? { limitBrandCount: 1 } : { limitBrandCount: 1 }),
        brandNames: brands,
        ...(appKey && secret ? { appKey, secret } : {}),
        stage: 'data'
      }
    });

    // 阶段二：补链接，仅处理未生成链接的条目
    const linkRes = await cloud.callFunction({
      name: 'buildRedPacketCouponsWorker',
      data: {
        platform,
        onlyPending: true,
        maxRetries: Math.min(maxRetries, 2),
        delayMs: Math.min(delayMs, 1000),
        ...(limitBrandCount ? { limitBrandCount: 1 } : { limitBrandCount: 1 }),
        brandNames: brands,
        ...(appKey && secret ? { appKey, secret } : {}),
        stage: 'link'
      }
    });

    return { ok: true, task: 'daily', brand: selectedBrand, rotationIndex, result: { data: dataRes?.result, link: linkRes?.result } };
  } catch (e) {
    return { ok: false, error: { message: e.message } };
  }
};