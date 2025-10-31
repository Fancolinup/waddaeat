// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
    console.log('[fetchBrandLinksWorker] 已创建集合：', name);
  } catch (e) {
    console.log('[fetchBrandLinksWorker] 集合检查：', name, e && e.message);
  }
}

function normalizeHttpsSafe(url) {
  if (typeof url !== 'string') return '';
  let u = url.replace(/`/g, '').trim();
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  return u;
}

function sanitizeLink(val) {
  if (typeof val !== 'string') return '';
  return val.replace(/`/g, '').trim();
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const couponsColl = db.collection('MeituanBrandCoupon');
  const linksAggColl = db.collection('MeituanBrandCouponURL');
  const linksFlatColl = db.collection('MeituanBrandCouponURL'); // 复用同集合，按 sku 扁平
  const sortedColl = db.collection('MeituanPartnerBrandsSorted');

  const brandName = (event?.brandName || '').trim();
  const limitSkuCount = (typeof event?.limitSkuCount === 'number' && event.limitSkuCount > 0) ? event.limitSkuCount : Infinity;
  const onlyPending = !!(event && event.onlyPending);

  if (!brandName) {
    return { ok: false, error: { code: 'INVALID_BRAND', message: '缺少 brandName' } };
  }

  await ensureCollection(db, 'MeituanBrandCouponURL');
  await ensureCollection(db, 'MeituanPartnerBrandsSorted');

  try {
    // 读取品牌券以获取品牌logo
    const { data: existedCoupons } = await couponsColl.where({ brandName }).get();
    const couponDoc = Array.isArray(existedCoupons) && existedCoupons.length > 0 ? existedCoupons[0] : null;
    const couponItems = Array.isArray(couponDoc?.items) ? couponDoc.items : [];

    // 读取链接聚合文档（如果存在）
    const { data: existedLinks } = await linksAggColl.where({ brandName }).get();
    const aggDoc = Array.isArray(existedLinks) && existedLinks.length > 0 ? existedLinks[0] : null;

    // 构建候选SKU集合
    const skuSet = new Set();
    for (const it of couponItems) {
      const id = it?.skuViewId || it?.raw?.couponPackDetail?.skuViewId || '';
      if (id) skuSet.add(id);
    }
    // 从聚合文档的 urlMap/referralLinkMap/linkMap 提取所有可能的 sku
    try {
      const urlMap = (aggDoc?.urlMap || aggDoc?.referralLinkMap || {});
      Object.keys(urlMap || {}).forEach(k => skuSet.add(k));
      const aggLinkMap = aggDoc?.linkMap;
      if (aggLinkMap && typeof aggLinkMap === 'object') {
        const keys = Object.keys(aggLinkMap);
        const isSingle = keys.every(k => k === '3' || k === '4');
        if (isSingle) {
          const sid = aggDoc?.skuViewId;
          if (sid) skuSet.add(sid);
        } else {
          keys.forEach(k => skuSet.add(k));
        }
      }
    } catch (e) {}

    // 仅在 onlyPending 下过滤已存在扁平链接的 sku
    let pendingSku = [...skuSet];
    if (onlyPending) {
      try {
        const { data: existedFlat } = await linksFlatColl.where({ brandName }).get();
        const linkedSet = new Set((Array.isArray(existedFlat) ? existedFlat : []).map(d => d.skuViewId));
        pendingSku = pendingSku.filter(id => id && !linkedSet.has(id));
      } catch (e) {}
    }

    // 限制处理数量
    if (Number.isFinite(limitSkuCount) && pendingSku.length > limitSkuCount) {
      pendingSku = pendingSku.slice(0, limitSkuCount);
    }

    let linkedCount = 0;
    for (const skuViewId of pendingSku) {
      if (!skuViewId) continue;
      // 从聚合文档优先拿链接
      let lm = {};
      try {
        const urlMap = (aggDoc?.urlMap || aggDoc?.referralLinkMap || {});
        const v = urlMap[skuViewId];
        if (v && typeof v === 'object') {
          lm = v;
        } else {
          const aggLinkMap = aggDoc?.linkMap;
          if (aggLinkMap && typeof aggLinkMap === 'object') {
            const keys = Object.keys(aggLinkMap);
            const isSingle = keys.every(k => k === '3' || k === '4');
            if (isSingle) {
              if (aggDoc?.skuViewId === skuViewId) lm = aggLinkMap;
            } else {
              const vv = aggLinkMap[skuViewId];
              if (vv && typeof vv === 'object') lm = vv;
            }
          }
        }
      } catch (e) {}
      // 如果聚合未命中，再尝试已有扁平文档
      if (!lm || Object.keys(lm).length === 0) {
        try {
          const { data: existedFlat } = await linksFlatColl.where({ skuViewId }).get();
          const flatDoc = Array.isArray(existedFlat) && existedFlat.length > 0 ? existedFlat[0] : null;
          lm = flatDoc?.linkMap || {};
        } catch (e) {}
      }

      // 清洗：只保留 4（可选保留3），去除空值与反引号
      const mini = sanitizeLink(lm && lm['4'] || '');
      const deepLink = sanitizeLink(lm && lm['3'] || '');
      const linkMap = {};
      if (mini) linkMap['4'] = mini;
      if (deepLink) linkMap['3'] = deepLink; // 可选保留
      if (!linkMap['4']) continue; // 严格要求有 4

      // Upsert 扁平链接文档
      try {
        const { data } = await linksFlatColl.where({ skuViewId }).get();
        const payload = {
          skuViewId,
          brandName,
          linkMap,
          updatedAt: Date.now()
        };
        if (Array.isArray(data) && data.length > 0) {
          await linksFlatColl.doc(data[0]._id).update({ data: payload });
        } else {
          await linksFlatColl.add({ data: payload });
        }
        linkedCount += 1;
      } catch (e) {}
    }

    // 更新品牌排序集合的品牌logoUrl
    try {
      let brandLogoUrl = '';
      const candidates = [];
      if (Array.isArray(couponItems)) {
        for (const it of couponItems) {
          if (typeof it?.brandLogoUrl === 'string' && it.brandLogoUrl.trim()) candidates.push(it.brandLogoUrl);
          else if (it?.raw?.brandInfo && typeof it.raw.brandInfo.brandLogoUrl === 'string' && it.raw.brandInfo.brandLogoUrl.trim()) candidates.push(it.raw.brandInfo.brandLogoUrl);
        }
      }
      for (const c of candidates) {
        const u = normalizeHttpsSafe(c);
        if (u) { brandLogoUrl = u; break; }
      }
      const { data: existedSorted } = await sortedColl.where({ brandName }).get();
      const prev = (Array.isArray(existedSorted) && existedSorted.length > 0) ? existedSorted[0] : null;
      if (!brandLogoUrl && prev && typeof prev.brandLogoUrl === 'string' && prev.brandLogoUrl.trim()) {
        brandLogoUrl = prev.brandLogoUrl;
      }
      const payload = {
        brandName,
        brandLogoUrl,
        updatedAt: Date.now(),
        source: 'links-worker'
      };
      if (Array.isArray(existedSorted) && existedSorted.length > 0) {
        await sortedColl.doc(existedSorted[0]._id).update({ data: payload });
      } else {
        await sortedColl.add({ data: payload });
      }
    } catch (e) {}

    const metrics = { brandName, linkedItemCount: linkedCount };
    console.log('[fetchBrandLinksWorker] 完成增强：', metrics);
    return { ok: true, brandName, metrics };
  } catch (e) {
    console.error('[fetchBrandLinksWorker] 异常：', e);
    return { ok: false, brandName, error: { code: 'EXCEPTION', message: e.message } };
  }
};