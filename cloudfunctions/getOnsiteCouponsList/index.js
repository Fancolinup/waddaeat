// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function ensureCollection(db, name) {
  try { await db.createCollection(name); } catch (e) { /* ignore */ }
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  let u = url.replace(/`/g, '').trim();
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  return u;
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const couponsColl = db.collection('MeituanOnsiteCoupon');
  const urlsColl = db.collection('MeituanOnsiteCouponURL');

  await ensureCollection(db, 'MeituanOnsiteCoupon');
  await ensureCollection(db, 'MeituanOnsiteCouponURL');

  const page = typeof event?.page === 'number' && event.page > 0 ? event.page : 1;
  const pageSize = typeof event?.pageSize === 'number' && event.pageSize > 0 ? event.pageSize : 20;
  const nowTs = Date.now();

  // 读取所有存在小程序链接(4)的 URL 文档，构建 sku 集合和链接映射
  const batchSize = 100;
  let linkDocs = [];
  try {
    const { total: linkTotal } = await urlsColl.count();
    for (let skip = 0; skip < linkTotal; skip += batchSize) {
      const { data } = await urlsColl.skip(skip).limit(batchSize).get();
      if (Array.isArray(data)) linkDocs.push(...data);
    }
  } catch (e) {
    linkDocs = [];
  }
  const urlMapBySku = new Map();
const skuSet = new Set();
for (const d of linkDocs) {
  const lm = d?.linkMap || {};
  const mini = lm && (lm['4'] || lm[4]);
  const skuKey = String(d?.skuViewId || '');
  if (mini && skuKey) {
    urlMapBySku.set(skuKey, lm);
    skuSet.add(skuKey);
  }
}

  // 从到店优惠集合按批次读取，过滤出有链接且未过期的商品
  let candidates = [];
  try {
    const { total: totalItems } = await couponsColl.count();
    for (let skip = 0; skip < totalItems; skip += batchSize) {
      const { data: docs } = await couponsColl.skip(skip).limit(batchSize).get();
      const items = Array.isArray(docs) ? docs : [];
      for (const it of items) {
  const sku = String(it?.skuViewId || '');
  if (!sku || !skuSet.has(sku)) continue; // 必须存在可用的小程序链接
  const exp = Number(it?.expireAt || 0);
  if (exp > nowTs) {
    candidates.push(it);
  }
}
      if (candidates.length >= pageSize * 4) {
        break;
      }
    }
  } catch (e) {
    candidates = [];
  }

  // 内存排序：commission DESC -> commissionPercent DESC
  candidates.sort((a, b) => {
    const c1 = Number(b?.commission || 0) - Number(a?.commission || 0);
    if (c1 !== 0) return c1;
    return Number(b?.commissionPercent || 0) - Number(a?.commissionPercent || 0);
  });

  // 组装并分页
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const sliced = candidates.slice(start, end);

  const merged = [];
  for (const it of sliced) {
  const lm = urlMapBySku.get(String(it.skuViewId || '')) || {};
  const mini = lm && (lm['4'] || lm[4]);
  if (!mini) continue; // 双重保险
  merged.push({
    brandName: it.brandName,
    commissionPercent: it.commissionPercent,
    commission: it.commission,
    name: it.name,
    skuViewId: it.skuViewId,
    headUrl: sanitizeUrl(it.headUrl),
    originalPrice: it.originalPrice,
    sellPrice: it.sellPrice,
    label1: (typeof it.label1 === 'string' ? it.label1.trim() : it.label1) || '',
    label2: (typeof it.label2 === 'string' ? it.label2.trim() : it.label2) || '',
    couponValidETime: it.couponValidETime,
    expireAt: it.expireAt,
    referralLinkMap: { '4': mini }
  });
}

  return { ok: true, page, pageSize, totalFetched: merged.length, items: merged };
};