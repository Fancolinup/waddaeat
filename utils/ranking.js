/**
 * Ranking 模块：统一实现餐厅优先级队列、名称归一化、二级排序与回卷补足
 * - 优先级分组：高德+预选、 高德非预选、 预选非高德、 其他
 * - 同优先级组内二级排序：就它次数(accept) > 距离(近优先) > 评分 > 热度
 * - 回卷补足：若列表不足，使用完整餐厅数据（含用户添加）补齐
 * - 附近数据异常/为空时：回退到预设+用户添加的列表，并按优先级（非周围）处理
 */

const { getUserData, getCompleteRestaurantData } = require('./dataManager');
let pinyinMap = {};
try { pinyinMap = require('../restaurant_pinyin.js') || {}; } catch (_) { pinyinMap = {}; }

/** 优先级枚举（数值越小优先级越高） */
const PRIORITY_LEVELS = {
  AMAP_AND_PRESELECTED: 1,
  AMAP_NOT_PRESELECTED: 2,
  PRESELECTED_NOT_AMAP: 3,
  OTHERS: 4
};

/** 名称归一化：去除空格/符号，小写，优先使用拼音映射 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  const raw = name.trim();
  const mapped = pinyinMap && pinyinMap[raw] ? pinyinMap[raw] : raw;
  return String(mapped)
    .replace(/[\s\-_.·•]+/g, '')
    .replace(/＆|&/g, 'and')
    .toLowerCase();
}

/** 构建“就它”次数映射（仅统计 action === 'accept'） */
function buildAcceptCountMap(userData) {
  const map = {};
  try {
    const history = Array.isArray(userData && userData.decisionHistory) ? userData.decisionHistory : [];
    for (const r of history) {
      if (!r || r.action !== 'accept') continue;
      const id = String(r.id || '').trim();
      if (!id) continue;
      map[id] = (map[id] || 0) + 1;
    }
  } catch (e) {
    // 静默失败
  }
  return map;
}

/** 在完整餐厅数据中根据名称/品牌进行匹配（归一化对比） */
function matchRestaurantByName(amapName, existingRestaurants) {
  if (!amapName || !Array.isArray(existingRestaurants)) return null;
  const target = normalizeName(amapName);
  const byName = existingRestaurants.find(r => normalizeName(r.name || r.title || r.brand || '') === target);
  if (byName) return byName;
  // 包含关系（适配“品牌+门店名”等情况）
  const contains = existingRestaurants.find(r => {
    const nm = normalizeName(r.name || r.title || '');
    const br = normalizeName(r.brand || '');
    return nm.includes(target) || target.includes(nm) || br === target || target.includes(br);
  });
  return contains || null;
}

/** 计算优先级 */
function calculatePriority(isFromAmap, isPreselected) {
  if (isFromAmap && isPreselected) return PRIORITY_LEVELS.AMAP_AND_PRESELECTED;
  if (isFromAmap && !isPreselected) return PRIORITY_LEVELS.AMAP_NOT_PRESELECTED;
  if (!isFromAmap && isPreselected) return PRIORITY_LEVELS.PRESELECTED_NOT_AMAP;
  return PRIORITY_LEVELS.OTHERS;
}

/** 标准化餐厅对象（页面 updateWheelWithLocationData 兼容字段） */
/**
 * 生成基于餐厅名称和地址的稳定哈希ID
 * @param {string} name 餐厅名称
 * @param {string} address 餐厅地址
 * @returns {string} 稳定的哈希ID
 */
function generateStableAmapId(name, address = '') {
  if (!name) return `amap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 结合名称和地址生成更唯一的标识
  const uniqueKey = `${name}_${address || ''}`;
  
  // 简单哈希函数，为同一餐厅名称+地址生成相同的ID
  let hash = 0;
  for (let i = 0; i < uniqueKey.length; i++) {
    const char = uniqueKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  // 确保哈希值为正数并转换为36进制
  const hashStr = Math.abs(hash).toString(36);
  return `amap_${hashStr}`;
}

function toStandardRestaurant(base, matched, opts = {}) {
  const { isFromAmap = false, preselectedIds = [], acceptCountMap = {} } = opts;
  const id = matched ? String(matched.id) : (base.id || generateStableAmapId(base.name, base.address));
  const isPreselected = preselectedIds.includes(id);
  const rating = (matched && typeof matched.rating === 'number') ? matched.rating : (typeof base.rating === 'number' ? base.rating : 0);
  const popularity = (matched && typeof matched.popularityScore === 'number') ? matched.popularityScore : (typeof base.popularityScore === 'number' ? base.popularityScore : 0);
  const acceptCount = acceptCountMap[id] || 0;
  return {
    id,
    name: base.name || (matched && matched.name) || '',
    type: 'restaurant',
    brand: matched ? (matched.brand || null) : null,
    category: base.category || (matched && matched.category) || '餐厅',
    distance: typeof base.distance === 'number' ? base.distance : null,
    isFromAmap,
    isPreselected,
    rating,
    popularityScore: popularity,
    acceptCount,
    amapData: isFromAmap ? {
      latitude: base.latitude,
      longitude: base.longitude,
      address: base.address,
      original: base
    } : undefined,
    priority: calculatePriority(isFromAmap, isPreselected)
  };
}

/** 获取用户预选餐厅ID（欢迎页选择 + 品牌选择映射到餐厅） */
function getUserPreselectedIds(allRestaurants) {
  try {
    const userData = getUserData();
    const ids = Array.isArray(userData.welcomeSelections) ? [...userData.welcomeSelections] : [];
    const byBrand = Array.isArray(userData.welcomeSelectionsByBrand) ? userData.welcomeSelectionsByBrand : [];
    for (const brand of byBrand) {
      const hits = allRestaurants.filter(r => (r.brand || '') === brand);
      for (const r of hits) { ids.push(String(r.id)); }
    }
    return Array.from(new Set(ids));
  } catch (e) {
    return [];
  }
}

/** 二级排序比较器（按就它次数 > 距离(近优) > 评分 > 热度） */
function buildComparator(acceptCountMap) {
  const getAccept = (id) => acceptCountMap[id] || 0;
  return function cmp(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority; // 低优先级数值在后
    const aAcc = getAccept(String(a.id));
    const bAcc = getAccept(String(b.id));
    if (aAcc !== bAcc) return bAcc - aAcc; // accept 次数多的排前
    const aDist = (typeof a.distance === 'number') ? a.distance : Number.POSITIVE_INFINITY;
    const bDist = (typeof b.distance === 'number') ? b.distance : Number.POSITIVE_INFINITY;
    if (aDist !== bDist) return aDist - bDist; // 距离近的排前
    const aRating = (typeof a.rating === 'number') ? a.rating : 0;
    const bRating = (typeof b.rating === 'number') ? b.rating : 0;
    if (aRating !== bRating) return bRating - aRating; // 评分高的排前
    const aPop = (typeof a.popularityScore === 'number') ? a.popularityScore : 0;
    const bPop = (typeof b.popularityScore === 'number') ? b.popularityScore : 0;
    if (aPop !== bPop) return bPop - aPop; // 热度高的排前
    // 最终稳定性：按归一化名称字母序
    const an = normalizeName(a.name || '');
    const bn = normalizeName(b.name || '');
    return an.localeCompare(bn);
  };
}

/**
 * 优先级排序主入口
 * @param {Array} amapRestaurants 高德/附近返回的餐厅（可为空）
 * @param {number} maxCount 返回数量上限（默认12）
 * @returns {Array} 排序后的标准餐厅对象数组
 */
/** 获取饮品品牌名称集合（归一化后） */
function getBeverageNameSet() {
  try {
    const beverage = require('../data/beverage.js');
    const brands = Array.isArray(beverage && beverage.beverage_brands) ? beverage.beverage_brands : [];
    const names = brands.map(b => normalizeName(b.name)).filter(Boolean);
    return new Set(names);
  } catch (e) {
    return new Set();
  }
}

/** 在两个高德候选之间选择更优（评分高优先；若评分相同距离近优先；再看热度） */
function pickBetterAmap(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ar = (typeof a.rating === 'number') ? a.rating : 0;
  const br = (typeof b.rating === 'number') ? b.rating : 0;
  if (ar !== br) return ar > br ? a : b;
  const ad = (typeof a.distance === 'number') ? a.distance : Number.POSITIVE_INFINITY;
  const bd = (typeof b.distance === 'number') ? b.distance : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad < bd ? a : b;
  const ap = (typeof a.popularityScore === 'number') ? a.popularityScore : 0;
  const bp = (typeof b.popularityScore === 'number') ? b.popularityScore : 0;
  if (ap !== bp) return ap > bp ? a : b;
  return a;
}

function prioritizeRestaurants(amapRestaurants = [], maxCount = 12) {
  try {
    const data = getCompleteRestaurantData();
    const allRestaurants = Array.isArray(data && data.restaurants) ? data.restaurants : [];
    const userData = getUserData();
    const preselectedIds = getUserPreselectedIds(allRestaurants);
    const acceptCountMap = buildAcceptCountMap(userData);

    const beverageSet = getBeverageNameSet();
    const out = [];
    const processed = new Set(); // 已按ID处理的静态餐厅
    const nameProcessed = new Set(); // 已按归一化名称处理的所有餐厅

    // 1) 高德返回的餐厅：先过滤饮品品牌同名；按名称去重保留更优项
    const amapDedupMap = new Map(); // key: 归一化名称 -> 最优Amap对象
    if (Array.isArray(amapRestaurants) && amapRestaurants.length) {
      for (const a of amapRestaurants) {
        const an = normalizeName(a && a.name);
        if (!an) continue;
        // 丢弃与饮品品牌同名的高德餐厅
        if (beverageSet.has(an)) continue;
        const prev = amapDedupMap.get(an);
        amapDedupMap.set(an, pickBetterAmap(prev, a));
      }
    }
    const amapNamesSet = new Set(amapDedupMap.keys());
    for (const [an, a] of amapDedupMap.entries()) {
      const matched = matchRestaurantByName(a.name, allRestaurants);
      const std = toStandardRestaurant(a, matched, { isFromAmap: true, preselectedIds, acceptCountMap });
      const sn = normalizeName(std.name);
      if (nameProcessed.has(sn)) continue; // 全局按名称去重
      out.push(std);
      nameProcessed.add(sn);
      if (matched) processed.add(String(matched.id));
    }

    // 2) 预选但不在高德结果中的餐厅（若名称与高德同名则跳过，仅展示高德）
    for (const rid of preselectedIds) {
      if (processed.has(String(rid))) continue; // 已被高德同名匹配的预选餐厅
      const matched = allRestaurants.find(r => String(r.id) === String(rid));
      if (!matched) continue;
      const mn = normalizeName(matched.name || matched.title);
      if (amapNamesSet.has(mn)) continue; // 规则1：预设与高德同名，保留高德，丢弃预设
      if (nameProcessed.has(mn)) continue; // 全局名称去重
      const std = toStandardRestaurant({ name: matched.name }, matched, { isFromAmap: false, preselectedIds, acceptCountMap });
      out.push(std);
      nameProcessed.add(mn);
      processed.add(String(rid));
    }

    // 3) 回卷补足：若数量不足，使用剩余静态+用户添加补齐（仍需按名称去重）
    if (out.length < maxCount) {
      const remain = maxCount - out.length;
      const others = allRestaurants.filter(r => !processed.has(String(r.id))).slice(0, remain * 2); // 取多一点再按名称过滤
      for (const r of others) {
        const rn = normalizeName(r.name || r.title);
        if (!rn || nameProcessed.has(rn)) continue;
        // 若与高德同名也跳过，优先展示高德
        if (amapNamesSet.has(rn)) continue;
        const std = toStandardRestaurant({ name: r.name }, r, { isFromAmap: false, preselectedIds, acceptCountMap });
        out.push(std);
        nameProcessed.add(rn);
        processed.add(String(r.id));
        if (out.length >= maxCount) break;
      }
    }

    // 同优先级二级排序
    const cmp = buildComparator(acceptCountMap);
    out.sort(cmp);

    return out.slice(0, maxCount);
  } catch (e) {
    // 回退：无附近数据或异常，返回全局列表（含用户添加），同优先级按二级规则排序
    try {
      const data = getCompleteRestaurantData();
      const allRestaurants = Array.isArray(data && data.restaurants) ? data.restaurants : [];
      const userData = getUserData();
      const preselectedIds = getUserPreselectedIds(allRestaurants);
      const acceptCountMap = buildAcceptCountMap(userData);
      const nameProcessed = new Set();

      const out = [];
      const processed = new Set();

      for (const rid of preselectedIds) {
        const matched = allRestaurants.find(r => String(r.id) === String(rid));
        if (!matched) continue;
        const mn = normalizeName(matched.name || matched.title);
        if (nameProcessed.has(mn)) continue;
        const std = toStandardRestaurant({ name: matched.name }, matched, { isFromAmap: false, preselectedIds, acceptCountMap });
        out.push(std);
        nameProcessed.add(mn);
        processed.add(String(rid));
      }

      const others = allRestaurants.filter(r => !processed.has(String(r.id)));
      for (const r of others) {
        const rn = normalizeName(r.name || r.title);
        if (nameProcessed.has(rn)) continue;
        const std = toStandardRestaurant({ name: r.name }, r, { isFromAmap: false, preselectedIds, acceptCountMap });
        out.push(std);
        nameProcessed.add(rn);
      }

      const cmp = buildComparator(acceptCountMap);
      out.sort(cmp);
      return out.slice(0, 12);
    } catch (_) {
      return [];
    }
  }
}

/** 可选：保持与旧服务兼容的接口 */
async function getLocationBasedRecommendations(userLocation, maxCount = 12) {
  try {
    const locationService = require('./locationService');
    const nearby = await locationService.searchNearbyRestaurants(userLocation);
    return prioritizeRestaurants(nearby, maxCount);
  } catch (e) {
    return prioritizeRestaurants([], maxCount);
  }
}

module.exports = {
  PRIORITY_LEVELS,
  normalizeName,
  matchRestaurantByName,
  prioritizeRestaurants,
  getLocationBasedRecommendations
};