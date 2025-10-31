// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function ensureCollection(db, name) {
  try { await db.createCollection(name); } catch (e) { /* ignore if exists */ }
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
  const couponValidETime = it?.couponValidTimeInfo?.couponValidETime || it?.couponValidETime || '';
  const expireAt = couponValidETime ? new Date(couponValidETime).getTime() : 0;
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
    couponValidETime,
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

const SEED_BRANDS = [
  "肯德基", "汉堡王", "Baker&Spice", "超级碗", "陈香贵", "马记永", "沃歌斯", "海底捞", "呷哺呷哺", "莆田餐厅", "蓝蛙",
  "星巴克", "喜茶", "奈雪的茶", "和府捞面", "味千拉面", "一风堂", "鼎泰丰", "小杨生煎", "南翔馒头店", "新元素", "云海肴",
  "西贝莜面村", "绿茶餐厅", "外婆家", "南京大牌档", "望湘园", "蜀都丰", "太二酸菜鱼", "江边城外", "耶里夏丽", "度小月",
  "鹿港小镇", "避风塘", "唐宫", "点都德", "食其家", "吉野家", "松屋", "丸龟制面", "萨莉亚", "必胜客", "达美乐",
  "棒约翰", "麻辣诱惑", "辛香汇", "小南国", "老盛昌", "吉祥馄饨", "阿香米线", "过桥米线", "汤先生", "谷田稻香",
  "大米先生", "真功夫", "永和大王", "大娘水饺", "CoCo都可", "一点点", "乐乐茶", "7分甜", "桂满陇", "新白鹿",
  "苏小柳", "蔡澜港式点心", "添好运", "很久以前羊肉串", "丰茂烤串", "木屋烧烤", "胡大饭店", "哥老官", "左庭右院",
  "湊湊火锅", "巴奴毛肚火锅", "大龙燚", "电台巷火锅", "小龙坎", "谭鸭血", "蜀大侠", "麦当劳",
  "瑞幸咖啡", "蜜雪冰城", "库迪咖啡", "幸运咖", "Manner Coffee", "茶颜悦色", "霸王茶姬", "古茗", "茶百道",
  "书亦烧仙草", "沪上阿姨", "Tims天好咖啡", "挪瓦咖啡", "益禾堂", "Seesaw Coffee", "M Stand", "% Arabica",
  "皮爷咖啡", "LAVAZZA", "甜啦啦", "贡茶", "悸动烧仙草", "快乐柠檬", "吾饮良品", "巡茶", "桂源铺", "茉酸奶",
  "卡旺卡", "伏小桃", "注春", "Grid Coffee"
];

exports.main = async (event, context) => {
  const db = cloud.database();
  const couponsColl = db.collection('RedPacketCoupons');
  const urlsColl = db.collection('RedPacketCouponURL');
  // 增加对既有集合的引用，便于无外部数据时补数
  const brandCouponsColl = db.collection('MeituanBrandCoupon');
  const brandURLColl = db.collection('MeituanBrandCouponURL');

  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  const platform = Number(event?.platform ?? 1);
  const brandNames = Array.isArray(event?.brandNames) && event.brandNames.length ? event.brandNames : SEED_BRANDS;
  const limitBrandCount = typeof event?.limitBrandCount === 'number' && event.limitBrandCount > 0 ? event.limitBrandCount : brandNames.length;
  const maxRetries = typeof event?.maxRetries === 'number' ? event.maxRetries : 3;
  const delayMs = typeof event?.delayMs === 'number' ? event.delayMs : 2000;
  const onlyPending = !!event?.onlyPending;

  if (!appKey || !secret) {
    return { ok: false, error: { message: 'Missing MEITUAN_APPKEY/MEITUAN_SECRET' } };
  }

  await ensureCollection(db, 'RedPacketCoupons');
  await ensureCollection(db, 'RedPacketCouponURL');

  const brands = brandNames.slice(0, Math.min(brandNames.length, limitBrandCount));
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // 收集已存在链接，onlyPending 时减少调用
  let linkedSet = new Set();
  if (onlyPending) {
    try {
      const batch = await urlsColl.get();
      const arr = Array.isArray(batch?.data) ? batch.data : [];
      linkedSet = new Set(arr.map(d => d?.skuViewId).filter(Boolean));
    } catch (e) {}
  }

  const stats = { brandsProcessed: 0, itemsKept: 0, linksCreated: 0 };

  for (const brandName of brands) {
    /* eslint-disable no-await-in-loop */
    let addedForBrand = 0;
    try {
      const res = await cloud.callFunction({
        name: 'getMeituanCoupon',
        data: {
          platform,
          searchText: brandName,
          maxRetries,
          delayMs,
          ...(appKey && secret ? { appKey, secret } : {})
        }
      });
      const rr = res?.result;
      const rawData = rr?.data;
      const arr = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData?.list) ? rawData.list : (Array.isArray(rawData) ? rawData : []));
      if (!rr?.ok || !arr.length) {
        // 如果外部API没有返回数据，后续走本地历史数据补数
      } else {
        for (const it of arr) {
          const norm = normalizeItem(it);
          if (!norm) continue;
          // onlyPending：跳过已有链接的 sku
          if (onlyPending && linkedSet.has(norm.skuViewId)) {
            await upsertByKey(couponsColl, { skuViewId: norm.skuViewId }, { ...norm }); // 仍保证商品信息更新
            continue;
          }
          // 拉取链接（仅 linkType=4）
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
              // 无小程序链接则不入库该商品
              continue;
            }
            // URL 集合：按 sku 扁平存储，仅保留 4
            await upsertByKey(urlsColl, { skuViewId: norm.skuViewId }, {
              skuViewId: norm.skuViewId,
              brandName: norm.brandName,
              linkMap: { '4': mini }
            });
            // 商品集合：仅保留有链接的商品
            await upsertByKey(couponsColl, { skuViewId: norm.skuViewId }, { ...norm });
            stats.itemsKept += 1;
            stats.linksCreated += 1;
            addedForBrand += 1;
          } catch (eLink) {
            // 链接生成失败，跳过该商品
            continue;
          }
        }
      }
    } catch (e) {
      // 外部API调用失败时，转入本地历史数据补数
    }

    // 如果本品牌尚未入库任何有效商品，尝试使用历史集合补数
    if (addedForBrand === 0) {
      try {
        // 取该品牌的历史商品
        const bcRes = await brandCouponsColl.where({ brandName }).get();
        const bcDocs = Array.isArray(bcRes?.data) ? bcRes.data : [];
        const rawItems = [];
        for (const d of bcDocs) {
          if (Array.isArray(d?.list)) rawItems.push(...d.list);
          if (Array.isArray(d?.items)) rawItems.push(...d.items);
          if (Array.isArray(d?.data)) rawItems.push(...d.data);
          // 如果是扁平单条（包含skuViewId等字段），也收集
          if (d?.skuViewId) rawItems.push(d);
        }
        // 规范化与去重
        const normItems = [];
        const seen = new Set();
        for (const it of rawItems) {
          const norm = normalizeItem(it);
          if (!norm) continue;
          if (seen.has(norm.skuViewId)) continue;
          seen.add(norm.skuViewId);
          normItems.push(norm);
        }
        // 聚合品牌链接（urlMap）
        let brandAggUrlMap = {};
        try {
          const buRes = await brandURLColl.where({ brandName }).limit(1).get();
          const aggDoc = Array.isArray(buRes?.data) && buRes.data.length ? buRes.data[0] : null;
          brandAggUrlMap = (aggDoc?.urlMap || aggDoc?.referralLinkMap || {});
        } catch (eAgg) {}
        // 扁平链接文档批量拉取
        const skuSet = new Set(normItems.map(x => x.skuViewId));
        let flatUrlDocs = [];
        if (skuSet.size > 0) {
          try {
            const all = await brandURLColl.where({ skuViewId: db.command.in([...skuSet]) }).get();
            flatUrlDocs = Array.isArray(all?.data) ? all.data : [];
          } catch (eFlat) { flatUrlDocs = []; }
        }
        const flatUrlMap = new Map(flatUrlDocs.map(d => [d?.skuViewId, d?.linkMap || {}]));

        // 合并两种来源取linkType=4
        for (const norm of normItems) {
          if (onlyPending && linkedSet.has(norm.skuViewId)) {
            await upsertByKey(couponsColl, { skuViewId: norm.skuViewId }, { ...norm });
            continue;
          }
          let mini = null;
          const bySku = brandAggUrlMap?.[norm.skuViewId];
          if (bySku) {
            if (typeof bySku === 'object') {
              mini = bySku['4'] || (bySku?.linkMap && bySku.linkMap['4']) || null;
            }
          }
          if (!mini) {
            const lm = flatUrlMap.get(norm.skuViewId) || {};
            mini = lm['4'] || null;
          }
          if (!mini) continue; // 没有4则跳过
          // 写入到 RedPacket 集合
          await upsertByKey(urlsColl, { skuViewId: norm.skuViewId }, {
            skuViewId: norm.skuViewId,
            brandName: norm.brandName,
            linkMap: { '4': mini }
          });
          await upsertByKey(couponsColl, { skuViewId: norm.skuViewId }, { ...norm });
          stats.itemsKept += 1;
          stats.linksCreated += 1;
          addedForBrand += 1;
        }
      } catch (eFallback) {
        // 补数失败则跳过
      }
    }

    stats.brandsProcessed += 1;
    /* eslint-enable no-await-in-loop */
  }

  return { ok: true, stats };
};