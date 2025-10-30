// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizeHttps(url) {
  if (typeof url === 'string' && url.startsWith('http://')) return 'https://' + url.slice(7);
  return url;
}

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
    console.log('[fetchBrandCouponsWorker] 已创建集合：', name);
  } catch (e) {
    console.log('[fetchBrandCouponsWorker] 集合检查：', name, e && e.message);
  }
}

// 将 query_coupon 返回的产品列表尽量抽取必要字段，避免过多加工以保障3s内完成
function pickItems(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  return list.map(p => ({
    skuViewId: p?.skuViewId || p?.skuId || '',
    title: p?.title || p?.productTitle || p?.skuName || '',
    brandLogoUrl: normalizeHttps(p?.brandLogoUrl || p?.logoUrl || ''),
    raw: p // 保留原始以便后续需要更多字段时可用
  })).filter(x => x.skuViewId);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const db = cloud.database();
  const collection = db.collection('MeituanBrandCoupon');

  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  const brandName = (event?.brandName || '').trim();
  const limitSkuCount = (typeof event?.limitSkuCount === 'number' && event.limitSkuCount > 0) ? event.limitSkuCount : 5;

  if (!brandName) {
    return { ok: false, error: { code: 'INVALID_BRAND', message: '缺少 brandName' } };
  }

  await ensureCollection(db, 'MeituanBrandCoupon');

  try {
    const res = await cloud.callFunction({
      name: 'getMeituanCoupon',
      data: {
        platform: 1,
        searchText: brandName,
        // 经纬度默认即可，必要时可在调用处传入
        appKey,
        secret
      }
    });
    const result = res && res.result;
    if (!result || !result.ok) {
      console.warn('[fetchBrandCouponsWorker] getMeituanCoupon 失败：', result && result.error);
      return { ok: false, brandName, error: result && result.error || { code: 'UPSTREAM_FAIL', message: '上游返回失败' } };
    }

    // 兼容不同层级的数据结构
    const dataRoot = result.data || {};
    const products = dataRoot.data?.productList || dataRoot.productList || dataRoot.list || [];
    let items = pickItems(products);
    if (items.length > limitSkuCount) items = items.slice(0, limitSkuCount);

    // Upsert 按品牌
    const { data: existed } = await collection.where({ brandName }).get();
    const doc = {
      brandName,
      items,
      updatedAt: Date.now()
    };
    if (Array.isArray(existed) && existed.length > 0) {
      await collection.doc(existed[0]._id).update({ data: doc });
    } else {
      await collection.add({ data: doc });
    }

    const metrics = { brandName, rawItemCount: Array.isArray(products) ? products.length : 0, keptItemCount: items.length };
    console.log('[fetchBrandCouponsWorker] 完成：', metrics);
    return { ok: true, brandName, metrics };
  } catch (e) {
    console.error('[fetchBrandCouponsWorker] 异常：', e);
    return { ok: false, brandName, error: { code: 'EXCEPTION', message: e.message } };
  }
};