// pages/brand/detail.js
const restaurantData = require('../../restaurant_data.js');

Page({
  data: {
    brandName: '',
    brandLogo: '/images/placeholder.png',
    products: [],
    userLocation: null,
    loading: true,
    error: ''
  },

  onLoad(options) {
    const name = options && options.name ? decodeURIComponent(options.name) : '';
    let logo = options && options.logo ? decodeURIComponent(options.logo) : '';
    if (logo && typeof logo === 'string' && logo.startsWith('http://')) {
      logo = 'https://' + logo.slice(7);
    }
    if (logo) {
      console.info('[品牌详情] 接收到上页传入的logo：', logo);
      this.setData({ brandLogo: logo });
    }
    this.setData({ brandName: name });
    this.initBrandLogo(name);

    // 从本地缓存读取位置（不强制选择）
    let loc = null;
    try { loc = wx.getStorageSync('userLocation'); } catch(e) {}
    this.setData({ userLocation: loc || null });

    this.fetchProducts();
  },

  initBrandLogo(name) {
    try {
      const map = restaurantData && restaurantData.pinyinMap ? restaurantData.pinyinMap : null;
      const slug = map && name ? (map[name] || 'placeholder') : 'placeholder';
      const { cloudImageManager } = require('../../utils/cloudImageManager.js');
      let logoUrl = cloudImageManager.getCloudImageUrl(slug);
      // 若是 http 协议的远程地址，则转换为 https
      if (typeof logoUrl === 'string' && logoUrl.startsWith('http://')) {
        logoUrl = 'https://' + logoUrl.slice(7);
      }
      this.setData({ brandLogo: logoUrl });
    } catch (e) {
      this.setData({ brandLogo: '/images/placeholder.png' });
    }
  },

  async fetchProducts() {
    const name = this.data.brandName;
    if (!name) { this.setData({ loading: false, error: '无品牌名' }); return; }
    const loc = this.data.userLocation || {};
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMeituanCoupon',
        data: {
          platform: 1,
          searchText: name,
          latitude: typeof loc.latitude === 'number' ? loc.latitude : undefined,
          longitude: typeof loc.longitude === 'number' ? loc.longitude : undefined
        }
      });
      const result = res && res.result;
      if (!result || !result.ok) {
        this.setData({ loading: false, error: (result && result.error && result.error.message) || '请求失败' });
        return;
      }
      const list = this.transformProducts(result.data);
      const headerLogo = list && list.length > 0 ? (list[0].brandLogoUrl || '') : '';
      if (headerLogo) { this.setData({ brandLogo: headerLogo }); }
      this.setData({ products: list, loading: false });
      // 获取到商品数据后，自动调用一次 getMeituanURL 以产生云函数日志（网络连通性校验）
      try {
        await wx.cloud.callFunction({ name: 'getMeituanURL', data: { url: 'https://www.meituan.com/' } });
        console.info('[品牌详情] 已自动调用 getMeituanURL 进行网络校验');
      } catch (e) {
        console.warn('[品牌详情] 自动调用 getMeituanURL 失败：', e);
      }
    } catch (err) {
      this.setData({ loading: false, error: err.message || '网络错误' });
    }
  },

  // 将美团返回数据映射到所需字段
  transformProducts(data) {
    try {
      const items = (data && data.data && Array.isArray(data.data)) ? data.data : [];
      const now = Date.now();
      return items.map(it => {
        const brandName = it?.brandInfo?.brandName || this.data.brandName;
        // 品牌logo：优先使用返回的brandLogoUrl；若为http则改为https
        let brandLogoUrl = it?.brandInfo?.brandLogoUrl || this.data.brandLogo;
        if (typeof brandLogoUrl === 'string' && brandLogoUrl.startsWith('http://')) {
          brandLogoUrl = 'https://' + brandLogoUrl.slice(7);
        }
        const name = it?.couponPackDetail?.name || '';
        const skuViewId = it?.couponPackDetail?.skuViewId || '';
        const headUrlRaw = it?.couponPackDetail?.headUrl || '';
        const headUrl = (typeof headUrlRaw === 'string' && headUrlRaw.startsWith('http://')) ? ('https://' + headUrlRaw.slice(7)) : headUrlRaw;
        const originalPrice = it?.couponPackDetail?.originalPrice || 0;
        const sellPrice = it?.couponPackDetail?.sellPrice || 0;
        const endTimeStr = it?.couponValidTimeInfo?.couponValidETime || '';
        const endTime = endTimeStr ? new Date(endTimeStr).getTime() : 0;
        const valid = endTime ? endTime > now : true;
        return {
          brandName,
          brandLogoUrl,
          name,
          skuViewId,
          headUrl,
          originalPrice,
          sellPrice,
          couponValidETime: endTimeStr,
          valid
        };
      }).filter(x => x.valid);
    } catch (e) {
      return [];
    }
  },

  async onProductTap(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.products[idx];
    if (!item || !item.skuViewId) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMeituanReferralLink',
        data: { skuViewId: item.skuViewId, linkTypeList: '3,4' }
      });
      const result = res && res.result;
      if (!result || !result.ok) {
        // FUNCTION_NOT_FOUND 或未部署：降级提示，并尝试仅调用 getMeituanURL 产生日志
        console.warn('[品牌详情] 推广链接云函数不可用或失败：', result && result.error);
        try {
          const fallback = 'https://www.meituan.com/';
          await wx.cloud.callFunction({ name: 'getMeituanURL', data: { url: fallback } });
        } catch (e1) {}
        wx.showToast({ title: '推广服务暂不可用', icon: 'none' });
        return;
      }
      const map = result.data && result.data.data && result.data.data.referralLinkMap ? result.data.data.referralLinkMap : {};
      const deeplink = map['3'];
      const mini = map['4'];
      console.info('[品牌详情] 卡片点击：skuViewId=', item.skuViewId, '\n deeplink=', deeplink, '\n miniLink=', mini);
      // 优先尝试 deeplink：由于微信小程序无法直接打开外部App，我们采用复制到剪贴板+引导策略
      if (deeplink && typeof deeplink === 'string') {
        try {
          await wx.setClipboardData({ data: deeplink });
          wx.showModal({
            title: '已复制推广链接',
            content: '美团App推广链接已复制到剪贴板，请切换到美团App打开。若无法打开，请使用小程序链接重试。',
            showCancel: true,
            cancelText: '用小程序跳转',
            confirmText: '我知道了',
            success: async (dlg) => {
              if (dlg.cancel && mini && typeof mini === 'string') {
                try {
                  await wx.navigateToMiniProgram({
                    shortLink: mini
                  });
                } catch (err) {
                  console.warn('[品牌详情] 由弹窗引导跳转小程序失败', err);
                  wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' });
                }
              }
            }
          });
        } catch (e2) {
          console.warn('[品牌详情] 复制deeplink失败，尝试使用小程序短链：', e2);
          if (mini && typeof mini === 'string') {
            wx.navigateToMiniProgram({
              shortLink: mini,
              fail: (err) => { console.warn('[品牌详情] 跳转美团小程序失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
            });
            return;
          }
          wx.showToast({ title: '暂无可用推广链接', icon: 'none' });
        }
        // 无论复制是否成功，都不继续执行后续逻辑（优先策略为deeplink）
        return;
      }

      // 若无 deeplink，则使用小程序短链跳转
      if (mini && typeof mini === 'string') {
        wx.navigateToMiniProgram({
          shortLink: mini,
          fail: (err) => { console.warn('[品牌详情] 跳转美团小程序失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
        });
        return;
      }

      wx.showToast({ title: '暂无可用推广链接', icon: 'none' });
    } catch (err) {
      // 捕获 FUNCTION_NOT_FOUND 等 SDK 层异常
      console.warn('[品牌详情] 获取推广链接异常：', err);
      try {
        await wx.cloud.callFunction({ name: 'getMeituanURL', data: { url: 'https://www.meituan.com/' } });
      } catch (e3) {}
      wx.showToast({ title: '推广服务暂不可用', icon: 'none' });
    }
  },
});