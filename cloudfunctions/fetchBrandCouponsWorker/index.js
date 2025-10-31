// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizeHttps(url) {
  if (typeof url !== 'string') return '';
  let u = url.replace(/`/g, '').trim();
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  return u;
}

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
    console.log('[fetchBrandCouponsWorker] 已创建集合：', name);
  } catch (e) {
    console.log('[fetchBrandCouponsWorker] 集合检查：', name, e && e.message);
  }
}

function toArrayMaybe(objOrArr) {
  if (Array.isArray(objOrArr)) return objOrArr;
  if (objOrArr && typeof objOrArr === 'object') {
    const keys = Object.keys(objOrArr).filter(k => /^\d+$/.test(k)).sort((a,b)=>Number(a)-Number(b));
    return keys.map(k => objOrArr[k]);
  }
  return [];
}

function extractLabels(raw) {
  const labels = [];
  const seen = new Set();
  try {
    const pl = raw?.couponPackDetail?.productLabel ?? raw?.productLabel;
    // 1) productLabel 字段本身若为字符串，直接作为标签
    if (typeof pl === 'string') {
      const s = pl.trim();
      if (s && !seen.has(s)) { labels.push(s); seen.add(s); }
    }
    const plObj = (pl && typeof pl === 'object') ? pl : {};

    // 2) 按用户给定顺序依次提取：dianPingRankLabel、pricePowerLabel（字符串）、beatMTLabel、historyPriceLabel、productRankLabel
    const v1 = plObj?.dianPingRankLabel;
    if (typeof v1 === 'string' && v1.trim() && !seen.has(v1.trim())) { labels.push(v1.trim()); seen.add(v1.trim()); }

    const ppl = plObj?.pricePowerLabel;
    if (typeof ppl === 'string' && ppl.trim() && !seen.has(ppl.trim())) { labels.push(ppl.trim()); seen.add(ppl.trim()); }

    const bmt = (ppl && typeof ppl === 'object') ? ppl.beatMTLabel : plObj?.beatMTLabel;
    if (typeof bmt === 'string' && bmt.trim() && !seen.has(bmt.trim())) { labels.push(bmt.trim()); seen.add(bmt.trim()); }

    const hist = (ppl && typeof ppl === 'object') ? ppl.historyPriceLabel : plObj?.historyPriceLabel;
    if (typeof hist === 'string' && hist.trim() && !seen.has(hist.trim())) { labels.push(hist.trim()); seen.add(hist.trim()); }

    const pr = plObj?.productRankLabel;
    if (typeof pr === 'string' && pr.trim() && !seen.has(pr.trim())) { labels.push(pr.trim()); seen.add(pr.trim()); }
  } catch (e) {}
  return labels;
}

function normalizeItem(brandName, it) {
  const raw = it?.raw || it || {};
  const skuViewId = it?.skuViewId || raw?.couponPackDetail?.skuViewId || '';
  if (!skuViewId) return null;
  const title = it?.title || raw?.couponPackDetail?.name || '';
  const name = raw?.couponPackDetail?.name || title || '';
  const headUrl = normalizeHttps(raw?.couponPackDetail?.headUrl || it?.headUrl || '');
  const brandLogoUrl = normalizeHttps(it?.brandLogoUrl || raw?.brandInfo?.brandLogoUrl || '');
  const originalPrice = Number(raw?.couponPackDetail?.originalPrice || it?.originalPrice || 0) || 0;
  const sellPrice = Number(raw?.couponPackDetail?.sellPrice || it?.sellPrice || 0) || 0;
  const commission = Number(raw?.commissionInfo?.commission || it?.commission || 0) || 0;
  const commissionPercent = Number(raw?.commissionInfo?.commissionPercent || it?.commissionPercent || 0) || 0;
  const eSec = Number(raw?.couponValidTimeInfo?.couponValidETime || raw?.couponPackDetail?.endTime || it?.couponValidETime || it?.endTime || 0) || 0;
  const couponValidETime = eSec > 0 ? eSec * 1000 : 0;
  const expireAt = couponValidETime || (Date.now() + 24 * 60 * 60 * 1000);
  const labels = extractLabels(raw);
  const label1 = labels[0] || '';
  const label2 = labels[1] || '';
  return {
    brandName,
    skuViewId,
    title,
    name,
    headUrl,
    brandLogoUrl,
    originalPrice,
    sellPrice,
    commission,
    commissionPercent,
    couponValidETime,
    expireAt,
    label1,
    label2,
    raw
  };
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const collection = db.collection('MeituanBrandCoupon');

  const brandName = (event?.brandName || '').trim();
  // 默认处理全部SKU；可通过 limitSkuCount 控制最大处理条数
  const limitSkuCount = (typeof event?.limitSkuCount === 'number' && event.limitSkuCount > 0) ? event.limitSkuCount : Infinity;

  if (!brandName) {
    return { ok: false, error: { code: 'INVALID_BRAND', message: '缺少 brandName' } };
  }

  await ensureCollection(db, 'MeituanBrandCoupon');

  try {
    const { data: existed } = await collection.where({ brandName }).get();
    const doc = Array.isArray(existed) && existed.length > 0 ? existed[0] : null;
    if (!doc) {
      return { ok: false, brandName, error: { code: 'NO_SOURCE', message: '该品牌在数据集中不存在源文档' } };
    }

    const rawItems = toArrayMaybe(doc.items);
    const seen = new Set();
    let normalized = [];
    for (const it of rawItems) {
      const n = normalizeItem(brandName, it);
      if (!n) continue;
      if (seen.has(n.skuViewId)) continue;
      seen.add(n.skuViewId);
      normalized.push(n);
    }

    // 过滤已过期
    const nowTs = Date.now();
    normalized = normalized.filter(x => Number(x.expireAt || 0) > nowTs);

    if (Number.isFinite(limitSkuCount) && normalized.length > limitSkuCount) {
      normalized = normalized.slice(0, limitSkuCount);
    }

    const payload = {
      brandName,
      items: normalized,
      updatedAt: Date.now()
    };

    await collection.doc(doc._id).update({ data: payload });

    const metrics = { brandName, keptItemCount: normalized.length };
    console.log('[fetchBrandCouponsWorker] 完成增强：', metrics);
    return { ok: true, brandName, metrics };
  } catch (e) {
    console.error('[fetchBrandCouponsWorker] 异常：', e);
    return { ok: false, brandName, error: { code: 'EXCEPTION', message: e.message } };
  }
};