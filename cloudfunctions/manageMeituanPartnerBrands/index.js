// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 兜底品牌名称（避免依赖项目根目录的文件导致云端打包缺失）
const SEED_BRANDS = [
  '星巴克', '喜茶', '奈雪', '蜜雪冰城', '瑞幸咖啡',
  '肯德基', '麦当劳', '必胜客', '汉堡王', '塔斯汀',
  '茶颜悦色', '沪上阿姨', '古茗', '库迪咖啡', 'CoCo都可',
  '好利来', 'DQ冰淇淋', '松鹤楼', '喜家德', '华莱士',
  '乐乐茶', '7分甜', '鲍师傅', '张亮麻辣烫', '杨国福麻辣烫'
];

// 简单的 https 规范化
function normalizeHttps(url) {
  if (typeof url === 'string' && url.startsWith('http://')) {
    return 'https://' + url.slice(7);
  }
  return url;
}

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
    console.log('[PartnerBrands] 已创建集合：', name);
  } catch (e) {
    console.log('[PartnerBrands] 集合检查：', name, e && e.message);
  }
}

// 写入到云数据库集合（存在则更新，不存在则创建）
async function upsertToCollection(db, collectionName, query, payload) {
  const coll = db.collection(collectionName);
  const found = await coll.where(query).get();
  if (found && found.data && found.data.length > 0) {
    const id = found.data[0]._id;
    await coll.doc(id).update({ data: payload });
    return { _id: id, updated: true };
  }
  const addRes = await coll.add({ data: payload });
  return { _id: addRes._id, created: true };
}

// 串行执行以降低并发压力
async function runSerial(arr, handler) {
  const results = [];
  for (const x of arr) {
    /* eslint-disable no-await-in-loop */
    const r = await handler(x);
    results.push(r);
    /* eslint-enable no-await-in-loop */
  }
  return results;
}

exports.main = async (event, context) => {
  const db = cloud.database();
  await ensureCollection(db, 'MeituanPartnerBrandsSorted');

  // 品牌名称来源：优先 event.brandNames -> SEED_BRANDS
  const brandNames = (event && Array.isArray(event.brandNames) && event.brandNames.length) ? event.brandNames : SEED_BRANDS;
  const doRefresh = !!(event && event.refresh);
  const nowTs = Date.now();

  if (doRefresh) {
    console.log('[PartnerBrands] 刷新模式：开始筛选与排序，品牌数=', brandNames.length);
    await runSerial(brandNames, async (name, idx) => {
      try {
        const res = await cloud.callFunction({
          name: 'getMeituanCoupon',
          data: { platform: 1, searchText: name, maxRetries: 10, delayMs: 10000 }
        });
        const result = (res && res.result) || {};
        const arr = (result && result.data && Array.isArray(result.data.data)) ? result.data.data : [];

        // 仅当该品牌在 URL 集合中存在有效商品（urlMap 非空）时才允许写入
        const collUrl = db.collection('MeituanBrandCouponURL');
        const urlFound = await collUrl.where({ brandName: name }).get();
        const hasValidUrl = !!(urlFound && urlFound.data && urlFound.data.length && urlFound.data[0] && urlFound.data[0].urlMap && Object.keys(urlFound.data[0].urlMap || {}).length > 0);

        if (arr.length > 0 && hasValidUrl) {
          const first = arr[0] || {};
          let candidate = first.brandLogoUrl || (first.brandInfo && first.brandInfo.brandLogoUrl) || '';
          if (typeof candidate === 'string' && candidate.startsWith('http://')) {
            candidate = 'https://' + candidate.slice(7);
          }
          const payload = {
            brandName: name,
            brandLogo: candidate || '',
            // 不再使用排序：保留但不依赖 orderIndex 字段
            orderIndex: brandNames.indexOf(name),
            updatedAt: new Date(),
            source: 'partner-brands-refresh'
          };
          await upsertToCollection(db, 'MeituanPartnerBrandsSorted', { brandName: name }, payload);
          console.log('[PartnerBrands] 写入（有效商品存在）：', name);
        } else {
          // 无券或无有效商品：删除旧记录，避免前端展示
          const coll = db.collection('MeituanPartnerBrandsSorted');
          const found = await coll.where({ brandName: name }).get();
          if (found && found.data && found.data.length) {
            await coll.doc(found.data[0]._id).remove();
            console.log('[PartnerBrands] 删除不可用品牌：', name);
          }
        }
      } catch (e) {
        console.warn('[PartnerBrands] 品牌刷新失败：', name, e && e.message);
      }
      return null;
    });
  }

  // 读取并返回已筛选品牌列表；仅包含拥有有效商品的品牌
  try {
    const collSorted = db.collection('MeituanPartnerBrandsSorted');
    const batchSorted = await collSorted.get();
    const docsSorted = (batchSorted && batchSorted.data) || [];

    // 加载 URL 集合，构建拥有有效商品的品牌集合（分页防止默认 20 条限制）
    const collUrl = db.collection('MeituanBrandCouponURL');
    const limit = 100;
    let skip = 0;
    const validBrandSet = new Set();
    while (true) {
      const batch = await collUrl.skip(skip).limit(limit).get();
      const urlDocs = (batch && batch.data) || [];
      urlDocs.forEach(u => {
        const ok = (u && u.brandName) && (u && u.urlMap) && Object.keys(u.urlMap || {}).length > 0;
        if (ok) validBrandSet.add(u.brandName);
      });
      if (urlDocs.length < limit) break;
      skip += urlDocs.length;
    }

    const brands = docsSorted
      .filter(d => validBrandSet.has(d.brandName))
      .map(d => ({ name: d.brandName, logo: d.brandLogo || '/images/placeholder.png' }));
    return { ok: true, brands, total: brands.length, refreshed: doRefresh };
  } catch (e) {
    console.warn('[PartnerBrands] 读取品牌列表失败：', e && e.message);
    return { ok: false, error: { message: e && e.message } };
  }
};