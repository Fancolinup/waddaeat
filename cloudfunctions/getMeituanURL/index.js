// 云函数：简单网络连通性校验或直连探测
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const url = (event && event.url) ? String(event.url) : 'https://www.meituan.com/';
  const timeoutMs = (event && event.timeoutMs) ? Number(event.timeoutMs) : 5000;
  try {
    const resp = await axios.get(url, { timeout: timeoutMs, validateStatus: () => true });
    return {
      ok: true,
      status: resp.status,
      headers: resp.headers,
      url,
      ts: Date.now(),
    };
  } catch (e) {
    return {
      ok: false,
      error: { message: e && e.message },
      url,
      ts: Date.now(),
    };
  }
};