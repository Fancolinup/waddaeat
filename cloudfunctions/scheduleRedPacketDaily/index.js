// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const appKey = process.env.MEITUAN_APPKEY || event?.appKey || '';
  const secret = process.env.MEITUAN_SECRET || event?.secret || '';
  const platform = Number(event?.platform ?? 1);
  const onlyPending = event?.onlyPending !== undefined ? !!event.onlyPending : true;
  const maxRetries = typeof event?.maxRetries === 'number' ? event.maxRetries : 5;
  const delayMs = typeof event?.delayMs === 'number' ? event.delayMs : 8000;
  const limitBrandCount = typeof event?.limitBrandCount === 'number' ? event.limitBrandCount : undefined;
  const brandNames = Array.isArray(event?.brandNames) ? event.brandNames : undefined;

  try {
    const res = await cloud.callFunction({
      name: 'buildRedPacketCouponsWorker',
      data: {
        platform,
        onlyPending,
        maxRetries,
        delayMs,
        ...(limitBrandCount ? { limitBrandCount } : {}),
        ...(brandNames ? { brandNames } : {}),
        ...(appKey && secret ? { appKey, secret } : {})
      }
    });
    return { ok: true, task: 'daily', result: res?.result };
  } catch (e) {
    return { ok: false, error: { message: e.message } };
  }
};