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
  "肯德基", "汉堡王", "Baker&Spice", "超级碗", "陈香贵", "马记永", "沃歌斯", "海底捞", "呷哺呷哺", "莆田餐厅", "蓝蛙",
  "星巴克", "喜茶", "奈雪的茶", "和府捞面", "味千拉面", "一风堂", "鼎泰丰", "小杨生煎", "南翔馒头店", "新元素", "云海肴",
  "西贝莜面村", "绿茶餐厅", "外婆家", "南京大牌档", "望湘园", "蜀都丰", "太二酸菜鱼", "江边城外", "耶里夏丽", "度小月",
  "鹿港小镇", "避风塘", "唐宫", "点都德", "食其家", "吉野家", "松屋", "丸龟制面", "萨莉亚", "必胜客", "达美乐",
  "棒约翰", "麻辣诱惑", "辛香汇", "小南国", "老盛昌", "吉祥馄饨", "阿香米线", "过桥米线", "汤先生", "谷田稻香",
  "大米先生", "真功夫", "永和大王", "大娘水饺", "CoCo都可", "一点点", "乐乐茶", "7分甜", "桂满陇", "新白鹿",
  "苏小柳", "蔡澜港式点心", "添好运", "很久以前羊肉串", "丰茂烤串", "木屋烧烤", "胡大饭店", "哥老官", "左庭右院",
  "湊湊火锅", "巴奴毛肚火锅", "大龙燚", "电台巷火锅", "小龙坎", "谭鸭血", "蜀大侠", "麦当劳",
  // 茶饮与咖啡
  "瑞幸咖啡", "蜜雪冰城", "库迪咖啡", "Manner Coffee", "茶颜悦色", "霸王茶姬", "古茗", "茶百道",
  "书亦烧仙草", "沪上阿姨", "Tims天好咖啡", "益禾堂", "Seesaw Coffee", "M Stand", "% Arabica",
  "皮爷咖啡", "LAVAZZA", "贡茶", "悸动烧仙草", "快乐柠檬", "桂源铺", "茉酸奶",
  "卡旺卡", "伏小桃", "Grid Coffee"
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
  // 新增：品牌logo（兼容多字段，规范化为 https，并移除可能的反引号）
  let brandLogoRaw = it?.brandLogoUrl || it?.item?.brandLogoUrl || (it?.brandInfo && it.brandInfo.brandLogoUrl) || it?.logoUrl || '';
  if (typeof brandLogoRaw === 'string') {
    brandLogoRaw = brandLogoRaw.replace(/`/g, '').trim();
  }
  const brandLogoUrl = normalizeHttps(brandLogoRaw);
  return { skuViewId, title, subtitle, expireAt, beginAt, price, imgUrl, brandLogoUrl };
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

// 统一品牌种子读取：优先从云数据库 GlobalBrandSeed 集合读取；为空时回退到本地 SEED_BRANDS
async function readGlobalBrandSeed(db, fallbackNames) {
  await ensureCollection(db, 'GlobalBrandSeed');
  try {
    const coll = db.collection('GlobalBrandSeed');
    const res = await coll.get();
    const arr = Array.isArray(res?.data) ? res.data : [];
    const names = arr.map(d => (d?.brandName || d?.name || '').trim()).filter(Boolean);
    return names.length ? names : fallbackNames;
  } catch (e) {
    return fallbackNames;
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

async function getAndAdvanceBrandRotation(db, totalCount) {
  try {
    if (!Number.isFinite(totalCount) || totalCount <= 0) return 0;
    const coll = db.collection('ScheduleState');
    const key = 'scheduleMeituanBrandDaily_rotation';
    const found = await coll.where({ key }).get();
    let index = 0;
    if (found?.data?.length) {
      const id = found.data[0]._id;
      index = typeof found.data[0].index === 'number' ? found.data[0].index : 0;
      const next = (index + 1) % totalCount;
      await coll.doc(id).update({ data: { index: next, updatedAt: new Date() } });
    } else {
      await coll.add({ data: { key, index: (1 % totalCount), updatedAt: new Date() } });
      index = 0;
    }
    return index;
  } catch (e) {
    console.warn('[Schedule] 品牌轮询索引处理异常：', e);
    return 0;
  }
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
  // 新增：确保品牌排序集合存在，用于链接阶段即时写入/删除
  await ensureCollection(db, 'MeituanPartnerBrandsSorted');

  // 品牌列表来源：统一读取 GlobalBrandSeed；为空回退至 SEED_BRANDS；也支持 event.brandNames 覆盖
  const brandNamesParam = Array.isArray(event?.brandNames) && event.brandNames.length ? event.brandNames : null;
  const brandNamesDefault = await readGlobalBrandSeed(db, SEED_BRANDS);
  const brandNames = brandNamesParam || brandNamesDefault;
  const list = brandNames.map(n => ({ name: n, logoUrl: '' }));
  const brandsAll = list.map(r => ({
    brandName: r.name,
    brandLogo: normalizeHttps(r.logoUrl || ''),
  }));
  const limitBrandCount = typeof event?.limitBrandCount === 'number' && event.limitBrandCount > 0 ? event.limitBrandCount : brandsAll.length;
  const runMode = typeof event?.runMode === 'string' ? event.runMode : 'all';
  let brands = brandsAll.slice(0, Math.min(brandsAll.length, limitBrandCount));
  if (isTrigger) {
    const rotationIdx = await getAndAdvanceBrandRotation(db, brandsAll.length);
    brands = (rotationIdx >= 0 && rotationIdx < brandsAll.length) ? [brandsAll[rotationIdx]] : [];
    console.log('[Schedule] 轮询模式，选中品牌索引：', rotationIdx, '品牌：', brands[0] && brands[0].brandName);
  }
  const couponResults = [];
  const metrics = {
    stage1: { brandsProcessed: 0, rawItemCount: 0, keptItemCount: 0, stats: [] },
    stage2: { brandsProcessed: 0, linkedItemCount: 0, prunedBrands: 0, stats: [] },
  };

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
          metrics.stage1.brandsProcessed += 1;
          metrics.stage1.rawItemCount += arr.length;
          metrics.stage1.keptItemCount += items.length;
          metrics.stage1.stats.push({ brandName: b.brandName, rawCount: arr.length, keptCount: items.length });
          console.log('[Schedule] 券集合写入：', b.brandName, { keptItemCount: items.length, rawCount: arr.length });
        } else {
          console.warn('[Schedule] 品牌无券或拉取失败：', b.brandName, rr && rr.error && rr.error.message);
          const payload = { brandName: b.brandName, brandLogo: b.brandLogo, items: [], updatedAt: new Date(), source: 'schedule-seed' };
          await upsertToCollection(db, 'MeituanBrandCoupon', { brandName: b.brandName }, payload);
          couponResults.push(payload);
          metrics.stage1.brandsProcessed += 1;
          metrics.stage1.stats.push({ brandName: b.brandName, rawCount: 0, keptCount: 0 });
        }
      } catch (e) {
        console.warn('[Schedule] 拉取券异常：', b && b.brandName, e);
        const payload = { brandName: b.brandName, brandLogo: b.brandLogo, items: [], updatedAt: new Date(), source: 'schedule-seed' };
        await upsertToCollection(db, 'MeituanBrandCoupon', { brandName: b.brandName }, payload);
        couponResults.push(payload);
        metrics.stage1.brandsProcessed += 1;
        metrics.stage1.stats.push({ brandName: b.brandName, rawCount: 0, keptCount: 0 });
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
          metrics.stage2.prunedBrands += 1;
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

        // 新增：有有效链接时，立即 upsert 到 MeituanPartnerBrandsSorted，保证前端可展示
        try {
          const payloadSorted = {
            brandName: entry.brandName,
            brandLogo: normalizeHttps(entry.brandLogo || ''),
            updatedAt: new Date(),
            source: 'schedule-links'
          };
          await upsertToCollection(db, 'MeituanPartnerBrandsSorted', { brandName: entry.brandName }, payloadSorted);
          console.log('[Schedule] PartnerBrandsSorted 写入：', entry.brandName);
        } catch (eSorted) {
          console.warn('[Schedule] PartnerBrandsSorted 写入失败：', entry.brandName, eSorted);
        }

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
          metrics.stage2.linkedItemCount += filteredItems.length;
        } catch (eUp2) {
          console.warn('[Schedule] 券集合回写失败：', entry.brandName, eUp2);
        }

        metrics.stage2.brandsProcessed += 1;
        metrics.stage2.stats.push({ brandName: entry.brandName, linkedItemCount: Object.keys(urlMap).length });
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
    processedBrandCount: runMode === 'stage1Only' ? metrics.stage1.brandsProcessed : (runMode === 'linksOnly' ? metrics.stage2.brandsProcessed : (metrics.stage2.brandsProcessed || metrics.stage1.brandsProcessed)),
    stage1: metrics.stage1,
    stage2: metrics.stage2,
    message: runMode === 'stage1Only' ? 'Stage1 completed' : (runMode === 'linksOnly' ? 'Stage2 completed' : 'Daily job completed'),
  };
};