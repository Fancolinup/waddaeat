// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  const { url, method = 'GET', headers = {}, timeout = 8000 } = event || {}
  console.log('[getMeituanURL] Incoming:', { url, method, headers: Object.keys(headers || {}), timeout })
  if (!url || typeof url !== 'string') {
    console.warn('[getMeituanURL] INVALID_URL:', url)
    return { ok: false, error: { code: 'INVALID_URL', message: '缺少或非法的URL参数' } }
  }
  try {
    const resp = await axios({
      url,
      method,
      headers,
      timeout,
      maxRedirects: 5,
      validateStatus: () => true,
    })
    const finalUrl = (resp.request && resp.request.res && resp.request.res.responseUrl) || url
    console.log('[getMeituanURL] Response:', { status: resp.status, finalUrl })
    return {
      ok: true,
      status: resp.status,
      data: resp.data,
      headers: resp.headers,
      finalUrl,
    }
  } catch (err) {
    console.error('[getMeituanURL] NETWORK_ERROR:', { message: err.message, code: err.code })
    return { ok: false, error: { code: 'NETWORK_ERROR', message: err.message, stack: err.stack } }
  }
}