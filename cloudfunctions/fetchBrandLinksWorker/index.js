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

  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  const brandName = (event?.brandName || '').trim();
  const limitSkuCount = (typeof event?.limitSkuCount === 'number' && event.limitSkuCount > 0) ? event.limitSkuCount : 5;

  if (!brandName) {
    return { ok: false, error: { code: 'INVALID_BRAND', message: '缺少 brandName' } };
  }

  await ensureCollection(db, 'MeituanBrandCouponURL');

  try {
    const { data: existed } = await couponsColl.where({ brandName }).get();
    const doc = Array.isArray(existed) && existed.length > 0 ? existed[0] : null;
    const items = Array.isArray(doc?.items) ? doc.items : [];
    if (items.length === 0) {
      return { ok: true, brandName, metrics: { brandName, linkedItemCount: 0, prunedCount: 0, note: '无可处理商品' } };
    }

    const subset = items.slice(0, Math.min(items.length, limitSkuCount));
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
          await linksColl.where({ skuViewId }).get().then(async ({ data }) => {
            const payload = {
              skuViewId,
              linkMap: (result.data.data && result.data.data.referralLinkMap) || {},
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
        }
      } catch (e) {
        console.warn('[fetchBrandLinksWorker] getMeituanReferralLink 失败：', skuViewId, e && e.message);
      }
    }

    // 裁剪品牌券集合，仅保留成功生成链接的商品（在品牌范围内）
    let prunedCount = 0;
    if (doc && Array.isArray(doc.items)) {
      const filtered = doc.items.filter(x => successSku.includes(x?.skuViewId));
      prunedCount = doc.items.length - filtered.length;
      await couponsColl.doc(doc._id).update({ data: { items: filtered, updatedAt: Date.now() } });
    }

    const metrics = { brandName, linkedItemCount: successSku.length, prunedCount };
    console.log('[fetchBrandLinksWorker] 完成：', metrics);
    return { ok: true, brandName, metrics };
  } catch (e) {
    console.error('[fetchBrandLinksWorker] 异常：', e);
    return { ok: false, brandName, error: { code: 'EXCEPTION', message: e.message } };
  }
};