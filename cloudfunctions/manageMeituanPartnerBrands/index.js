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
  // 当 event 为空或未提供 refresh 字段时，默认执行刷新（用于定时触发）
  const doRefresh = event && Object.keys(event).length > 0 ? !!event.refresh : true;
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
        const urlDocs = Array.isArray(urlFound?.data) ? urlFound.data : [];
        // 修复：同一品牌可能存在多个 URL 文档，过去仅取第一个，导致误判为空
        const mergedLinkMap = {};
        urlDocs.forEach(doc => {
          const candidate = doc.urlMap || doc.linkMap || doc.referralLinkMap || {};
          if (candidate && typeof candidate === 'object') {
            Object.keys(candidate).forEach(k => { mergedLinkMap[k] = candidate[k]; });
          }
        });
        const hasValidUrl = Object.keys(mergedLinkMap).length > 0;
        console.log('[PartnerBrands] URL文档数：', name, urlDocs.length, '有效sku数=', Object.keys(mergedLinkMap).length);

        // 修改：不再主动依赖实时 getMeituanCoupon 来判定，只要 URL 集合有有效链接就写入品牌排序集合
        if (hasValidUrl) {
          // 兼容 logo：优先使用上次存储的品牌券文档中的 brandLogo
          let candidate = '';
          let candidateUrl = '';
          try {
            const collCoupon = db.collection('MeituanBrandCoupon');
            const cFound = await collCoupon.where({ brandName: name }).get();
            const couponDoc = Array.isArray(cFound?.data) && cFound.data.length ? cFound.data[0] : null;
            candidate = couponDoc?.brandLogo || '';
            if (typeof candidate === 'string') {
              candidate = candidate.replace(/`/g, '').trim();
              if (candidate.startsWith('http://')) {
                candidate = 'https://' + candidate.slice(7);
              }
            }
            // 追加：从券 items 中抽取品牌级 brandLogoUrl
            const firstItem = Array.isArray(couponDoc?.items) && couponDoc.items.length ? couponDoc.items[0] : null;
            candidateUrl = (firstItem && typeof firstItem.brandLogoUrl === 'string') ? firstItem.brandLogoUrl : '';
            if (typeof candidateUrl === 'string') {
              candidateUrl = candidateUrl.replace(/`/g, '').trim();
              if (candidateUrl.startsWith('http://')) {
                candidateUrl = 'https://' + candidateUrl.slice(7);
              }
            }
            // 兼容：若 items[0].brandLogoUrl 为空，则回退到 raw.brandInfo.brandLogoUrl
            let rawLogo = (firstItem && firstItem.raw && typeof firstItem.raw.brandInfo?.brandLogoUrl === 'string') ? firstItem.raw.brandInfo.brandLogoUrl : '';
            if (typeof rawLogo === 'string') {
              rawLogo = rawLogo.replace(/`/g, '').trim();
              if (rawLogo.startsWith('http://')) {
                rawLogo = 'https://' + rawLogo.slice(7);
              }
            }
            if (!candidateUrl && rawLogo) {
              candidateUrl = rawLogo;
            }
          } catch (eLogo) {
            // 忽略 logo 读取异常，使用空或占位
          }
          const payload = {
            brandName: name,
            brandLogo: candidate || '',
            brandLogoUrl: candidateUrl || '',
            orderIndex: brandNames.indexOf(name),
            updatedAt: new Date(),
            source: 'partner-brands-refresh'
          };
          await upsertToCollection(db, 'MeituanPartnerBrandsSorted', { brandName: name }, payload);
          console.log('[PartnerBrands] 写入（URL有效）：', name);
        } else {
          // 无有效链接：删除旧记录
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
        const linkMapCandidate = (u?.urlMap || u?.linkMap || u?.referralLinkMap || {});
        const ok = (u && u.brandName) && Object.keys(linkMapCandidate).length > 0;
        if (ok) validBrandSet.add(u.brandName);
      });
      if (urlDocs.length < limit) break;
      skip += urlDocs.length;
    }

    const brands = docsSorted
      .filter(d => validBrandSet.has(d.brandName))
      .map(d => ({ name: d.brandName, logo: (d.brandLogoUrl || d.brandLogo || '/images/placeholder.png') }));
    return { ok: true, brands, total: brands.length, refreshed: doRefresh };
  } catch (e) {
    console.warn('[PartnerBrands] 读取品牌列表失败：', e && e.message);
    return { ok: false, error: { message: e && e.message } };
  }
};