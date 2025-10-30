// pages/coupon/index.js
// 领券中心页面
const takeoutData = require('../../data/takeout');
const beverageData = require('../../data/beverage');
const locationService = require('../../utils/locationService');
const restaurantData = require('../../restaurant_data.js');

Page({
  data: {
    partnerBrands: [
      { name: '美团', logo: '/images/placeholder.png' },
      { name: '饿了么', logo: '/images/placeholder.png' },
      { name: '肯德基', logo: '/images/placeholder.png' },
      { name: '麦当劳', logo: '/images/placeholder.png' },
      { name: '星巴克', logo: '/images/placeholder.png' }
    ],
    categories: [
      { key: 'coupon', name: '红包领券' },
      { key: 'instore', name: '到店优惠' },
      { key: 'flash', name: '限时秒杀' }
    ],
    selectedCategory: 'coupon',
    coupons: [],
    couponsSmall: [],
    couponPages: [],
    nearbyOffers: [],
    nearbyOffersLoop: [],
    activityBanner: {
      image: '/images/placeholder.png',
      title: '平台大促活动',
      desc: '限时抢券，抢到即赚到'
    },
    // 位置模块显示状态与文案
    locationStatus: 'idle',
    locationText: '选择位置',
    userLocation: null,
    // 领券区分页指示
    couponSwiperCurrent: 0,
    platformBanners: []
  },

  onShow() {
    // 设置TabBar选中状态为第二个
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }

    // 从本地存储恢复位置（不主动触发位置选择）
    let cachedLoc = null;
    try { cachedLoc = wx.getStorageSync('userLocation'); } catch(e) {}
    if (cachedLoc && cachedLoc.name) {
      const name = this.truncateLocationName ? this.truncateLocationName(cachedLoc.name) : cachedLoc.name;
      this.setData({ userLocation: cachedLoc, locationStatus: 'success', locationText: name });
    } else {
      // 未设置位置：显示默认提示文案，不触发位置选择
      this.setData({ userLocation: null, locationStatus: 'idle', locationText: '选择位置' });
    }
    this.loadPlatformBanners();
  },

  onPartnerBrandTap(e) {
    const brandName = e.currentTarget.dataset.name;
    const logoUrl = e.currentTarget.dataset.logo;
    console.info('[品牌区] 用户点击品牌：', brandName, 'logo:', logoUrl);
    if (!brandName) return;
    const encoded = encodeURIComponent(brandName);
    wx.navigateTo({ url: `/pages/brand/detail?name=${encoded}` });
  },

  onLoad() {
    this.initPartnerBrands();
    this.initCoupons();
    this.refreshDisplay();
    this.buildCouponPages();
    // 进入领券中心不触发位置选择：去掉自动加载附近优惠的强制选择，改为只有已有位置时才加载
    const cachedLoc = wx.getStorageSync('userLocation');
    if (cachedLoc && cachedLoc.latitude && cachedLoc.longitude) {
      this.loadNearbyOffers();
    }
  },

  async initPartnerBrands() {
    // 优先尝试读取云端已筛选排序的品牌列表，成功则直接展示，避免进入页面时的筛选耗时
    const ok = await this.loadPartnerBrandsFromCloud();
    if (ok) {
      return;
    }
    try {
      const list = (restaurantData && restaurantData.restaurants) ? restaurantData.restaurants : [];
      const brands = list.map(r => {
        let logo = r.logoUrl || '/images/placeholder.png';
        if (typeof logo === 'string' && logo.startsWith('http://')) {
          logo = 'https://' + logo.slice(7);
        }
        return { name: r.name, logo };
      });
      const topBrands = brands.slice(0, 60);
      // 读取云端失败或没有缓存时，再进行本地筛选（可能耗时）
      this.filterBrandsWithCoupons(topBrands).then(filtered => {
        console.info('[品牌区] 过滤完成：总数', topBrands.length, '有券品牌数', filtered.length);
        this.setData({ partnerBrands: filtered.length ? filtered : [] });
      }).catch(err => {
        console.warn('[品牌区] 过滤品牌失败，回退全部', err);
        this.setData({ partnerBrands: topBrands });
      });
    } catch (e) {
      console.warn('加载品牌合作区失败：', e);
    }
  },

  async filterBrandsWithCoupons(brands) {
    const filtered = [];
    // 串行调用以降低云函数并发压力
    for (const b of brands) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getMeituanCoupon',
          data: { platform: 1, searchText: b.name }
        });
        const result = res && res.result;
        const arr = result && result.ok && result.data && result.data.data && Array.isArray(result.data.data) ? result.data.data : [];
        if (arr.length > 0) {
          // 提取品牌logo（优先使用美团返回的 brandLogoUrl）
          const first = arr[0] || {};
          let candidate = first.brandLogoUrl || (first.brandInfo && first.brandInfo.brandLogoUrl) || '';
          let logo = b.logo;
          if (typeof candidate === 'string' && candidate.length) {
            if (candidate.startsWith('http://')) {
              candidate = 'https://' + candidate.slice(7);
            }
            logo = candidate;
          } else if (typeof logo === 'string' && logo.length) {
            // 规范化/降级本地logo
            if (logo.startsWith('http://')) {
              logo = 'https://' + logo.slice(7);
            } else if (logo.startsWith('cloud://')) {
              logo = '/images/placeholder.png';
            }
          }
          console.info('[品牌区] 有券品牌：', b.name, 'logo来源：', candidate ? 'Meituan API' : (logo === '/images/placeholder.png' ? '占位' : '本地'));
          filtered.push({ name: b.name, logo });
        } else {
          console.info('[品牌区] 无券品牌过滤：', b.name);
        }
      } catch (err) {
        console.warn('[品牌区] 检查品牌是否有券失败：', b.name, err);
      }
    }
    return filtered;
  },

  onPartnerBrandTap(e) {
    const brandName = e.currentTarget.dataset.name;
    const logoUrl = e.currentTarget.dataset.logo;
    console.info('[品牌区] 用户点击品牌：', brandName, 'logo:', logoUrl);
    if (!brandName) return;
    const encodedName = encodeURIComponent(brandName);
    const encodedLogo = logoUrl ? encodeURIComponent(logoUrl) : '';
    const url = `/pages/brand/detail?name=${encodedName}${encodedLogo ? '&logo=' + encodedLogo : ''}`;
    wx.navigateTo({ url });
  },

  initCoupons() {
    // 组合外卖与饮品品牌，生成模拟优惠券数据
    const brandList = [];
    (takeoutData.takeout_categories || []).forEach(cat => {
      (cat.brands || []).forEach(b => {
        brandList.push({ name: b.brand_name, category: cat.category_name });
      });
    });
    (beverageData.beverage_brands || []).forEach(b => {
      brandList.push({ name: b.name, category: b.type });
    });

    const sampleImages = [
      '/images/placeholder.png',
      'https://picsum.photos/seed/coupon1/600/400',
      'https://picsum.photos/seed/coupon2/600/400',
      'https://picsum.photos/seed/coupon3/600/400',
      'https://picsum.photos/seed/coupon4/600/400'
    ];

    const coupons = brandList.slice(0, 24).map((b, idx) => ({
      id: 'cp_' + idx,
      title: `${b.name} 满${(idx%5+1)*20}减${(idx%3+1)*10}`,
      subTitle: `${b.category} · 高端精选`,
      tag: idx % 2 === 0 ? '限时' : '热卖',
      image: sampleImages[(idx % sampleImages.length)]
    }));

    const couponsSmall = brandList.slice(24, 48).map((b, idx) => ({
      id: 'cs_' + idx,
      title: `${b.name} 到店享${(idx%3+7)*5}%折扣`,
      subTitle: `${b.category} 优选`,
      image: sampleImages[(idx % sampleImages.length)]
    }));

    this.setData({ coupons, couponsSmall });
  },

  refreshDisplay() {
    // 根据选中的类别过滤或切换数据源（内部样式保持不变）
    const key = this.data.selectedCategory;
    let base = [];
    if (key === 'coupon') {
      base = this.data.coupons;
    } else if (key === 'instore') {
      base = this.data.coupons.slice(6); // 简单切换不同数据段
    } else {
      base = this.data.coupons.slice(12);
    }
    // 刷新分页页面
    this.setData({ couponPages: this.paginateCoupons(base, 4), couponSwiperCurrent: 0 });
  },

  buildCouponPages() {
    this.setData({ couponPages: this.paginateCoupons(this.data.coupons, 4) });
  },

  paginateCoupons(list, pageSize) {
    const pages = [];
    for (let i = 0; i < list.length; i += pageSize) {
      pages.push(list.slice(i, i + pageSize));
    }
    return pages;
  },

  onCouponSwiperChange(e) {
    this.setData({ couponSwiperCurrent: e.detail.current || 0 });
  },

  async loadNearbyOffers() {
    try {
      // 此方法不强制用户选择位置，仅当已有位置时使用其坐标进行搜索
      const loc = this.data.userLocation || wx.getStorageSync('userLocation');
      if (!loc || !loc.latitude || !loc.longitude) {
        return; // 无位置：保持占位提示
      }
      const res = await locationService.searchNearbyRestaurants({ latitude: loc.latitude, longitude: loc.longitude }, 800);
      const sampleImages = ['/images/placeholder.png'];
      const nearbyOffers = res.map(r => ({ id: r.id, name: r.name, distance: r.distance, category: r.category, image: sampleImages[((r.id||0) % sampleImages.length)] }));

      // 为无限滑动浏览准备循环数据（简单重复拼接）
      let nearbyOffersLoop = nearbyOffers;
      if (nearbyOffers.length) {
        nearbyOffersLoop = nearbyOffers.concat(nearbyOffers).concat(nearbyOffers);
      }

      this.setData({ nearbyOffers, nearbyOffersLoop });
    } catch (err) {
      console.warn('获取附近优惠失败：', err.message || err);
    }
  },

  async onLocationTap() {
    try {
      this.setData({ locationStatus: 'loading', locationText: '定位中' });
      // 直接调用微信内置位置选择，不进行权限检查与引导
      const loc = await locationService.chooseUserLocation();
      // 记录用户选择的位置到本地存储（双向同步）
      try { wx.setStorageSync('userLocation', loc); } catch(e) {}
      // 刷新附近优惠
      const res = await locationService.searchNearbyRestaurants({ latitude: loc.latitude, longitude: loc.longitude }, 800);
      const sampleImages = ['/images/placeholder.png'];
      const nearbyOffers = res.map(r => ({ id: r.id, name: r.name, distance: r.distance, category: r.category, image: sampleImages[((r.id||0) % sampleImages.length)] }));
      let nearbyOffersLoop = nearbyOffers;
      if (nearbyOffers.length) {
        nearbyOffersLoop = nearbyOffers.concat(nearbyOffers).concat(nearbyOffers);
      }
      this.setData({ 
        userLocation: loc,
        nearbyOffers,
        nearbyOffersLoop,
        locationStatus: 'success',
        locationText: this.truncateLocationName ? this.truncateLocationName(loc.name) : (loc.name || '已设置位置')
      });
    } catch (err) {
      this.setData({ locationStatus: 'idle', locationText: '选择位置' });
      wx.showToast({ title: '位置选择失败', icon: 'none' });
    }
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ selectedCategory: key });
    this.refreshDisplay();
    // 修复页签点击：在“到店优惠”和“限时秒杀”添加对应切换逻辑
    if (key === 'instore') {
      // 可选：跳转到到店优惠详情页（如后续有单独页面）
      // wx.navigateTo({ url: '/pages/coupon/instore' });
    } else if (key === 'flash') {
      // 可选：跳转到限时秒杀活动页（如后续有单独页面）
      // wx.navigateTo({ url: '/pages/coupon/flash' });
    }
  },

  onReceiveCoupon(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '已领取优惠券', icon: 'success' });
  },

  onReceiveNearbyCoupon(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '去商家享受优惠', icon: 'none' });
  },

  onBannerTap() {
    wx.showToast({ title: '活动参与成功', icon: 'success' });
    // 触发一次美团 query_coupon 接口云函数调用，并将返回打在前端日志里
    this.callMeituanCoupon();
  },

  // 前端触发云函数：调用美团 CPS Open API 的 query_coupon
  async callMeituanCoupon() {
    console.log('[Meituan][FrontEnd] 准备调用云函数 getMeituanCoupon');
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMeituanCoupon',
        data: {
          platform: 1,
          searchText: '麦当劳',
          latitude: 31.23136,
          longitude: 121.47004
          // 安全建议：AppKey/Secret 建议通过云函数环境变量配置；若未配置可临时在 data 里传入
        }
      });
      console.log('[Meituan][FrontEnd] 云函数返回 result:', res && res.result);
      if (res && res.result) {
        if (res.result.ok) {
          console.log('[Meituan][FrontEnd] 响应数据 data:', res.result.data);
        } else {
          console.warn('[Meituan][FrontEnd] 请求失败 error:', res.result.error);
        }
      } else {
        console.warn('[Meituan][FrontEnd] 云函数返回为空或格式异常:', res);
      }
    } catch (err) {
      console.error('[Meituan][FrontEnd] 云函数调用错误:', err);
    }
  },

  // 截取位置名称，限制在20个字节内（中文3字节、英文1字节）
  truncateLocationName(name) {
    if (!name) return '';
    let byteLength = 0;
    let truncatedName = '';
    for (let i = 0; i < name.length; i++) {
      const char = name[i];
      const charByteLength = /[\u4e00-\u9fa5]/.test(char) ? 3 : 1;
      if (byteLength + charByteLength <= 20) {
        byteLength += charByteLength;
        truncatedName += char;
      } else {
        break;
      }
    }
    return truncatedName === name ? name : truncatedName + '...';
  },
  onBrandLogoError(e) {
    const name = e.currentTarget.dataset.name;
    console.warn('[品牌区] 品牌logo加载失败，回退占位图：', name);
    const list = (this.data.partnerBrands || []).slice();
    const idx = list.findIndex(x => x.name === name);
    if (idx >= 0) {
      list[idx].logo = '/images/placeholder.png';
      this.setData({ partnerBrands: list });
    }
  },
  async loadPlatformBanners() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageMeituanPlatformBanner',
        data: { refresh: false }
      });
      const result = res?.result || {};
      const list = Array.isArray(result.banners) ? result.banners : [];
      const normalized = list.map(b => ({
        ...b,
        headUrl: (typeof b.headUrl === 'string' && b.headUrl.startsWith('http://')) ? ('https://' + b.headUrl.slice(7)) : b.headUrl
      }));
      this.setData({ platformBanners: normalized });
    } catch (e) {
      console.warn('[coupon] loadPlatformBanners error', e);
    }
  },
  async loadPartnerBrandsFromCloud() {
    try {
      const res = await wx.cloud.callFunction({ name: 'manageMeituanPartnerBrands', data: { refresh: false } });
      const result = res?.result || {};
      const brands = Array.isArray(result.brands) ? result.brands : [];
      if (brands.length) {
        this.setData({ partnerBrands: brands });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[品牌区] 读取云端已排序品牌失败：', e);
      return false;
    }
  },
  onTapPlatformBanner(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx || 0);
    const b = this.data.platformBanners[idx] || {};
    const map = b.referralLinkMap || {};
    const deeplink = map['3'] || map[3];
    const weapp = map['4'] || map[4];
    if (deeplink) {
      if (wx && wx.navigateTo && wx.navigateToMiniProgram) {
        wx.setClipboardData({ data: deeplink });
        wx.showToast({ title: '已复制深链，请在浏览器或美团APP打开', icon: 'none' });
      } else {
        window.location.href = deeplink;
      }
    } else if (weapp && wx?.navigateToMiniProgram) {
      const info = typeof weapp === 'object' ? weapp : {};
      if (info.appId) {
        wx.navigateToMiniProgram({ appId: info.appId, path: info.path || '', envVersion: 'release' });
      } else if (typeof weapp === 'string') {
        wx.navigateTo({ url: '/pages/webview/index?url=' + encodeURIComponent(weapp) });
      } else {
        wx.showToast({ title: '暂无法跳转', icon: 'none' });
      }
    } else {
      wx.showToast({ title: '暂无可用链接', icon: 'none' });
    }
  }
});