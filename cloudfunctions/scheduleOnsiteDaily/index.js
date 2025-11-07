// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function ensureCollection(db, name) {
  try { await db.createCollection(name); } catch (e) { /* ignore if exists */ }
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

// 轮询索引：使用 ScheduleState 集合持久化
async function getAndAdvanceBrandRotation(db, keyName, totalCount) {
  await ensureCollection(db, 'ScheduleState');
  const coll = db.collection('ScheduleState');
  const docId = `rotation:${keyName}`;
  try { await coll.add({ data: { _id: docId, idx: 0, updatedAt: Date.now() } }); } catch (e) { /* ignore exists */ }
  let idx = 0;
  try {
    const r = await coll.doc(docId).get();
    idx = Number(r?.data?.idx || 0);
  } catch (eGet) {}
  const nextIdx = (Number.isFinite(idx) ? idx : 0) + 1;
  try { await coll.doc(docId).update({ data: { idx: nextIdx % Math.max(totalCount, 1), updatedAt: Date.now() } }); } catch (eUpd) {}
  return idx % Math.max(totalCount, 1);
}

function normalizeItem(it) {
  const brandNameRaw = (it?.brandInfo?.brandName || '').trim();
  const skuViewIdRaw = (it?.couponPackDetail?.skuViewId || it?.skuViewId || '').trim();
  if (!skuViewIdRaw) return null;
  const commissionPercent = Number(it?.commissionInfo?.commissionPercent || 0);
  const commission = Number(it?.commissionInfo?.commission || 0);
  const name = it?.couponPackDetail?.name || it?.name || '';
  const headUrl = it?.couponPackDetail?.headUrl || it?.picUrl || '';
  const originalPrice = Number(it?.couponPackDetail?.originalPrice || it?.originalPrice || 0);
  const sellPrice = Number(it?.couponPackDetail?.sellPrice || it?.sellPrice || 0);
  const label1 = it?.productLabel?.pricePowerLabel?.historyPriceLabel || '';
  const label2 = it?.productLabel?.pricePowerLabel?.productRankLabel || '';
  const couponValidETimeRaw = it?.couponValidTimeInfo?.couponValidETime || it?.couponValidETime || it?.couponPackDetail?.endTime || '';
  // 兼容秒/毫秒：小于 10^12 认为是秒，转毫秒
  let expireAt = 0;
  if (couponValidETimeRaw) {
    const tsNum = Number(couponValidETimeRaw);
    if (!Number.isNaN(tsNum) && tsNum > 0) {
      expireAt = tsNum < 1e12 ? (tsNum * 1000) : tsNum;
    }
  }
  if (!expireAt || Date.now() >= expireAt) return null; // 严格丢弃过期
  return {
    brandName: brandNameRaw,
    commissionPercent,
    commission,
    name,
    skuViewId: skuViewIdRaw,
    headUrl,
    originalPrice,
    sellPrice,
    label1,
    label2,
    couponValidETime: couponValidETimeRaw,
    expireAt,
  };
}

async function upsertByKey(coll, keyQuery, payload) {
  const found = await coll.where(keyQuery).get();
  if (found?.data?.length) {
    const id = found.data[0]._id;
    await coll.doc(id).update({ data: { ...payload, updatedAt: Date.now() } });
    return { updated: true, _id: id };
  }
  const addRes = await coll.add({ data: { ...payload, updatedAt: Date.now() } });
  return { created: true, _id: addRes._id };
}

// 品牌种子
const SEED_BRANDS = [
  "肯德基", "汉堡王", "麦当劳", "星巴克", "喜茶", "奈雪的茶", "海底捞", "呷哺呷哺", "蓝蛙", "瑞幸咖啡", "蜜雪冰城"
];

exports.main = async (event, context) => {
  const db = cloud.database();
  const onsiteCouponsColl = db.collection('MeituanOnsiteCoupon');
  const onsiteUrlsColl = db.collection('MeituanOnsiteCouponURL');

  // 预先声明，避免 data 阶段使用未定义
  let linkedSet = new Set();

  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  const platform = Number(event?.platform ?? 2); // 到店优惠默认平台=2
  const bizLine = Number(event?.bizLine ?? 1);   // 到店优惠默认 bizLine=1
  const brandNamesDefault = await readGlobalBrandSeed(db, SEED_BRANDS);
  const brandNames = Array.isArray(event?.brandNames) && event.brandNames.length ? event.brandNames : brandNamesDefault;
  const limitBrandCount = typeof event?.limitBrandCount === 'number' && event.limitBrandCount > 0 ? event.limitBrandCount : brandNames.length;
  const maxRetries = typeof event?.maxRetries === 'number' ? event.maxRetries : 3;
  const delayMs = typeof event?.delayMs === 'number' ? event.delayMs : 2000;
  const onlyPending = event?.onlyPending !== undefined ? !!event.onlyPending : true; // 链接阶段默认仅处理未链接条目
  const stageRaw = typeof event?.stage === 'string' ? event.stage : undefined;
  const stage = stageRaw === 'data' || stageRaw === 'link' || stageRaw === 'both' ? stageRaw : 'both';

  // 暂停开关：通过环境变量 ONSITE_SCHEDULE_PAUSED 或测试入参 pause/paused 控制
  const __onsitePaused = (() => {
    const v = process.env.ONSITE_SCHEDULE_PAUSED ?? event?.pause ?? event?.paused ?? '';
    const s = String(v).toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
  })();
  if (__onsitePaused) {
    return { ok: true, paused: true, reason: 'ONSITE_SCHEDULE_PAUSED', stage };
  }

  if (!appKey || !secret) {
    return { ok: false, error: { message: 'Missing MEITUAN_APPKEY/MEITUAN_SECRET' } };
  }

  await ensureCollection(db, 'MeituanOnsiteCoupon');
  await ensureCollection(db, 'MeituanOnsiteCouponURL');

  // 计算轮询索引，每次只处理一个品牌
  const rotationIndex = await getAndAdvanceBrandRotation(db, 'onsite-daily', brandNames.length);
  const selectedBrand = brandNames[rotationIndex];
  const brands = [selectedBrand];

  const statsData = { brandsProcessed: 0, itemsKept: 0 };
  const statsLink = { brandsProcessed: 0, itemsKept: 0, linksCreated: 0 };

  // 阶段一：仅入库商品，不生成链接
  if (stage === 'data' || stage === 'both') {
    for (const brandName of brands) {
      /* eslint-disable no-await-in-loop */
      try {
        const res = await cloud.callFunction({
          name: 'getMeituanCoupon',
          data: {
            platform,
            bizLine,
            searchText: brandName,
            maxRetries,
            delayMs,
            ...(appKey && secret ? { appKey, secret } : {})
          }
        });
        const rr = res?.result;
        const rawData = rr?.data;
        const arrAll = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData?.list) ? rawData.list : (Array.isArray(rawData) ? rawData : []));
        if (!rr?.ok || !arrAll.length) {
          // 外部API无数据，跳过该品牌
        } else {
          const arr = arrAll.slice(0, 5);
          for (const it of arr) {
            const norm = normalizeItem(it);
            if (!norm) continue;

            // onlyPending：跳过已有链接的 sku（同时确保商品信息更新）
            if (onlyPending && linkedSet.has(norm.skuViewId)) {
              await upsertByKey(onsiteCouponsColl, { skuViewId: norm.skuViewId }, { ...norm });
              continue;
            }

            try {
              const linkRes = await cloud.callFunction({
                name: 'getMeituanReferralLink',
                data: {
                  skuViewId: norm.skuViewId,
                  linkTypeList: [4],
                  maxRetries,
                  delayMs,
                  timeoutMs: 5000,
                  ...(appKey && secret ? { appKey, secret } : {})
                }
              });
              const lr = linkRes?.result;
              const referralLinkMap = lr?.ok && (lr?.data?.referralLinkMap || lr?.data?.data?.referralLinkMap)
                ? (lr?.data?.referralLinkMap || lr?.data?.data?.referralLinkMap)
                : {};
              const map = (referralLinkMap && typeof referralLinkMap === 'object') ? referralLinkMap : {};
              const mini = map['4'];
              if (!mini) {
                // 无小程序链接则不入库该商品（仅在链接阶段）
                continue;
              }
              await upsertByKey(onsiteUrlsColl, { skuViewId: norm.skuViewId }, {
                skuViewId: norm.skuViewId,
                brandName: norm.brandName,
                linkMap: { '4': mini }
              });
              await upsertByKey(onsiteCouponsColl, { skuViewId: norm.skuViewId }, { ...norm });
              statsLink.itemsKept += 1;
              statsLink.linksCreated += 1;
            } catch (eLink) {
              continue;
            }
          }
        }
      } catch (e) {
        // 到店优惠不使用历史补数，直接跳过
      }
      statsData.brandsProcessed += 1;
      /* eslint-enable no-await-in-loop */
    }
  }

  // 阶段二：补链接，仅处理未生成链接的条目
  if (stage === 'link' || stage === 'both') {
    // 收集已存在链接，onlyPending 时减少调用
    if (onlyPending) {
      try {
        const batch = await onsiteUrlsColl.get();
        const arr = Array.isArray(batch?.data) ? batch.data : [];
        linkedSet = new Set(arr.map(d => d?.skuViewId).filter(Boolean));
      } catch (e) {}
    }

    for (const brandName of brands) {
      /* eslint-disable no-await-in-loop */
      try {
        const res = await cloud.callFunction({
          name: 'getMeituanCoupon',
          data: {
            platform,
            bizLine,
            searchText: brandName,
            maxRetries,
            delayMs,
            ...(appKey && secret ? { appKey, secret } : {})
          }
        });
        const rr = res?.result;
        const rawData = rr?.data;
        const arrAll = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData?.list) ? rawData.list : (Array.isArray(rawData) ? rawData : []));
        if (!rr?.ok || !arrAll.length) {
          // 外部API无数据，跳过该品牌
        } else {
          const arr = arrAll.slice(0, 5);
          for (const it of arr) {
            const norm = normalizeItem(it);
            if (!norm) continue;
            await upsertByKey(onsiteCouponsColl, { skuViewId: norm.skuViewId }, { ...norm });
            statsData.itemsKept += 1;
          }
        }
      } catch (e) {
        // 到店优惠不使用历史补数，直接跳过
      }

      statsLink.brandsProcessed += 1;
      /* eslint-enable no-await-in-loop */
    }
  }

  return { ok: true, task: 'onsite-daily', stage, result: { dataStage: statsData, linkStage: statsLink, brand: selectedBrand, rotationIndex } };
};