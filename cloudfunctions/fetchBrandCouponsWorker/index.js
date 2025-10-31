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
  return list.map(p => {
    const skuViewId = p?.skuViewId || p?.skuId || p?.couponPackDetail?.skuViewId || '';
    const title = p?.title || p?.productTitle || p?.skuName || p?.couponPackDetail?.name || '';
    const brandLogoRaw = p?.brandLogoUrl || p?.logoUrl || p?.brandInfo?.brandLogoUrl || '';
    return {
      skuViewId,
      title,
      brandLogoUrl: normalizeHttps(brandLogoRaw),
      raw: p
    };
  }).filter(x => x.skuViewId);
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

    // 调试日志：观察返回结构
    try {
      console.log('[fetchBrandCouponsWorker] upstream ok, typeof result.data =', typeof result.data);
      console.log('[fetchBrandCouponsWorker] upstream keys =', result.data && Object.keys(result.data));
      if (Array.isArray(result.data?.data)) {
        console.log('[fetchBrandCouponsWorker] upstream data[] length =', result.data.data.length);
      } else {
        console.log('[fetchBrandCouponsWorker] upstream data.productList length =', (result.data?.data?.productList || result.data?.productList || result.data?.list || []).length);
      }
    } catch (e) {}

    // 兼容不同层级的数据结构
    const dataRoot = result.data || {};
    let products = [];
    if (Array.isArray(dataRoot?.data)) {
      // 形态：{ code, message, data: [ {...}, {...} ] }
      products = dataRoot.data;
    } else if (Array.isArray(dataRoot?.list)) {
      // 形态：{ list: [ ... ] }
      products = dataRoot.list;
    } else if (Array.isArray(dataRoot?.data?.productList)) {
      // 形态：{ data: { productList: [...] } }
      products = dataRoot.data.productList;
    } else if (Array.isArray(dataRoot?.productList)) {
      // 形态：{ productList: [...] }
      products = dataRoot.productList;
    } else if (Array.isArray(dataRoot)) {
      // 形态：直接是数组
      products = dataRoot;
    } else {
      products = [];
    }

    // 调试日志：产品列表与抽取结果
    try {
      console.log('[fetchBrandCouponsWorker] products length =', Array.isArray(products) ? products.length : -1);
      if (Array.isArray(products) && products.length > 0) {
        console.log('[fetchBrandCouponsWorker] sample product keys =', Object.keys(products[0] || {}));
      }
    } catch (e) {}

    let items = pickItems(products);
    try {
      console.log('[fetchBrandCouponsWorker] picked items length =', items.length);
      if (items.length > 0) {
        console.log('[fetchBrandCouponsWorker] sample item =', items[0]);
      }
    } catch (e) {}

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