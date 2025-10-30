// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 尝试读取本地餐厅/品牌数据源（仅在函数目录内存在时生效）
let restaurantData = null;
try {
  restaurantData = require('./restaurant_data.js');
} catch (e) {
  restaurantData = null;
}
// 新增：优先使用本地品牌种子文件
let brandSeed = null;
try {
  brandSeed = require('./brandSeed.js');
} catch (e) {
  brandSeed = null;
}

// 兜底品牌名称（避免依赖项目根目录的文件导致云端打包缺失）
const SEED_BRANDS = [
  '星巴克', '喜茶', '奈雪', '蜜雪冰城', '瑞幸咖啡',
  '肯德基', '麦当劳', '必胜客', '汉堡王', '塔斯汀',
  '茶颜悦色', '沪上阿姨', '古茗', '库迪咖啡', 'CoCo都可'
];

// 简单的 https 规范化
function normalizeHttps(url) {
  if (typeof url === 'string' && url.startsWith('http://')) {
    return 'https://' + url.slice(7);
  }
  return url;
}

// 新增：提取并判断优惠是否过期
function getEndTimestampFromItem(it) {
  // 尝试从多种可能字段中获取截止时间
  const tsFields = [
    it?.couponValidETimestamp,
    it?.couponEndTimestamp,
    it?.endTimestamp
  ];
  let ts = tsFields.find(v => typeof v === 'number' && v > 0) || 0;
  if (!ts) {
    const strFields = [
      it?.couponValidETime,
      it?.couponValidEndTime,
      it?.couponValidEtime,
      it?.endTime
    ];
    const s = strFields.find(v => typeof v === 'string' && v);
    if (s) {
      const t = new Date(s).getTime();
      if (!Number.isNaN(t)) ts = t;
    }
  }
  return ts;
}
// 新增：按约定计算 expireAt（type1 按天，type2 按结束时间）
function computeExpireAt(it, nowTs = Date.now()) {
  const info = it?.couponValidTimeInfo || {};
  const type = typeof info.couponValidTimeType === 'number' ? info.couponValidTimeType : it?.couponValidTimeType;
  if (type === 1) {
    const dayRaw = (typeof info.couponValidDay !== 'undefined' ? info.couponValidDay : it?.couponValidDay);
    const day = Number(dayRaw);
    if (Number.isFinite(day) && day > 0) {
      return nowTs + day * 24 * 60 * 60 * 1000;
    }
    return 0;
  }
  if (type === 2) {
    const eStr = info.couponValidETime || it?.couponValidETime;
    const eTs = eStr ? new Date(eStr).getTime() : 0;
    return Number.isNaN(eTs) ? 0 : eTs;
  }
  // Fallback：尝试旧字段
  return getEndTimestampFromItem(it);
}
// 新增：计算 beginAt，用于标记“未开始”
function computeBeginAt(it, nowTs = Date.now()) {
  const info = it?.couponValidTimeInfo || {};
  const type = typeof info.couponValidTimeType === 'number' ? info.couponValidTimeType : it?.couponValidTimeType;
  if (type === 1) {
    return nowTs; // 按天有效即刻生效
  }
  if (type === 2) {
    const sStr = info.couponValidSTime || it?.couponValidSTime;
    const sTs = sStr ? new Date(sStr).getTime() : 0;
    return Number.isNaN(sTs) ? 0 : sTs;
  }
  return 0;
}
// 规范化商品条目（落库 MeituanBrandCoupon.items）
function normalizeCouponItem(it, nowTs = Date.now()) {
  const skuViewId = it?.couponPackDetail?.skuViewId || it?.skuViewId || it?.item?.skuViewId || '';
  if (!skuViewId) return null;
  const expireAt = computeExpireAt(it, nowTs);
  if (!expireAt || nowTs >= expireAt) return null; // 必要丢弃：过期
  const beginAt = computeBeginAt(it, nowTs);
  const title = it?.title || it?.couponTitle || it?.item?.title || '';
  const subtitle = it?.subtitle || it?.couponSubTitle || it?.item?.subtitle || '';
  const price = it?.price || it?.payAmount || it?.finalPrice || 0;
  const imgUrl = normalizeHttps(it?.picUrl || it?.imageUrl || it?.couponImgUrl || it?.item?.picUrl || '');
  return { skuViewId, title, subtitle, expireAt, beginAt, price, imgUrl };
}
// 从 DB 读取已有品牌券（用于 runMode=linksOnly）
async function loadCouponsFromDB(db, limitBrandCount) {
  const coll = db.collection('MeituanBrandCoupon');
  const payloads = [];
  const limit = 100;
  let skip = 0;
  while (true) {
    const batch = await coll.skip(skip).limit(limit).get();
    const docs = Array.isArray(batch?.data) ? batch.data : [];
    if (!docs.length) break;
    for (const doc of docs) {
      const items = Array.isArray(doc.items) ? doc.items : [];
      payloads.push({ brandName: doc.brandName, brandLogo: doc.brandLogo || '', items });
    }
    skip += docs.length;
    if (docs.length < limit) break;
  }
  if (typeof limitBrandCount === 'number' && limitBrandCount > 0) {
    return payloads.slice(0, Math.min(payloads.length, limitBrandCount));
  }
  return payloads;
}

// 小工具：批量串行执行，降低并发压力
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

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
    console.log('[Schedule] 已创建集合：', name);
  } catch (e) {
    // 可能已存在，忽略错误
    console.log('[Schedule] 集合检查：', name, e && e.message);
  }
}

// 写入到云数据库集合
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

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const isTrigger = wxContext && wxContext.SOURCE === 'wx_trigger';
  const db = cloud.database();

  // 从环境变量或入参读取美团开放平台秘钥，供下游 referralLink 使用
  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  if (!appKey || !secret) {
    console.warn('[Schedule] 未检测到 MEITUAN_APPKEY/MEITUAN_SECRET（环境或入参），getMeituanReferralLink 可能鉴权失败');
  }

  await ensureCollection(db, 'MeituanBrandCoupon');
  await ensureCollection(db, 'MeituanBrandCouponURL');

  // 品牌列表来源：优先使用本地数据源，否则使用兜底 SEED_BRANDS
  const list = (brandSeed && Array.isArray(brandSeed.BRANDS))
    ? brandSeed.BRANDS.map(b => ({ name: b.name, logoUrl: b.logoUrl || '' }))
    : ((restaurantData && restaurantData.restaurants) ? restaurantData.restaurants : SEED_BRANDS.map(n => ({ name: n, logoUrl: '' })));
  const brandsAll = list.map(r => ({
    brandName: r.name,
    brandLogo: normalizeHttps(r.logoUrl || ''),
  }));
  const limitBrandCount = typeof event?.limitBrandCount === 'number' && event.limitBrandCount > 0 ? event.limitBrandCount : brandsAll.length;
  const runMode = typeof event?.runMode === 'string' ? event.runMode : 'all';
  const brands = brandsAll.slice(0, Math.min(brandsAll.length, limitBrandCount));

  const couponResults = [];

  // 阶段1：以 brandSeed 品牌名调用 getMeituanCoupon，过滤并落库标准化 items（runMode !== 'linksOnly' 时执行）
  if (runMode !== 'linksOnly') {
    console.log('[Schedule] Stage1 拉券，品牌数：', brands.length);
    await runSerial(brands, async (b) => {
      const nowTs = Date.now();
      try {
        const res = await cloud.callFunction({
          name: 'getMeituanCoupon',
          data: {
            platform: 1,
            searchText: b.brandName,
            maxRetries: 10,
            delayMs: 10000,
            ...(appKey && secret ? { appKey, secret } : {})
          }
        });
        const rr = res && res.result;
        const rawData = rr && rr.data;
        const arr = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData?.list) ? rawData.list : (Array.isArray(rawData) ? rawData : []));
        if (rr?.ok && rawData && arr.length > 0) {
          const items = [];
          for (const it of arr) {
            const norm = normalizeCouponItem(it, nowTs);
            if (norm) items.push(norm);
          }
          const payload = {
            brandName: b.brandName,
            brandLogo: b.brandLogo,
            items,
            updatedAt: new Date(),
            source: 'schedule-seed'
          };
          await upsertToCollection(db, 'MeituanBrandCoupon', { brandName: b.brandName }, payload);
          couponResults.push(payload);
          console.log('[Schedule] 券集合写入：', b.brandName, { keptItemCount: items.length, rawCount: arr.length });
        } else {
          console.warn('[Schedule] 品牌无券或拉取失败：', b.brandName, rr && rr.error && rr.error.message);
          const payload = { brandName: b.brandName, brandLogo: b.brandLogo, items: [], updatedAt: new Date(), source: 'schedule-seed' };
          await upsertToCollection(db, 'MeituanBrandCoupon', { brandName: b.brandName }, payload);
          couponResults.push(payload);
        }
      } catch (e) {
        console.warn('[Schedule] 拉取券异常：', b && b.brandName, e);
        const payload = { brandName: b.brandName, brandLogo: b.brandLogo, items: [], updatedAt: new Date(), source: 'schedule-seed' };
        await upsertToCollection(db, 'MeituanBrandCoupon', { brandName: b.brandName }, payload);
        couponResults.push(payload);
      }
      return null;
    });
    console.log('[Schedule] Stage1 完成，品牌数：', couponResults.length);
  }

  // runMode=linksOnly 时，从 DB 读取最新券作为阶段2入参
  if (runMode === 'linksOnly') {
    try {
      const payloads = await loadCouponsFromDB(db, limitBrandCount);
      couponResults.push(...payloads);
      console.log('[Schedule] Stage2 入参来自DB，品牌数：', couponResults.length);
    } catch (e) {
      console.warn('[Schedule] 读取 DB 失败（linksOnly）：', e);
    }
  }

  // 2) 为每个商品调用 getMeituanReferralLink，并存储到 MeituanBrandCouponURL 集合（runMode !== 'stage1Only' 时执行）
  if (runMode !== 'stage1Only') {
    await runSerial(couponResults, async (entry) => {
      try {
        const items = Array.isArray(entry?.items) ? entry.items : [];
        const subset = (typeof event?.limitSkuCount === 'number' ? items.slice(0, Math.min(items.length, event.limitSkuCount)) : items);
        const urlMap = {};
        const nowTs = Date.now();
        for (const it of subset) {
          const skuViewId = it?.skuViewId || '';
          if (!skuViewId) {
            console.warn('[Schedule] 缺少 skuViewId，跳过：', it && it.title);
            continue;
          }
          if (!it?.expireAt || nowTs >= it.expireAt) {
            continue;
          }
          try {
            const res = await cloud.callFunction({
              name: 'getMeituanReferralLink',
              data: {
                skuViewId,
                linkTypeList: [3, 4],
                maxRetries: 10,
                delayMs: 10000,
                timeoutMs: 8000,
                ...(appKey && secret ? { appKey, secret } : {})
              }
            });
            const rr = res?.result;
            const referralLinkMap = rr?.ok && (rr?.data?.referralLinkMap || rr?.data?.data?.referralLinkMap)
              ? (rr?.data?.referralLinkMap || rr?.data?.data?.referralLinkMap)
              : {};
            const map = (referralLinkMap && typeof referralLinkMap === 'object') ? referralLinkMap : {};
            const hasDeeplink = !!map['3'];
            const hasMiniLink = !!map['4'];
            if (!hasDeeplink && !hasMiniLink) {
              console.warn('[Schedule] 无 deeplink/小程序链接，跳过 skuViewId=', skuViewId);
              continue;
            }
            urlMap[skuViewId] = map;
          } catch (e2) {
            console.warn('[Schedule] referralLink 获取失败 skuViewId=', skuViewId, e2);
          }
        }

        if (!urlMap || Object.keys(urlMap).length === 0) {
          try {
            const collUrl = db.collection('MeituanBrandCouponURL');
            const found = await collUrl.where({ brandName: entry.brandName }).get();
            if (found?.data?.length) {
              await collUrl.doc(found.data[0]._id).remove();
              console.log('[Schedule] 删除无有效链接品牌：', entry.brandName);
            } else {
              console.log('[Schedule] 品牌无有效链接且无记录：', entry.brandName);
            }
          } catch (eDel) {
            console.warn('[Schedule] 删除空链接品牌失败：', entry.brandName, eDel);
          }
          try {
            const filteredItems = [];
            const payloadCoupon = {
              brandName: entry.brandName,
              brandLogo: entry.brandLogo || '',
              items: filteredItems,
              updatedAt: new Date(),
              source: 'schedule-seed'
            };
            await upsertToCollection(db, 'MeituanBrandCoupon', { brandName: entry.brandName }, payloadCoupon);
          } catch (eUp) {
            console.warn('[Schedule] 券集合回写失败（空）：', entry.brandName, eUp);
          }
          return null;
        }

        const payloadUrl = {
          brandName: entry.brandName,
          updatedAt: new Date(),
          urlMap,
          source: 'schedule',
        };
        const resUpsert = await upsertToCollection(db, 'MeituanBrandCouponURL', { brandName: entry.brandName }, payloadUrl);
        console.log('[Schedule] URL集合写入：', entry.brandName, { id: resUpsert._id, created: !!resUpsert.created, updated: !!resUpsert.updated, urlCount: Object.keys(urlMap).length });

        try {
          const filteredItems = (Array.isArray(entry.items) ? entry.items : []).filter(it => it && urlMap[it.skuViewId]);
          const payloadCoupon = {
            brandName: entry.brandName,
            brandLogo: entry.brandLogo || '',
            items: filteredItems,
            updatedAt: new Date(),
            source: 'schedule-seed'
          };
          await upsertToCollection(db, 'MeituanBrandCoupon', { brandName: entry.brandName }, payloadCoupon);
          console.log('[Schedule] 券集合裁剪：', entry.brandName, { keptAfterUrl: filteredItems.length });
        } catch (eUp2) {
          console.warn('[Schedule] 券集合回写失败：', entry.brandName, eUp2);
        }

        return payloadUrl;
      } catch (e) {
        console.warn('[Schedule] referralLink 阶段异常：', entry && entry.brandName, e);
        return null;
      }
    });
  }

  return {
    ok: true,
    runMode,
    brandCount: couponResults.length,
    message: runMode === 'stage1Only' ? 'Stage1 completed' : (runMode === 'linksOnly' ? 'Stage2 completed' : 'Daily job completed'),
  };
};