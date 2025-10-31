// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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
    console.log('[PlatformBanner] 已创建集合：', name);
  } catch (e) {
    console.log('[PlatformBanner] 集合检查：', name, e && e.message);
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

exports.main = async (event, context) => {
  const db = cloud.database();
  await ensureCollection(db, 'MeituanPlatformBanner');

  // 读取配置：优先 event.actIds -> 环境变量 MEITUAN_ACTIDS（支持 JSON 数组或逗号分隔） -> 代码内默认值
  const defaultActIds = [689, 701, 648, 645, 638, 569];
  let actIds = Array.isArray(event?.actIds) ? event.actIds : null;
  if (!actIds) {
    if (actSeed && Array.isArray(actSeed.actIds) && actSeed.actIds.length) {
      actIds = actSeed.actIds.map(v => Number(v)).filter(v => !Number.isNaN(v));
    }
  }
  if (!actIds) {
    const envStr = process.env.MEITUAN_ACTIDS || '';
    if (envStr) {
      let parsed = null;
      const trimmed = envStr.trim();
      if (trimmed.startsWith('[')) {
        try {
          const jsonVal = JSON.parse(trimmed);
          if (Array.isArray(jsonVal)) {
            parsed = jsonVal.map(v => Number(v)).filter(v => !Number.isNaN(v));
          }
        } catch (e) {
          console.warn('[PlatformBanner] 解析 JSON 格式 MEITUAN_ACTIDS 失败：', e && e.message);
        }
      }
      if (!parsed) {
        parsed = trimmed.split(',').map(s => Number(s.replace(/\[|\]/g, '').trim())).filter(v => !Number.isNaN(v));
      }
      actIds = parsed;
    }
  }
  if (!actIds || !actIds.length) {
    actIds = defaultActIds;
  }

  // 链接类型列表：默认 [3,4]，支持 event.linkTypeList 字符串或数组
  let linkTypeList = event?.linkTypeList;
  if (Array.isArray(linkTypeList)) {
    linkTypeList = linkTypeList.map(v => Number(v)).filter(v => !Number.isNaN(v));
  } else if (typeof linkTypeList === 'string') {
    linkTypeList = linkTypeList.split(',').map(s => Number(s.trim())).filter(v => !Number.isNaN(v));
  } else {
    linkTypeList = [3, 4];
  }
  if (!Array.isArray(linkTypeList) || !linkTypeList.length) linkTypeList = [3, 4];

  // 读取美团开放平台秘钥（用于下游云函数）
  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';

  const nowTs = Date.now();

  // 运行模式：refresh=刷新并写入；否则仅读取未过期数据
  // 当 event 为空或未提供 refresh 字段时，默认执行刷新（用于定时触发）
  const doRefresh = (event && Object.keys(event).length > 0) ? !!event.refresh : true;

  if (doRefresh) {
    console.log('[PlatformBanner] 刷新模式：开始拉取 actIds=', actIds);
    for (const actId of actIds) {
      /* eslint-disable no-await-in-loop */
      try {
        // 仅调用推广链接接口，按用户要求不依赖优惠券接口
        const linkRes = await cloud.callFunction({
          name: 'getMeituanReferralLink',
          data: { actId, linkTypeList, maxRetries: 10, delayMs: 10000, timeoutMs: 8000, ...(appKey && secret ? { appKey, secret } : {}) }
        });
        const rr = linkRes?.result || {};
        // 兼容返回结构：可能为 data 或 data.data
        const root = rr?.data || {};
        const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;

        // 推广链接映射
        const referral = (dataRoot?.referralLinkMap && typeof dataRoot.referralLinkMap === 'object') ? dataRoot.referralLinkMap : {};

        // 兼容两处 banner 图与截止时间字段
        const coupon = dataRoot?.couponPackDetail || {};
        const headUrlRaw = dataRoot?.headUrl || coupon?.headUrl || '';
        const headUrl = normalizeHttps(headUrlRaw || '');
        const timeInfo = dataRoot?.couponValidTimeInfo || {};
        const endTimeStr = dataRoot?.couponValidETime || timeInfo?.couponValidETime || '';
        const endTimeTs = endTimeStr ? (new Date(endTimeStr)).getTime() : 0;

        const payload = {
          actId,
          headUrl,
          couponValidETime: endTimeStr,
          couponValidETimestamp: endTimeTs,
          referralLinkMap: referral,
          updatedAt: new Date(),
          source: 'platform-banner-refresh'
        };
        const resUpsert = await upsertToCollection(db, 'MeituanPlatformBanner', { actId }, payload);
        console.log('[PlatformBanner] 写入：', actId, { id: resUpsert._id, created: !!resUpsert.created, updated: !!resUpsert.updated });
      } catch (e) {
        console.warn('[PlatformBanner] actId 刷新失败：', actId, e);
      }
      /* eslint-enable no-await-in-loop */
    }
  }

  // 读取并返回未过期的 banner 列表
  try {
    const coll = db.collection('MeituanPlatformBanner');
    // 简单读取全部后在内存中过滤（数据量小）
    const batch = await coll.get();
    const docs = batch?.data || [];
    const valid = docs.filter(d => (d.couponValidETimestamp || 0) > nowTs && d.headUrl).sort((a, b) => {
      // 按 actIds 原始顺序排序
      const ia = actIds.indexOf(Number(a.actId));
      const ib = actIds.indexOf(Number(b.actId));
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return { ok: true, banners: valid, total: valid.length, refreshed: doRefresh };
  } catch (e) {
    console.warn('[PlatformBanner] 读取未过期 banner 失败：', e);
    return { ok: false, error: { message: e && e.message } };
  }
};

// 优先读取本地 actSeed.js（若存在）
let actSeed = null;
try {
  actSeed = require('./actSeed.js');
} catch (e) {
  actSeed = null;
}