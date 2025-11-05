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
    // 阶段一：拉取数据，仅入库商品，不生成链接
    const dataRes = await cloud.callFunction({
      name: 'buildRedPacketCouponsWorker',
      data: {
        platform,
        onlyPending: false,
        maxRetries: Math.min(maxRetries, 2),
        delayMs: Math.min(delayMs, 1000),
        ...(limitBrandCount ? { limitBrandCount } : {}),
        ...(brandNames ? { brandNames } : {}),
        ...(appKey && secret ? { appKey, secret } : {}),
        stage: 'data'
      }
    });

    // 阶段二：补链接，仅处理未生成链接的条目
    const linkRes = await cloud.callFunction({
      name: 'buildRedPacketCouponsWorker',
      data: {
        platform,
        onlyPending: true,
        maxRetries: Math.min(maxRetries, 2),
        delayMs: Math.min(delayMs, 1000),
        ...(limitBrandCount ? { limitBrandCount } : {}),
        ...(brandNames ? { brandNames } : {}),
        ...(appKey && secret ? { appKey, secret } : {}),
        stage: 'link'
      }
    });

    return { ok: true, task: 'daily', result: { data: dataRes?.result, link: linkRes?.result } };
  } catch (e) {
    return { ok: false, error: { message: e.message } };
  }
};