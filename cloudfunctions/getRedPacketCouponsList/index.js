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
  const couponsColl = db.collection('RedPacketCoupons');
  const urlsColl = db.collection('RedPacketCouponURL');
  const brandsColl = db.collection('MeituanBrandCoupon');
  const linksColl = db.collection('MeituanBrandCouponURL');

  await ensureCollection(db, 'RedPacketCoupons');
  await ensureCollection(db, 'RedPacketCouponURL');
  await ensureCollection(db, 'MeituanBrandCoupon');
  await ensureCollection(db, 'MeituanBrandCouponURL');

  const page = typeof event?.page === 'number' && event.page > 0 ? event.page : 1;
  const pageSize = typeof event?.pageSize === 'number' && event.pageSize > 0 ? event.pageSize : 20;
  const nowTs = Date.now();

  // 先读取所有存在小程序链接(4)的 URL 文档，构建 sku 集合和链接映射
  const batchSize = 100;
  let linkDocs = [];
  try {
    const { total: linkTotal } = await linksColl.count();
    for (let skip = 0; skip < linkTotal; skip += batchSize) {
      const { data } = await linksColl.skip(skip).limit(batchSize).get();
      if (Array.isArray(data)) linkDocs.push(...data);
    }
  } catch (e) {
    linkDocs = [];
  }
  const urlMapBySku = new Map();
  const skuSet = new Set();
  for (const d of linkDocs) {
    const lm = d?.linkMap || {};
    const mini = lm && lm['4'];
    if (mini && d?.skuViewId) {
      urlMapBySku.set(d.skuViewId, lm);
      skuSet.add(d.skuViewId);
    }
  }

  // 从品牌券集合按批次读取，过滤出有链接且未过期的商品
  let candidates = [];
  try {
    const { total: brandTotal } = await brandsColl.count();
    for (let skip = 0; skip < brandTotal; skip += batchSize) {
      const { data: brandDocs } = await brandsColl.skip(skip).limit(batchSize).get();
      const docs = Array.isArray(brandDocs) ? brandDocs : [];
      for (const doc of docs) {
        const items = Array.isArray(doc?.items) ? doc.items : [];
        for (const it of items) {
          const sku = it?.skuViewId;
          if (!sku || !skuSet.has(sku)) continue; // 必须存在可用的小程序链接
          const exp = Number(it?.expireAt || 0);
          if (exp > nowTs) {
            candidates.push(it);
          }
        }
      }
      // 提前结束：若已足够构成分页缓冲，减少不必要扫描
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
    const lm = urlMapBySku.get(it.skuViewId) || {};
    const mini = lm && lm['4'];
    if (!mini) continue; // 双重保险，严格丢弃无小程序链接
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

  return { ok: true, page, pageSize, totalFetched: merged.length, list: merged };
};