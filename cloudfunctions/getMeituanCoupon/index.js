// 云函数入口文件
const cloud = require('wx-server-sdk');
const axios = require('axios');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

// 生成 Content-MD5（Base64(MD5(body)))
function computeContentMD5(bodyStr) {
  const md5 = crypto.createHash('md5').update(bodyStr, 'utf8').digest();
  return md5.toString('base64');
}

// 严格对齐官方 Demo 的 S-Ca 签名生成
function buildSCaSignature({ method, urlPath, contentMD5, appKey, timestamp, secret }) {
  // 仅将 S-Ca-App 与 S-Ca-Timestamp 作为参与签名的 Header 行；同时提供 Content-MD5 与 S-Ca-Signature-Headers 但不参与 Header 行拼接
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
    console.log('[Meituan] SignedHeaderLines:', signedHeaderLines);
    console.log('[Meituan] StringToSign:', stringToSign);
  } catch (e) {}

  return crypto.createHmac('sha256', secret).update(stringToSign, 'utf8').digest('base64');
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  // 安全：优先从环境变量读取，允许从入参传入（便于开发测试）。不要日志打印秘钥。
  const appKey = process.env.MEITUAN_APPKEY || event.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event.secret || '';

  if (!appKey || !secret) {
    return { ok: false, error: { message: 'Missing MEITUAN_APPKEY/MEITUAN_SECRET' } };
  }
  const platform = Number(event.platform ?? 1);
  const bizLine = (event.bizLine ?? '');
  const searchText = (event.searchText ?? '麦当劳');
  // 经纬度：默认人民广场（可通过调用传入覆盖）
  const latitude = typeof event.latitude === 'number' ? event.latitude : 31.23136;
  const longitude = typeof event.longitude === 'number' ? event.longitude : 121.47004;

  const url = 'https://media.meituan.com/cps_open/common/api/v1/query_coupon';
  const urlPath = '/cps_open/common/api/v1/query_coupon';

  const reqBody = {
    platform,
    // bizLine 不填则不传
    ...(bizLine ? { bizLine } : {}),
    latitude,
    longitude,
    searchText
  };

  const bodyStr = JSON.stringify(reqBody);
  const contentMD5 = computeContentMD5(bodyStr);
  const timestamp = Date.now().toString();
  const contentType = 'application/json;charset=utf-8';
  const accept = 'application/json';
  const nonce = `${timestamp}-${Math.random().toString(36).slice(2)}`;

  // 准备参与签名的头列表（原始大小写，按字典序）
  const signatureHeaderKeys = ['S-Ca-App', 'S-Ca-Timestamp', 'S-Ca-Nonce'];
  // S-Ca-Signature-Headers 必须为官方 Demo 的固定值
  const signatureHeaders = 'S-Ca-App,S-Ca-Timestamp';
  const signature = (appKey && secret)
    ? buildSCaSignature({
        method: 'POST',
        urlPath,
        contentMD5,
        appKey,
        timestamp,
        secret,
      })
    : '';

  const headers = {
    // 不参与签名，但实际请求需要的基础头
    'Content-Type': contentType,
    'Content-MD5': contentMD5,
    // 参与签名的自定义头及相关声明
    'S-Ca-App': appKey,
    'S-Ca-Timestamp': timestamp,
    'S-Ca-Signature-Method': 'HmacSHA256',
    'S-Ca-Signature-Headers': signatureHeaders,
    ...(signature ? { 'S-Ca-Signature': signature } : {}),
  };

  // 日志：不打印秘钥，仅打印必要信息
  console.log('[Meituan] Request URL:', url);
  console.log('[Meituan] Request Headers (masked):', {
    ...headers,
    'S-Ca-App': appKey ? `${appKey.slice(0, 6)}***${appKey.slice(-4)}` : '',
    'S-Ca-Signature': headers['S-Ca-Signature'] ? '<computed>' : '<empty>'
  });
  console.log('[Meituan] Request Body:', reqBody);

  // 自动重试：每10秒一次，最多5次（支持入参覆盖）
  const maxRetries = typeof event?.maxRetries === 'number' ? event.maxRetries : 3;
  const delayMs = typeof event?.delayMs === 'number' ? event.delayMs : 2000;
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const resp = await axios.post(url, bodyStr, { headers, timeout: 5000 });
        console.log('[Meituan] Response Status:', resp.status, 'attempt=', attempt);
        console.log('[Meituan] Response Headers:', resp.headers);
        console.log('[Meituan] Response Data:', resp.data);

        return {
          ok: true,
          code: resp.status,
          data: resp.data,
          headers: resp.headers
        };
      } catch (err) {
        lastErr = err;
        console.warn('[Meituan] Attempt failed:', attempt, {
          message: err.message,
          code: err.code,
          responseStatus: err.response && err.response.status,
          responseData: err.response && err.response.data
        });
        if (attempt < maxRetries) {
          await sleep(delayMs);
        }
      }
    }

  // 所有重试失败后返回错误
    console.error('[Meituan] All retries failed');
    return {
      ok: false,
      error: {
        message: lastErr && lastErr.message,
        code: lastErr && lastErr.code,
        status: lastErr && lastErr.response && lastErr.response.status,
        data: lastErr && lastErr.response && lastErr.response.data
      }
    };
  } catch (err) {
    // 打印详细错误，便于排查签名/参数问题
    console.error('[Meituan] Request Failed:', {
      message: err.message,
      code: err.code,
      responseStatus: err.response && err.response.status,
      responseData: err.response && err.response.data,
      responseHeaders: err.response && err.response.headers
    });
    return {
      ok: false,
      error: {
        message: err.message,
        code: err.code,
        status: err.response && err.response.status,
        data: err.response && err.response.data
      }
    };
  }
};