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
    // 直接复用平台 banner 的点击行为：根据链接进行跳转，不展示 toast
    try {
      const first = (this.data.platformBanners || [])[0];
      if (!first) return;
      const map = first.referralLinkMap || {};
      const weapp = map['4'] || map[4];
      if (weapp) {
        if (wx?.navigateToMiniProgram && typeof weapp === 'object') {
          const info = weapp || {};
          if (info.appId) {
            wx.navigateToMiniProgram({ appId: info.appId, path: info.path || '', envVersion: 'release' });
            return;
          }
        }
        if (typeof weapp === 'string') {
          // 字符串类型：内部页面路径或短链。优先内部路径
          if (weapp.startsWith('/')) {
            wx.navigateTo({ url: weapp });
            return;
          }
          // 小程序短链
          if (wx?.navigateToMiniProgram) {
            wx.navigateToMiniProgram({ shortLink: weapp, envVersion: 'release' });
            return;
          }
        }
      }
      // 无可用小程序链接时给出轻提示
      wx.showToast({ title: '暂无可用小程序链接', icon: 'none' });
    } catch (err) {
      console.warn('[coupon] 顶部活动 banner 跳转失败:', err);
    }
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
    const failingUrl = e.currentTarget.dataset.logo;
    console.warn('[品牌区] 品牌logo加载失败，回退占位图：', name, 'src=', failingUrl);
    const list = (this.data.partnerBrands || []).slice();
    const idx = list.findIndex(x => x.name === name);
    if (idx >= 0) {
      list[idx].logo = '/images/placeholder.png';
      this.setData({ partnerBrands: list });
    }
  },
  async loadPlatformBanners() {
    try {
      const db = wx.cloud.database();
      const now = Date.now();
      const { data } = await db.collection('MeituanPlatformBanner').get();
      // 过滤过期，保留有效（无字段视为有效）
      let list = (Array.isArray(data) ? data : []).filter(b => {
        const t = Number(b && b.couponValidETimestamp);
        return !t || t > now;
      });

      console.log('[coupon] 平台banner从云端读取数量:', list.length);
      // 如果云端没有有效数据，使用本地种子 actId 作为回退
      if (!list.length) {
        const fallbackActIds = [689, 701, 648, 645, 638, 569];
        list = fallbackActIds.map(actId => ({ actId, couponValidETimestamp: now + 7 * 24 * 3600 * 1000 }));
        console.log('[coupon] 使用回退 actId 列表:', fallbackActIds);
      }

      // 使用云端自有图片：cloud://.../Waddaeat/platform_actions/${actId}.png
      const fileIds = [];
      let normalized = list.map(b => {
        const actId = String(b && b.actId ? b.actId : '');
        const fileId = actId
          ? `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/platform_actions/${actId}.png`
          : '';
        if (fileId) fileIds.push(fileId);
        return { ...b, headUrl: fileId };
      });

      console.log('[coupon] 平台banner fileIds:', fileIds);

      // 将 cloud:// 文件ID 转为临时HTTPS链接
      try {
        if (fileIds.length && wx.cloud && wx.cloud.getTempFileURL) {
          const res = await wx.cloud.getTempFileURL({ fileList: fileIds });
          const map = {};
          const list2 = (res && res.fileList) || [];
          for (const item of list2) {
            if (item && item.fileID) {
              map[item.fileID] = item.tempFileURL || '';
            }
          }
          normalized = normalized.map(x => {
            const fid = x.headUrl;
            const temp = fid ? map[fid] : '';
            return { ...x, headUrl: (temp && temp.indexOf('http') === 0) ? temp : '/images/placeholder.png' };
          });
          console.log('[coupon] 平台banner云图转HTTPS结果:', normalized.map(x => ({ actId: x.actId, url: x.headUrl })));
        }
      } catch (eUrl) {
        console.warn('[coupon] 平台banner云图转HTTPS失败：', eUrl);
        normalized = normalized.map(x => ({ ...x, headUrl: '/images/placeholder.png' }));
      }

      // 输出平台banner图片路径日志以便排查
      try {
        const urls = (normalized || []).map(x => ({ actId: x.actId, url: x.headUrl }));
        console.log('[coupon] 平台banner图片路径（actId->url）：', urls);
      } catch (eLog) {}
      this.setData({ platformBanners: normalized });
    } catch (e) {
      console.warn('[coupon] 读取平台banner失败：', e);
      this.setData({ platformBanners: [] });
    }
  },
  onPlatformBannerImageError(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx || -1);
    const list = (this.data.platformBanners || []).slice();
    if (idx >= 0 && idx < list.length) {
      console.warn('[coupon] 平台banner图片加载失败，使用占位图。actId=', list[idx]?.actId, 'url=', list[idx]?.headUrl);
      list[idx].headUrl = '/images/placeholder.png';
      this.setData({ platformBanners: list });
    }
  },
  async loadPartnerBrandsFromCloud() {
    try {
      const db = wx.cloud.database();
      const coll = db.collection('MeituanPartnerBrandsSorted');

      // 分页读取全部品牌：默认每次 get 返回最多20条
      let total = 0;
      try {
        const cntRes = await coll.count();
        total = (cntRes && typeof cntRes.total === 'number') ? cntRes.total : 0;
      } catch (eCnt) {
        console.warn('[品牌区] 统计云端品牌总数失败，回退单次读取：', eCnt);
      }

      let dataAll = [];
      if (total > 0) {
        for (let offset = 0; offset < total; offset += 20) {
          try {
            const res = await coll.skip(offset).get();
            const batch = (res && Array.isArray(res.data)) ? res.data : [];
            if (batch.length) dataAll = dataAll.concat(batch);
          } catch (ePage) {
            console.warn('[品牌区] 分页读取失败，offset=', offset, ePage);
          }
        }
      } else {
        // 无法获得总数时，至少读取一页
        try {
          const res = await coll.get();
          dataAll = (res && Array.isArray(res.data)) ? res.data : [];
        } catch (eGet) {
          console.warn('[品牌区] 读取云端品牌失败：', eGet);
          dataAll = [];
        }
      }

      let brands = (Array.isArray(dataAll) ? dataAll : []).map(b => {
        const name = b.name || b.brandName || (b.raw && (b.raw.brandName || (b.raw.brandInfo && b.raw.brandInfo.brandName))) || '';
        const candidates = [
          b.brandLogoUrl,
          b.brandInfo && b.brandInfo.brandLogoUrl,
          b.logo,
          b.brandLogo,
          b.raw && (b.raw.brandLogoUrl || (b.raw.brandInfo && b.raw.brandInfo.brandLogoUrl) || b.raw.logo)
        ];
        let logo = '/images/placeholder.png';
        for (const c of candidates) {
          if (typeof c === 'string' && c.trim()) { logo = c; break; }
        }
        if (typeof logo === 'string') {
          logo = logo.replace(/`/g, '').trim();
          if (logo.startsWith('http://')) logo = 'https://' + logo.slice(7);
        }
        return { name, logo };
      }).filter(x => !!x.name);

      console.log('[品牌区] 从云端读取的品牌原始列表（name->logo，总数=', brands.length, '）：', brands.map(x => ({ name: x.name, logo: x.logo })));

      // 兼容云存储 logo：将 cloud:// 路径转换为临时 HTTPS 链接，确保在 iOS 真机也可显示
      try {
        const cloudLogos = brands.filter(x => typeof x.logo === 'string' && x.logo.indexOf('cloud://') === 0).map(x => x.logo);
        if (cloudLogos.length && wx.cloud && wx.cloud.getTempFileURL) {
          const res = await wx.cloud.getTempFileURL({ fileList: cloudLogos });
          const map = {};
          const list = (res && res.fileList) || [];
          for (const item of list) {
            if (item && item.fileID) {
              map[item.fileID] = item.tempFileURL || '';
            }
          }
          brands = brands.map(x => {
            if (typeof x.logo === 'string' && x.logo.indexOf('cloud://') === 0) {
              const temp = map[x.logo];
              return { ...x, logo: (temp && temp.indexOf('http') === 0) ? temp : '/images/placeholder.png' };
            }
            return x;
          });
          console.log('[品牌区] 云logo转HTTPS结果：', brands.map(x => ({ name: x.name, logo: x.logo })));
        }
      } catch (eLogo) {
        console.warn('[品牌区] 云logo转HTTPS失败：', eLogo);
      }

      this.setData({ partnerBrands: brands });
      return brands.length > 0;
    } catch (e) {
      console.warn('[品牌区] 直接读取云端已排序品牌失败：', e);
      this.setData({ partnerBrands: [] });
      return false;
    }
  },
  onTapPlatformBanner(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx || 0);
    const b = this.data.platformBanners[idx] || {};
    const map = b.referralLinkMap || {};
    const weapp = map['4'] || map[4];
    // 优先跳转：小程序内跳转 (对象包含 appId)
    if (weapp && wx?.navigateToMiniProgram && typeof weapp === 'object') {
      const info = weapp || {};
      if (info.appId) {
        wx.navigateToMiniProgram({ appId: info.appId, path: info.path || '', envVersion: 'release' });
        return;
      }
    }
    // 其次：字符串类型 weapp -> 内部页面 或 小程序短链
    if (typeof weapp === 'string') {
      if (weapp.startsWith('/')) {
        wx.navigateTo({ url: weapp });
        return;
      }
      if (wx?.navigateToMiniProgram) {
        wx.navigateToMiniProgram({ shortLink: weapp, envVersion: 'release' });
        return;
      }
    }
    // 无 deeplink 回退，提示不可跳转
    wx.showToast({ title: '暂无可用小程序链接', icon: 'none' });
  }
});