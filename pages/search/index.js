// pages/search/index.js
const meituanCityMap = require('../../utils/meituanCityMap');
Page({
  data: {
    inputText: '',
    results: [],
    autoFocus: false,
    searchLinkLoading: false
  },
  onShow() {
    // 返回页面后不自动调起输入法
    wx.nextTick(() => this.setData({ autoFocus: false }));
  },
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  async onConfirm() {
    try {
      const q = (this.data.inputText || '').trim();
      if (!q) { wx.showToast({ title: '请输入关键词', icon: 'none' }); return; }
      wx.showLoading({ title: '搜索中', mask: true });
      // 读取用户位置（若无则依赖云函数默认值），并计算 cityId
      const loc = wx.getStorageSync('userLocation') || {};
      const lat = (loc && typeof loc.latitude === 'number') ? loc.latitude : undefined;
      const lng = (loc && typeof loc.longitude === 'number') ? loc.longitude : undefined;
      const cityId = (() => {
        const adcode = String(loc?.adcode || '').trim();
        const cityName = String(loc?.cityName || '').trim();
        if (adcode && meituanCityMap?.adcodeToId?.[adcode]) return meituanCityMap.adcodeToId[adcode];
        if (cityName && meituanCityMap?.nameToId?.[cityName]) return meituanCityMap.nameToId[cityName];
        return meituanCityMap?.nameToId?.['上海市'] || meituanCityMap?.nameToId?.['上海'] || 310100;
      })();

      // 调用云函数获取商品列表（按期望流程）
      const res = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { searchText: q, cityId, latitude: lat, longitude: lng } });
      const result = res && res.result;
      const items = Array.isArray(result?.data?.data) ? result.data.data : (Array.isArray(result?.data) ? result.data : []);
      console.debug('[search] getMeituanCoupon items count:', items.length);

      // 映射商品为卡片数据，过滤无 skuViewId 的条目
      const products = items.map(it => {
        const brandName = it?.brandInfo?.brandName || '';
        const name = it?.couponPackDetail?.name || '';
        const skuViewId = it?.couponPackDetail?.skuViewId || it?.skuViewId || '';
        const headUrlRaw = it?.couponPackDetail?.headUrl || '';
        const headUrl = cloudImageManager.ensureHttps(headUrlRaw) || cloudImageManager.getPlaceholderUrlSync();
        const originalPrice = it?.couponPackDetail?.originalPrice || 0;
        const sellPrice = it?.couponPackDetail?.sellPrice || 0;
        const label1 = it?.productLabel?.historyPriceLabel || it?.productLabel?.beatMTLabel || '';
        const actId = it?.couponPackDetail?.actId || '';
        return { _id: skuViewId || `${brandName}-${name}`, name, brandName, headUrl, sellPrice, originalPrice, label1, skuViewId, actId, referralLinkMap: {} };
      }).filter(x => x.skuViewId);
      console.debug('[search] mapped products count (with skuViewId):', products.length);

      // 仅当商品数据和推广链接都获取到后才展示卡片；逐条展示一个一个上屏
      if (!products.length) {
        wx.showToast({ title: '无结果', icon: 'none' });
        this.setData({ results: [], searchLinkLoading: false });
        wx.hideLoading();
      } else {
        // 清空结果，进入逐条补链展示流程，并将搜索按钮置为加载中
        this.setData({ results: [], searchLinkLoading: true });
        wx.hideLoading();
        for (const it of products) {
          try {
            // 显式传入 delayMs: 500，且仅请求小程序推广链接 linkTypeList: [4]
            const req = { skuViewId: String(it.skuViewId), linkTypeList: [4], delayMs: 500 };
            console.info('[search][referral][request]', req);
            const r = await wx.cloud.callFunction({ name: 'getMeituanReferralLink', data: req });
            console.info('[search][referral][response]', r && r.result);
            const root = r?.result?.data || r?.result || {};
            const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;
            const map = dataRoot?.referralLinkMap || {};
            // 仅在获取到推广链接后展示该商品卡片
            const weapp = map['4'] || map[4];
            if (!weapp) {
              console.warn('[search][referral] 无可用小程序链接，跳过展示', { skuViewId: it.skuViewId, keys: Object.keys(map || {}) });
              continue;
            }
            const list = Array.isArray(this.data.results) ? this.data.results.slice() : [];
            list.push({ ...it, referralLinkMap: map });
            this.setData({ results: list });
          } catch (e) {
            console.warn('[search][referral][error]', { skuViewId: it.skuViewId, error: e });
            // 不阻塞其他项，继续逐条尝试
          }
        }
+        // 所有补链完成，恢复搜索按钮
+        this.setData({ searchLinkLoading: false });
      }
    } catch (err) {
      console.warn('[search] 搜索失败：', err);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  async onResultTap(e) {
    try {
      console.info('[search][click] 用户点击商品卡片', e);
      const id = e.currentTarget?.dataset?.id;
      console.debug('[search][click] tap id:', id);
      const list = Array.isArray(this.data.results) ? this.data.results : [];
      const item = list.find(x => String(x.skuViewId) === String(id) || String(x._id) === String(id)) || {};
      console.debug('[search][click] selected item:', item);
+      // 跳转前确保返回后不自动调起输入法
+      this.setData({ autoFocus: false });
      const map = item.referralLinkMap || {};
      const skuViewId = String(item?.skuViewId || '');
      const actId = String(item?.actId || '');
      const weapp = map['4'] || map[4];
      console.debug('[search][referral] 点击后使用预取的链接', { skuViewId, actId, keys: Object.keys(map || {}), weapp });
      // 对象型 weapp：使用返回的 appId + path 跳转，并打印最终跳转链接
      if (wx?.navigateToMiniProgram && typeof weapp === 'object') {
        const appId = String(weapp?.appId || '');
        const path = String(weapp?.path || '');
        console.info('[search][referral] 准备跳转（对象）', { appId, path, skuViewId });
        wx.navigateToMiniProgram({
          appId,
          path,
          envVersion: 'release',
          success(res) { console.info('[search][referral] 跳转成功', { skuViewId, res }); },
          fail(err) { console.warn('[search][referral] 跳转失败', { skuViewId, err }); wx.showToast({ title: '跳转失败', icon: 'none' }); }
        });
        return;
      }
      // 字符串 weapp：以 '/' 开头时视为小程序内部路径，打印最终跳转链接
      if (typeof weapp === 'string' && wx?.navigateToMiniProgram) {
        const s = String(weapp || '');
        console.info('[search][referral] 准备跳转（字符串）', { appId: 'wxde8ac0a21135c07d', path: s, skuViewId });
        wx.navigateToMiniProgram({
          appId: 'wxde8ac0a21135c07d',
          path: s,
          envVersion: 'release',
          success(res) { console.info('[search][referral] 跳转成功', { skuViewId, res }); },
          fail(err) { console.warn('[search][referral] 跳转失败', { skuViewId, err }); wx.showToast({ title: '跳转失败', icon: 'none' }); }
        });
        return;
      }

      // 最终兜底
      wx.showToast({ title: '暂无可用链接', icon: 'none' });
    } catch (err) {
      console.warn('[search] 结果跳转失败：', err);
    }
  },
  // 新增：长按搜索按钮触发云端全量更新任务（安全保护：仅在开发模式下提示）
  async onSearchButtonLongPress() {
    try {
      wx.showLoading({ title: '正在刷新美团数据', mask: true });
      const res = await wx.cloud.callFunction({
        name: 'scheduleMeituanBrandDaily',
        data: { runMode: 'all' }
      });
      console.debug('[search] 手动刷新完成：', res && res.result);
      wx.showToast({ title: '刷新完成', icon: 'success' });
    } catch (err) {
      console.warn('[search] 手动刷新失败：', err);
      wx.showToast({ title: '刷新失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
const { cloudImageManager } = require('../../utils/cloudImageManager');