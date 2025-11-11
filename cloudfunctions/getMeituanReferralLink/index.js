// 云函数入口文件
const cloud = require('wx-server-sdk');
const axios = require('axios');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 生成 Content-MD5（Base64(MD5(body)))
function computeContentMD5(bodyStr) {
  const md5 = crypto.createHash('md5').update(bodyStr, 'utf8').digest();
  return md5.toString('base64');
}

// 严格对齐 getMeituanCoupon 的 S-Ca 签名生成
function buildSCaSignature({ method, urlPath, contentMD5, appKey, timestamp, secret }) {
  const signHeadersObj = {
    'S-Ca-App': appKey,
    'S-Ca-Timestamp': timestamp,
    'S-Ca-Signature-Headers': 'S-Ca-App,S-Ca-Timestamp',
    'Content-MD5': contentMD5,
  };
  const sortedKeys = Object.keys(signHeadersObj).sort();
  const signedHeaderLines = sortedKeys
    .filter(k => k !== 'S-Ca-Signature-Headers' && k !== 'Content-MD5')
    .map(k => `${k}:${signHeadersObj[k] ?? ''}`)
    .join('\n');

  const stringToSign = [
    method.toUpperCase(),
    contentMD5 || '',
    signedHeaderLines,
    urlPath,
  ].join('\n');

  try {
    console.log('[Referral] SignedHeaderLines:', signedHeaderLines);
    console.log('[Referral] StringToSign:', stringToSign);
  } catch (e) {}

  return crypto.createHmac('sha256', secret).update(stringToSign, 'utf8').digest('base64');
}

function normalizeHttps(url) {
  if (typeof url === 'string' && url.startsWith('http://')) {
    return 'https://' + url.slice(7);
  }
  return url;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function pickWeappFromData(data) {
  // 兼容第三方/官方返回结构：优先使用 we_app_info
  try {
    const we = data?.we_app_info;
    const appId = we?.app_id || we?.appId || we?.appid;
    const pagePath = we?.page_path || we?.pagePath || we?.path;
    if (appId && pagePath) {
      return { appId, path: pagePath };
    }
  } catch (e) {}
  // 兼容对象型 weapp/micro fields
  try {
    const weapp = data?.weapp || data?.mini || data?.miniProgram || data?.mini_program;
    const appId = weapp?.appId || weapp?.app_id || weapp?.appid || weapp?.id;
    const path = weapp?.path || weapp?.page_path || weapp?.pagePath || weapp?.miniProgramPath || weapp?.weappPath;
    if (appId && path) {
      return { appId, path };
    }
  } catch (e2) {}
  return null;
}

async function callMeituanReferralAPI({ body, appKey, secret, timeoutMs, attemptUrl, method = 'POST' }) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const contentMD5 = method.toUpperCase() === 'POST' ? computeContentMD5(bodyStr) : '';
  const timestamp = Date.now().toString();
  let urlPath = attemptUrl;
  try {
    const u = new URL(attemptUrl);
    urlPath = `${u.pathname}${u.search || ''}`;
  } catch (e) {
    // fallback for environments without URL
    urlPath = attemptUrl.replace('https://media.meituan.com', '');
  }
  const headers = {
    'Content-Type': 'application/json;charset=utf-8',
    ...(contentMD5 ? { 'Content-MD5': contentMD5 } : {}),
    'S-Ca-App': appKey,
    'S-Ca-Timestamp': timestamp,
    'S-Ca-Signature-Method': 'HmacSHA256',
    'S-Ca-Signature-Headers': 'S-Ca-App,S-Ca-Timestamp',
    'S-Ca-Signature': buildSCaSignature({ method, urlPath, contentMD5, appKey, timestamp, secret })
  };
  console.log('[Referral] Request URL:', attemptUrl);
  console.log('[Referral] Request Method:', method);
  console.log('[Referral] Request Headers (masked):', {
    ...headers,
    'S-Ca-App': appKey ? `${appKey.slice(0, 6)}***${appKey.slice(-4)}` : '',
    'S-Ca-Signature': headers['S-Ca-Signature'] ? '<computed>' : '<empty>'
  });
  console.log('[Referral] Request Path For Sign:', urlPath);
  console.log('[Referral] Request Body:', body);
  const resp = await axios.request({ method, url: attemptUrl, data: bodyStr, headers, timeout: timeoutMs });
  console.log('[Referral] Response Status:', resp.status);
  console.log('[Referral] Response Headers:', resp.headers);
  console.log('[Referral] Response Data:', resp.data);
  return resp;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const db = cloud.database();

  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';

  const linkTypeListRaw = event?.linkTypeList;
  let linkTypeList = Array.isArray(linkTypeListRaw)
    ? linkTypeListRaw.map(v => Number(v)).filter(v => !Number.isNaN(v))
    : (typeof linkTypeListRaw === 'string'
        ? linkTypeListRaw.split(',').map(s => Number(s.trim())).filter(v => !Number.isNaN(v))
        : [3, 4]);
  const fastMode = !!event?.fastMode;
  if (!Array.isArray(linkTypeList) || !linkTypeList.length) linkTypeList = [3, 4];
  if (fastMode) linkTypeList = [4];

  const skuViewId = (event?.skuViewId || '').toString().trim();
  const actId = (event?.actId || '').toString().trim();

  const maxRetries = typeof event?.maxRetries === 'number' ? event.maxRetries : (fastMode ? 1 : 3);
  const delayMs = 500;
  const timeoutMs = typeof event?.timeoutMs === 'number' ? event.timeoutMs : 2900;
  // Debug: print effective settings for troubleshooting
  try {
    console.log('[Referral] Effective Settings:', {
      fastMode,
      linkTypeList,
      maxRetries,
      delayMs,
      timeoutMs,
      method: typeof event?.method === 'string' ? event.method.toUpperCase() : 'POST'
    });
  } catch (e) {}

  // 若缺少秘钥，直接返回错误（与 getMeituanCoupon 保持一致）
  if (!appKey || !secret) {
    // 尝试 DB 兜底：仅供前端回退使用
    try {
      const referralLinkMap = await tryDbFallback(db, { skuViewId, actId });
      if (Object.keys(referralLinkMap).length) {
        return { ok: true, data: { referralLinkMap } };
      }
    } catch (eDb) {}
    return { ok: false, error: { message: 'Missing MEITUAN_APPKEY/MEITUAN_SECRET' } };
  }

  // 主调用：猜测/兼容多种开放平台路径（不同环境可能存在差异），逐个尝试
  const attemptUrls = fastMode
    ? ['https://media.meituan.com/cps_open/common/api/v1/get_referral_link']
    : [
      'https://media.meituan.com/cps_open/common/api/v1/get_referral_link',
      'https://media.meituan.com/cps_open/common/api/v1/query_referral_link'
    ];
  if (Array.isArray(event?.attemptUrls) && event.attemptUrls.length) {
    try {
      attemptUrls = event.attemptUrls.filter(u => typeof u === 'string' && /^https?:\/\//.test(u));
    } catch (e) {}
  } else if (typeof event?.url === 'string' && /^https?:\/\//.test(event.url)) {
    attemptUrls = [event.url];
  }
  try {
    console.log('[Referral] Attempt URLs:', attemptUrls);
  } catch (e) {}

  // 构造请求体：支持 skuViewId 或 actId 两种入参形式（fastMode 下仅包含必要字段）
  const baseBody = fastMode
    ? { linkTypeList }
    : {
        linkTypeList,
        ...(typeof event?.latitude === 'number' ? { latitude: event.latitude } : {}),
        ...(typeof event?.longitude === 'number' ? { longitude: event.longitude } : {}),
        ...(typeof event?.cityId === 'number' ? { cityId: event.cityId } : {}),
      };
  let body = skuViewId ? { ...baseBody, skuViewId } : (actId ? { ...baseBody, actId } : baseBody);
  if (event?.manualBody) {
    if (typeof event.manualBody === 'string') {
      try { body = event.manualBody; } catch (e) { console.warn('[Referral] manualBody string provided but not parsed'); }
    } else if (typeof event.manualBody === 'object') {
      body = event.manualBody;
    }
  }
  const method = typeof event?.method === 'string' ? event.method.toUpperCase() : 'POST';

  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const url of attemptUrls) {
      try {
        const resp = await callMeituanReferralAPI({ body, appKey, secret, timeoutMs, attemptUrl: url, method });
        const dataRoot = resp?.data || {};
        // 官方/第三方常见结构：{ code, data } 或直接为对象
        const data = (dataRoot && typeof dataRoot === 'object' && dataRoot.data && typeof dataRoot.data === 'object') ? dataRoot.data : dataRoot;

        // 直接返回 referralLinkMap（若服务端已生成）
        if (data?.referralLinkMap && typeof data.referralLinkMap === 'object') {
          const map = data.referralLinkMap;
          return { ok: true, data: { referralLinkMap: map } };
        }

        // 兼容 we_app_info 与 deeplink 等字段，组装成统一 referralLinkMap
        const map = {};
        const mini = pickWeappFromData(data);
        if (mini) {
          map['4'] = { appId: mini.appId, path: mini.path };
        }
        const deeplink = typeof data?.deeplink === 'string' ? data.deeplink : '';
        if (deeplink) {
          map['3'] = deeplink;
        }
        // 兼容 h5/h5_evoke/short_h5 等字段（前端目前未用，这里仅保留）
        if (Object.keys(map).length > 0) {
          return { ok: true, data: { referralLinkMap: map } };
        }

        // 若响应无期望字段则继续尝试下一个路径
      } catch (err) {
        lastErr = err;
        console.warn('[Referral] Attempt failed:', attempt, url, {
          message: err?.message,
          code: err?.code,
          status: err?.response && err.response.status,
          data: err?.response && err.response.data
        });
      }
    }
    if (attempt < maxRetries) await sleep(delayMs);
  }

  // API 均失败时：先尝试 DB 兜底，再构造通用 runion 小程序跳转（保证前端可用）
  if (!fastMode) {
    try {
      const referralLinkMap = await tryDbFallback(db, { skuViewId, actId });
      if (Object.keys(referralLinkMap).length) {
        return { ok: true, data: { referralLinkMap } };
      }
    } catch (eDb2) {}

    try {
      const sid = (event?.sid || (wxContext?.OPENID ? `wx_${wxContext.OPENID.slice(-8)}` : 'wx_sid')).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50);
      const baseUrl = 'https://i.meituan.com/';
      const runion = `https://runion.meituan.com/url?key=${encodeURIComponent(appKey)}&url=${encodeURIComponent(baseUrl)}&sid=${encodeURIComponent(sid)}`;
      const pagePath = `/index/pages/h5/h5?weburl=${encodeURIComponent(runion)}`;
      const map = { '4': { appId: 'wxde8ac0a21135c07d', path: pagePath } };
      return { ok: true, data: { referralLinkMap: map, fallback: true } };
    } catch (eFallback) {}
  }

  // 仍失败时返回错误
  return {
    ok: false,
    error: {
      message: lastErr && lastErr.message,
      code: lastErr && lastErr.code,
      status: lastErr && lastErr.response && lastErr.response.status,
      data: lastErr && lastErr.response && lastErr.response.data
    }
  };
};

async function tryDbFallback(db, { skuViewId, actId }) {
  const map = {};
  try {
    if (skuViewId) {
      // 1) 品牌URL集合（urlMap 以 skuViewId 为键）
      try {
        const collBrandUrl = db.collection('MeituanBrandCouponURL');
        const batch = await collBrandUrl.get();
        const docs = Array.isArray(batch?.data) ? batch.data : [];
        for (const d of docs) {
          const urlMap = (d?.urlMap && typeof d.urlMap === 'object') ? d.urlMap : {};
          if (urlMap[skuViewId]) { map['4'] = urlMap[skuViewId]['4'] || urlMap[skuViewId]; break; }
          const refMap = (d?.referralLinkMap && typeof d.referralLinkMap === 'object') ? d.referralLinkMap : {};
          if (refMap['4']) { map['4'] = refMap['4']; break; }
        }
      } catch (e1) {}
      // 2) 到店URL集合（按 skuViewId 存储 linkMap）
      if (!map['4']) {
        try {
          const collOnsiteUrl = db.collection('MeituanOnsiteCouponURL');
          const found = await collOnsiteUrl.where({ skuViewId }).limit(1).get();
          const d = found?.data?.[0];
          const lm = (d?.linkMap && typeof d.linkMap === 'object') ? d.linkMap : {};
          if (lm['4']) map['4'] = lm['4'];
          const rm = (d?.referralLinkMap && typeof d.referralLinkMap === 'object') ? d.referralLinkMap : {};
          if (!map['4'] && rm['4']) map['4'] = rm['4'];
        } catch (e2) {}
      }
    }
    if (actId && !map['4']) {
      try {
        const collBanner = db.collection('MeituanPlatformBanner');
        const found = await collBanner.where({ actId: Number(actId) }).limit(1).get();
        const d = found?.data?.[0];
        const rm = (d?.referralLinkMap && typeof d.referralLinkMap === 'object') ? d.referralLinkMap : {};
        if (rm['4']) map['4'] = rm['4'];
      } catch (e3) {}
    }
  } catch (e) {}
  return map;
}