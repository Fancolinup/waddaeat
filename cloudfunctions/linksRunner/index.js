// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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
const BRANDS = SEED_BRANDS.slice(0, 80);

async function ensureCollection(db, name) {
  try { await db.createCollection(name); } catch (e) {}
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const stateColl = db.collection('MeituanBrandDailyState');
  const limitSkuCount = (typeof event?.limitSkuCount === 'number' && event.limitSkuCount > 0) ? event.limitSkuCount : 5;

  await ensureCollection(db, 'MeituanBrandDailyState');

  // 初始化或读取状态
  let stateDoc;
  try {
    const docRes = await stateColl.doc('default').get();
    stateDoc = docRes && docRes.data ? docRes.data : null;
  } catch (e) {
    stateDoc = null;
  }
  if (!stateDoc) {
    stateDoc = { _id: 'default', couponsCursor: 0, linksCursor: 0, linksUnlocked: false, retryCounts: {}, updatedAt: Date.now() };
    try { await stateColl.add({ data: stateDoc }); } catch (e) {}
  }

  // 新逻辑：不再依赖 coupons gating，按需处理新商品

  const idx = Number(stateDoc.linksCursor || 0) % BRANDS.length;
  const brandName = BRANDS[idx];
  console.log('[linksRunner] 处理品牌：', brandName, ' idx=', idx);

  // 记录 pending 数量，用于决定是否推进游标
  let pendingCount = 0;

  // 检测当前品牌是否存在“未生成链接”的新商品
  try {
    const couponsColl = db.collection('MeituanBrandCoupon');
    const linksColl = db.collection('MeituanBrandCouponURL');
    const { data: existed } = await couponsColl.where({ brandName }).get();
    const doc = Array.isArray(existed) && existed.length > 0 ? existed[0] : null;
    const items = Array.isArray(doc?.items) ? doc.items : [];
    if (items.length === 0) {
      const update = { updatedAt: Date.now(), linksCursor: (idx + 1) % BRANDS.length };
      try {
        await stateColl.doc('default').update({ data: update });
      } catch (e) {
        await stateColl.add({ data: { _id: 'default', ...stateDoc, ...update } });
      }
      console.log('[linksRunner] 跳过品牌（无券或空items）：', brandName);
      return { ok: true, brandName, advanced: true, note: '跳过：当前品牌在DB无券或items为空' };
    }

    let existedLinks = [];
    try {
      const { data } = await linksColl.where({ brandName }).get();
      existedLinks = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[linksRunner] 查询已生成链接失败：', e && e.message);
    }
    const linkedSet = new Set(existedLinks.map(d => d.skuViewId));
    const pending = items.filter(it => it?.skuViewId && !linkedSet.has(it.skuViewId));

    if (pending.length === 0) {
      const update = { updatedAt: Date.now(), linksCursor: (idx + 1) % BRANDS.length };
      try {
        await stateColl.doc('default').update({ data: update });
      } catch (e) {
        await stateColl.add({ data: { _id: 'default', ...stateDoc, ...update } });
      }
      console.log('[linksRunner] 跳过品牌（无新的商品录入）：', brandName);
      return { ok: true, brandName, advanced: true, note: '跳过：该品牌暂无未生成链接的新商品' };
    }

    pendingCount = pending.length;
  } catch (e) {
    console.warn('[linksRunner] 新商品检测失败：', e && e.message);
  }

  // 调用单品牌 worker（仅处理未生成链接的 sku，最多5个）
  let ok = false;
  try {
    const res = await cloud.callFunction({
      name: 'fetchBrandLinksWorker',
      data: { brandName, limitSkuCount, onlyPending: true }
    });
    const result = res && res.result;
    ok = !!(result && result.ok);
    console.log('[linksRunner] worker 返回：', result);
  } catch (e) {
    console.warn('[linksRunner] worker 调用失败：', e && e.message);
  }

  // 更新游标/重试
  try {
    const update = { updatedAt: Date.now() };
    if (ok) {
      // 只要当前品牌仍有待处理的新商品，则继续停留在当前品牌；否则推进到下一个品牌
      if (pendingCount > 0) {
        update.linksCursor = idx; // 继续处理当前品牌，直到清零
      } else {
        update.linksCursor = (idx + 1) % BRANDS.length;
      }
      update.retryCounts = stateDoc.retryCounts || {};
      delete update.retryCounts[brandName];
    } else {
      const rc = Object.assign({}, stateDoc.retryCounts || {});
      rc[brandName] = (rc[brandName] || 0) + 1;
      if (rc[brandName] >= 3) {
        update.linksCursor = (idx + 1) % BRANDS.length;
        rc[brandName] = 0;
      } else {
        update.linksCursor = idx; // 保持不推进
      }
      update.retryCounts = rc;
    }
    try {
      await stateColl.doc('default').update({ data: update });
    } catch (e) {
      await stateColl.add({ data: { _id: 'default', ...stateDoc, ...update } });
    }
  } catch (e) {
    console.warn('[linksRunner] 更新游标失败：', e && e.message);
  }

  return { ok: true, brandName, advanced: !!ok };
};