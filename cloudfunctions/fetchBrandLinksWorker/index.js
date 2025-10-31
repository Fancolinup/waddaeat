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

exports.main = async (event, context) => {
  const db = cloud.database();
  const couponsColl = db.collection('MeituanBrandCoupon');
  const linksColl = db.collection('MeituanBrandCouponURL');
  // 新增：品牌排序集合引用
  const sortedColl = db.collection('MeituanPartnerBrandsSorted');

  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  const brandName = (event?.brandName || '').trim();
  const limitSkuCount = (typeof event?.limitSkuCount === 'number' && event.limitSkuCount > 0) ? event.limitSkuCount : 5;
  const onlyPending = !!(event && event.onlyPending);

  if (!brandName) {
    return { ok: false, error: { code: 'INVALID_BRAND', message: '缺少 brandName' } };
  }

  await ensureCollection(db, 'MeituanBrandCouponURL');
  // 新增：确保品牌排序集合存在
  await ensureCollection(db, 'MeituanPartnerBrandsSorted');

  try {
    const { data: existed } = await couponsColl.where({ brandName }).get();
    const doc = Array.isArray(existed) && existed.length > 0 ? existed[0] : null;
    const items = Array.isArray(doc?.items) ? doc.items : [];
    if (items.length === 0) {
      // 没有可处理商品：确保从品牌排序集合中移除，避免前端展示
      try {
        const { data: existedSorted } = await sortedColl.where({ brandName }).get();
        if (Array.isArray(existedSorted) && existedSorted.length > 0) {
          await sortedColl.doc(existedSorted[0]._id).remove();
          console.log('[fetchBrandLinksWorker] 删除品牌（无可处理商品）：', brandName);
        }
      } catch (eDel) {
        console.warn('[fetchBrandLinksWorker] 删除 PartnerBrandsSorted 失败：', brandName, eDel && eDel.message);
      }
      return { ok: true, brandName, metrics: { brandName, linkedItemCount: 0, prunedCount: 0, note: '无可处理商品' } };
    }

    // 计算 pending 列表（仅包含未生成链接的 SKU）
    let pendingList = items;
    if (onlyPending) {
      try {
        const { data } = await linksColl.where({ brandName }).get();
        const linkedSet = new Set((Array.isArray(data) ? data : []).map(d => d.skuViewId));
        pendingList = items.filter(it => it?.skuViewId && !linkedSet.has(it.skuViewId));
      } catch (e) {
        console.warn('[fetchBrandLinksWorker] 查询已生成链接失败（onlyPending）：', e && e.message);
      }
      if (pendingList.length === 0) {
        const metrics = { brandName, linkedItemCount: 0, prunedCount: 0, note: '无待处理pending商品' };
        console.log('[fetchBrandLinksWorker] 跳过：', metrics);
        return { ok: true, brandName, metrics };
      }
    }

    const subset = pendingList.slice(0, Math.min(pendingList.length, limitSkuCount));
    const successSku = [];

    for (const it of subset) {
      const skuViewId = it?.skuViewId || '';
      if (!skuViewId) continue;
      try {
        const res = await cloud.callFunction({
          name: 'getMeituanReferralLink',
          data: { skuViewId, linkTypeList: [3, 4], appKey, secret }
        });
        const result = res && res.result;
        if (result && result.ok && result.data) {
          // 兼容两种返回结构：可能是 { data: { referralLinkMap } } 或 { referralLinkMap }
          const root = result.data;
          const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;
          const linkMap = (dataRoot && typeof dataRoot === 'object' && dataRoot.referralLinkMap) ? dataRoot.referralLinkMap : {};
          if (linkMap && Object.keys(linkMap).length) {
            await linksColl.where({ skuViewId }).get().then(async ({ data }) => {
              const payload = {
                skuViewId,
                linkMap,
                updatedAt: Date.now(),
                brandName
              };
              if (Array.isArray(data) && data.length > 0) {
                await linksColl.doc(data[0]._id).update({ data: payload });
              } else {
                await linksColl.add({ data: payload });
              }
            });
            successSku.push(skuViewId);
          } else {
            console.warn('[fetchBrandLinksWorker] referralLinkMap 为空：', skuViewId);
          }
        }
      } catch (e) {
        console.warn('[fetchBrandLinksWorker] getMeituanReferralLink 失败：', skuViewId, e && e.message);
      }
    }

    // 裁剪品牌券集合（仅在非 onlyPending 下保留成功生成链接的商品）
    let prunedCount = 0;
    if (!onlyPending && doc && Array.isArray(doc.items)) {
      const filtered = doc.items.filter(x => successSku.includes(x?.skuViewId));
      prunedCount = doc.items.length - filtered.length;
      await couponsColl.doc(doc._id).update({ data: { items: filtered, updatedAt: Date.now() } });
    }

    // 新增：根据链接生成结果写入/删除品牌排序集合
    try {
      if (successSku.length > 0) {
        // 计算品牌级 logo 与 logoUrl（优先从券 items 抽取 brandLogoUrl）
        let brandLogo = (doc && typeof doc.brandLogo === 'string') ? normalizeHttpsSafe(doc.brandLogo) : '';
        let brandLogoUrl = '';
        try {
          const candidates = [];
          if (Array.isArray(doc?.items)) {
            for (const it of doc.items) {
              if (typeof it?.brandLogoUrl === 'string' && it.brandLogoUrl.trim()) {
                candidates.push(it.brandLogoUrl);
              } else if (it?.raw?.brandInfo && typeof it.raw.brandInfo.brandLogoUrl === 'string' && it.raw.brandInfo.brandLogoUrl.trim()) {
                candidates.push(it.raw.brandInfo.brandLogoUrl);
              }
            }
          }
          if (doc && typeof doc.brandLogoUrl === 'string' && doc.brandLogoUrl.trim()) candidates.push(doc.brandLogoUrl);
          if (doc && doc.raw) {
            if (typeof doc.raw.brandLogoUrl === 'string' && doc.raw.brandLogoUrl.trim()) candidates.push(doc.raw.brandLogoUrl);
            if (doc.raw.brandInfo && typeof doc.raw.brandInfo.brandLogoUrl === 'string' && doc.raw.brandInfo.brandLogoUrl.trim()) candidates.push(doc.raw.brandInfo.brandLogoUrl);
          }
          for (const c of candidates) {
            const u = normalizeHttpsSafe(c);
            if (u) { brandLogoUrl = u; break; }
          }
        } catch (e) {}

        const { data: existedSorted } = await sortedColl.where({ brandName }).get();
        const prev = (Array.isArray(existedSorted) && existedSorted.length > 0) ? existedSorted[0] : null;
        // 保留已有 brandLogoUrl，避免覆盖为空
        if (!brandLogoUrl && prev && typeof prev.brandLogoUrl === 'string' && prev.brandLogoUrl.trim()) {
          brandLogoUrl = prev.brandLogoUrl;
        }

        const payload = {
          brandName,
          brandLogo,
          brandLogoUrl,
          updatedAt: Date.now(),
          source: 'links-worker'
        };
        if (Array.isArray(existedSorted) && existedSorted.length > 0) {
          await sortedColl.doc(existedSorted[0]._id).update({ data: payload });
        } else {
          await sortedColl.add({ data: payload });
        }
        console.log('[fetchBrandLinksWorker] PartnerBrandsSorted 写入：', brandName);
      } else if (items.length === 0) {
        // 仅当 items 为 0（品牌已无商品）才移除品牌
        const { data: existedSorted } = await sortedColl.where({ brandName }).get();
        if (Array.isArray(existedSorted) && existedSorted.length > 0) {
          await sortedColl.doc(existedSorted[0]._id).remove();
          console.log('[fetchBrandLinksWorker] 删除品牌（无有效商品）：', brandName);
        }
      }
    } catch (eSorted) {
      console.warn('[fetchBrandLinksWorker] 更新 PartnerBrandsSorted 失败：', brandName, eSorted && eSorted.message);
    }

    const metrics = { brandName, linkedItemCount: successSku.length, prunedCount };
    console.log('[fetchBrandLinksWorker] 完成：', metrics);
    return { ok: true, brandName, metrics };
  } catch (e) {
    console.error('[fetchBrandLinksWorker] 异常：', e);
    return { ok: false, brandName, error: { code: 'EXCEPTION', message: e.message } };
  }
};


function normalizeHttpsSafe(url) {
  if (typeof url !== 'string') return '';
  let u = url.replace(/`/g, '').trim();
  if (u.startsWith('http://')) u = 'https://' + u.slice(7);
  return u;
}