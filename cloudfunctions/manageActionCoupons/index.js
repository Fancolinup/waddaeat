// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 简单 https 规范化
function normalizeHttps(url) {
  if (typeof url === 'string' && url.startsWith('http://')) {
    return 'https://' + url.slice(7);
  }
  return url;
}

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
    console.log('[ActionCoupon] 已创建集合：', name);
  } catch (e) {
    console.log('[ActionCoupon] 集合检查：', name, e && e.message);
  }
}

// upsert 封装
async function upsert(db, collName, query, payload) {
  const coll = db.collection(collName);
  const found = await coll.where(query).get();
  if (found && found.data && found.data.length) {
    const id = found.data[0]._id;
    await coll.doc(id).update({ data: payload });
    return { _id: id, updated: true };
  }
  const addRes = await coll.add({ data: payload });
  return { _id: addRes._id, created: true };
}

// 默认种子：与前端 pages/coupon/index.js 的读取字段兼容
function buildSeedItems(envId) {
  const prefix = `cloud://${envId}/Waddaeat/platform_actions`;
  // 用户指定的 Eleme 活动与跳转路径，图片按 eleme_活动名拼音 命名
  const items = [
    { actId: 10001, name: '快闪', imageCloudPath: `${prefix}/eleme_kuaishan.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'ele-recommend-price/pages/guest/index?scene=94708d979cde4231aea7197699d1d287' } } },
    { actId: 10002, name: '爆款特价', imageCloudPath: `${prefix}/eleme_baokuantejia.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'ad-bdlm-sub/pages/daily-special-price-foods-guide/index?scene=ac86a7c3f45a4621972d3858bf9e12de' } } },
    { actId: 10003, name: '爆火好店', imageCloudPath: `${prefix}/eleme_baohuohaodian.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'pages/sharePid/web/index?o2i_sharefrom=wxminiapp&scene=u.ele.me%2Fku5849lT' } } },
    { actId: 10004, name: '极限暴涨', imageCloudPath: `${prefix}/eleme_jixianbaozhang.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'pages/sharePid/web/index?o2i_sharefrom=wxminiapp&scene=u.ele.me%2F6QKQE2t3' } } },
    { actId: 10005, name: '天天领红包', imageCloudPath: `${prefix}/eleme_tiantianlinghongbao.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'commercialize/pages/taoke-guide/index?scene=bd978bfb20ee4f2c8ccb27ba1d1f8ede' } } },
    { actId: 10006, name: '超抢手', imageCloudPath: `${prefix}/eleme_chaoqiangshou.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'ad-bdlm-sub/pages/daily-special-price-foods-guide/index?scene=3333a8dcb92046fc99087848cef0d871' } } },
    { actId: 10007, name: '城市大额红包', imageCloudPath: `${prefix}/eleme_chengshidaehongbao.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'ad-bdlm-sub/pages/wh-coupon-guide/index?scene=9de4c78e23034247b484f3a692b3aa00' } } },
    { actId: 10008, name: '红包天天领不停', imageCloudPath: `${prefix}/eleme_hongbaotiantianlingbuting.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'ad-bdlm-sub/pages/wh-coupon-guide/index?scene=ff26056c83ee4e9b82945fa8d5361fb4' } } },
    { actId: 10009, name: '囤圈圈', imageCloudPath: `${prefix}/eleme_tunquanquan.png`, referralLinkMap: { 4: { appId: 'wxde8ac0a21135c07d', path: 'ad-bdlm-sub/pages/coupon-hoard-guide/index?scene=405a036e6a8744429bdcbb8de3e16b18' } } }
  ];
  return items;
}

exports.main = async (event, context) => {
  const db = cloud.database();
  await ensureCollection(db, 'ActionCoupon');

  // 允许通过 event.seedItems 覆盖默认种子
  let envId = '';
  try {
    const { env } = cloud.getWXContext();
    envId = env || '';
  } catch (e) {}
  const items = Array.isArray(event?.seedItems) && event.seedItems.length
    ? event.seedItems
    : buildSeedItems(envId || 'cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427');

  // 严格模式：删除集合中不属于预设 actId 的旧记录
  if (event && event.strict === true) {
    const allowedActIds = new Set(items.map(it => Number(it.actId)).filter(n => !!n && !Number.isNaN(n)));
    try {
      const coll = db.collection('ActionCoupon');
      let offset = 0;
      while (true) {
        const res = await coll.skip(offset).limit(20).get();
        const data = (res && Array.isArray(res.data)) ? res.data : [];
        if (!data.length) break;
        for (const doc of data) {
          const act = Number(doc.actId);
          if (!allowedActIds.has(act)) {
            try { await coll.doc(doc._id).remove(); } catch (eDel) { console.warn('[ActionCoupon] 删除旧记录失败', doc._id, eDel); }
          }
        }
        offset += data.length;
      }
      console.info('[ActionCoupon] 严格模式：已清理非预设 actId 的旧记录');
    } catch (eStrict) {
      console.warn('[ActionCoupon] 严格模式清理失败', eStrict);
    }
  }

  const results = [];
  for (const it of items) {
    /* eslint-disable no-await-in-loop */
    const actId = Number(it.actId);
    if (!actId || Number.isNaN(actId)) continue;
    const name = it.name || ('平台活动' + actId);
    let imageCloudPath = it.imageCloudPath || it.imageUrl || it.image || '';
    imageCloudPath = typeof imageCloudPath === 'string' && imageCloudPath.startsWith('http') ? imageCloudPath : imageCloudPath;
    const referralLinkMap = it.referralLinkMap || it.linkMap || {};
    // 规范化可能的 http 链接
    if (typeof imageCloudPath === 'string') imageCloudPath = normalizeHttps(imageCloudPath);

    const payload = {
      actId,
      name,
      imageCloudPath,
      referralLinkMap,
      updatedAt: new Date(),
      source: 'seed'
    };
    const res = await upsert(db, 'ActionCoupon', { actId }, payload);
    results.push({ actId, id: res._id, created: !!res.created, updated: !!res.updated });
    /* eslint-enable no-await-in-loop */
  }

  return { ok: true, total: results.length, results };
};