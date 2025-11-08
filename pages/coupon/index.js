// pages/coupon/index.js
// 领券中心页面
const takeoutData = require('../../data/takeout');
const beverageData = require('../../data/beverage');
const locationService = require('../../utils/locationService');
const restaurantData = require('../../restaurant_data.js');
const restaurantPinyin = require('../../restaurant_pinyin.js');
const { cloudImageManager } = require('../../utils/cloudImageManager.js');
const meituanCityMap = require('../../utils/meituanCityMap');

Page({
  data: {
    partnerBrands: [
      { name: '美团', logo: '/images/canteen.png' },
      { name: '饿了么', logo: '/images/canteen.png' },
      { name: '肯德基', logo: '/images/canteen.png' },
      { name: '麦当劳', logo: '/images/canteen.png' },
      { name: '星巴克', logo: '/images/canteen.png' }
    ],
    categories: [
      { key: 'coupon', name: '红包领券' },
      { key: 'instore', name: '到店优惠' }
    ],
    selectedCategory: 'coupon',
    // 新增：两类数据源
    redPacketItems: [],
    instoreItems: [],
    // 渲染页数据（当前类别对应的分页数据）
    couponPages: [],
    coupons: [],
    couponsSmall: [],
    nearbyOffers: [],
    nearbyOffersLoop: [],
    activityBanner: {
        image: '/images/canteen.png',
        title: '平台大促活动',
        desc: '限时抢券，抢到即赚到'
      },
    // 位置模块显示状态与文案
    locationStatus: 'idle',
    locationText: '选择位置',
    userLocation: null,
    // 领券区分页指示
    couponSwiperCurrent: 0,
    platformBanners: [],
    // 新增：到店优惠首次加载时的 Loading 状态
    instoreLoading: false,
    // 新增：附近优惠加载中状态，避免静默等待
    nearbyLoading: false,
    // 新增：刷新控制状态（图片按钮点击时触发平滑过渡）
    couponRefreshing: false,
    // 新增：当前页码（用于按顺序分页读取下一批40条）
    couponPageIndex: 1,
    instorePageIndex: 1
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

    // TTL 机制：位置超过2小时或附近优惠为空时自动尝试刷新
    try {
      const now = Date.now();
      const TTL_MS = 2 * 3600 * 1000; // 2小时
      const expired = cachedLoc && typeof cachedLoc.ts === 'number' ? (now - cachedLoc.ts > TTL_MS) : false;
      const needRefresh = expired || !(Array.isArray(this.data.nearbyOffers) && this.data.nearbyOffers.length > 0);
      if (cachedLoc && typeof cachedLoc.latitude === 'number' && typeof cachedLoc.longitude === 'number' && needRefresh) {
        console.debug('[CouponCenter][附近优惠] 触发自动刷新：', { expired, empty: !(this.data.nearbyOffers && this.data.nearbyOffers.length) });
        this.loadNearbyOffers();
      }
    } catch (e) { console.warn('[CouponCenter][附近优惠] 自动刷新检查失败', e); }

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
    console.info('[CouponCenter][onLoad] 页面初始化');
    this.initPartnerBrands();
    // 一次性触发 manageActionCoupons 云函数的逻辑（使用本地存储标记避免重复触发）
    try {
      const seeded = wx.getStorageSync('ActionSeedTriggered_v2');
      if (!seeded) {
        wx.cloud.callFunction({ name: 'manageActionCoupons', data: { strict: true } })
          .then(() => {
            console.info('[CouponCenter][onLoad] 已触发 manageActionCoupons');
            try { wx.setStorageSync('ActionSeedTriggered_v2', true); } catch (e) {}
          })
          .catch(err => {
            console.warn('[CouponCenter][onLoad] 触发 manageActionCoupons 失败', err);
          });
      }
    } catch (e) { console.warn('[CouponCenter][onLoad] 读取本地标记失败', e); }
    // 仅使用 ActionCoupon 数据源（不回退旧云函数）
    this.loadActionCouponsList();
    // 已移除附近优惠模块：不再尝试加载或初始化附近优惠相关数据
    // const cachedLoc = wx.getStorageSync('userLocation');
    // console.info('[CouponCenter][onLoad] 本地缓存位置', cachedLoc);
    // if (cachedLoc && cachedLoc.latitude && cachedLoc.longitude) {
    //   console.info('[CouponCenter][onLoad] 发现已设置位置，触发附近优惠加载');
    //   this.loadNearbyOffers();
    // }
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
        const name = r.name;
        // 默认使用云端品牌logo（根据拼音映射生成 cloud:// fileID 或缓存的 HTTPS）
        let logo = this.getBrandLogo ? this.getBrandLogo(name) : cloudImageManager.getCloudImageUrlSync('placeholder', 'png');
        if (typeof logo === 'string' && logo.startsWith('http://')) {
          logo = 'https://' + logo.slice(7);
        }
        return { name, logo };
      });
      const topBrands = brands.slice(0, 60);
      // 官方推荐：cloud:// 直接作为 image.src，不再批量转换临时链接
      // 移除 getTempFileURL 与 ensureHttps 的回退逻辑

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
            // 规范化：仅将 http:// 升级为 https://；cloud:// 保持原样，直接用于 image.src
            if (logo.startsWith('http://')) {
              logo = 'https://' + logo.slice(7);
            }
          }
          console.info('[品牌区] 有券品牌：', b.name, 'logo来源：', candidate ? 'Meituan API' : (logo === cloudImageManager.getPlaceholderUrlSync() ? '占位' : '本地'));
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
      cloudImageManager.getPlaceholderUrlSync(),
      cloudImageManager.getPlaceholderUrlSync(),
      cloudImageManager.getPlaceholderUrlSync(),
      cloudImageManager.getPlaceholderUrlSync(),
      cloudImageManager.getPlaceholderUrlSync()
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
    const base = Array.isArray(list) ? list : [];
    const normalized = base.map((item, idx) => {
      let img = item.imageUrl || item.headUrl || item.image || '';
      if (typeof img === 'string' && img.startsWith('http://')) {
        img = 'https://' + img.slice(7);
      }
      // 官方推荐：允许 cloud:// 文件ID 直接作为 image.src
      return { ...item, imageUrl: img || cloudImageManager.getPlaceholderUrlSync(), __idx: idx };
    });
    const pages = [];
    for (let i = 0; i < normalized.length; i += pageSize) {
      pages.push(normalized.slice(i, i + pageSize));
    }
    return pages;
  },
  ensureFullBatch(newList, oldList, size = 40) {
    const desired = Number(size) || 40;
    const base = Array.isArray(newList) ? newList.slice(0, desired) : [];
    const old = Array.isArray(oldList) ? oldList : [];
    const keyOf = (it) => String(it?.skuViewId || it?.id || it?._id || '');
    const seen = new Set(base.map(keyOf).filter(Boolean));
    for (let i = 0; i < old.length && base.length < desired; i++) {
      const it = old[i];
      const k = keyOf(it);
      if (!k) continue;
      if (!seen.has(k)) { base.push(it); seen.add(k); }
    }
    while (base.length < desired && old.length) {
      base.push(old[base.length % old.length]);
    }
    return base.slice(0, desired);
  },

  onCouponSwiperChange(e) {
    this.setData({ couponSwiperCurrent: e.detail.current || 0 });
  },

  // 辅助：根据餐厅/品牌名获取云端logo（优先 Waddaeat/logos fileID）
  getBrandLogo(name) {
    try {
      const map = restaurantPinyin || null;
      const slug = map && name ? (map[name] || '') : '';
      if (slug) {
        return `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/logos/${slug}.png`;
      }
      const { cloudImageManager } = require('../../utils/cloudImageManager.js');
      return cloudImageManager.getPlaceholderUrlSync();
    } catch (e) {
      const { cloudImageManager } = require('../../utils/cloudImageManager.js');
      return cloudImageManager.getPlaceholderUrlSync();
    }
  },
  async loadNearbyOffers() {
    try {
      // 开始加载附近优惠：打开加载中状态
      this.setData({ nearbyLoading: true });
      const loc = this.data.userLocation || wx.getStorageSync('userLocation');
      console.info('[附近优惠][餐厅聚合] 开始加载，使用位置', loc);
      if (!loc || !loc.latitude || !loc.longitude) {
        console.info('[附近优惠][餐厅聚合] 未设置位置，跳过加载');
        // 未设置位置：关闭加载中状态
        this.setData({ nearbyLoading: false });
        return;
      }

      // 1) 获取附近餐厅列表（高德/模拟）并去重
      const radius = 1000;
      const nearby = await locationService.searchNearbyRestaurants({ latitude: loc.latitude, longitude: loc.longitude }, radius);
      console.info('[附近优惠][餐厅聚合] 搜索到餐厅数量', Array.isArray(nearby) ? nearby.length : -1);
      const nearbyArr = Array.isArray(nearby) ? nearby : [];
      const deduped = [];
      const seenNames = new Set();
      for (const r of nearbyArr) {
        const n = r && r.name ? String(r.name).trim() : '';
        if (!n || seenNames.has(n)) continue;
        seenNames.add(n);
        deduped.push(r);
      }
      const restaurants = deduped.slice(0, 20); // 控制数量，扩充至20家，注意后续并发限制

      // 2) 针对每家餐厅并发获取商品（外卖+到店），并为每个商品查询推广链接（仅保留有小程序链接的商品）
      const restaurantCards = [];

      for (const r of restaurants) {
        const rName = r && r.name ? r.name : '';
        if (!rName) continue;
        const qName = this.cleanRestaurantName ? this.cleanRestaurantName(rName) : (String(rName).trim());
        const lat = (r && typeof r.latitude === 'number') ? r.latitude : (r?.amapData?.latitude);
        const lng = (r && typeof r.longitude === 'number') ? r.longitude : (r?.amapData?.longitude);
        // 拉取外卖与到店商品（静默失败）
        let wmRes = null, osRes = null;
        const cityId = (() => {
          const adcode = String(this?.data?.userLocation?.adcode || r?.amapData?.adcode || '').trim();
          const cityName = String(this?.data?.userLocation?.cityName || r?.amapData?.cityName || '').trim();
          if (adcode && meituanCityMap?.adcodeToId?.[adcode]) return meituanCityMap.adcodeToId[adcode];
          if (cityName && meituanCityMap?.nameToId?.[cityName]) return meituanCityMap.nameToId[cityName];
          return meituanCityMap?.nameToId?.['上海市'] || meituanCityMap?.nameToId?.['上海'] || 310100;
        })();
        try {
          wmRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 1, cityId, searchText: qName, latitude: lat, longitude: lng } });
          console.info('[附近优惠][餐厅聚合] 外卖响应 result', wmRes && wmRes.result);
        } catch (e1) { console.warn('[附近优惠][餐厅聚合] 外卖拉取失败', { name: rName, error: e1 }); }
        try {
          osRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 2, bizLine: 1, cityId, searchText: qName, latitude: lat, longitude: lng } });
          console.info('[附近优惠][餐厅聚合] 到店响应 result', osRes && osRes.result);
        } catch (e2) { console.warn('[附近优惠][餐厅聚合] 到店拉取失败', { name: rName, error: e2 }); }

        const normalizeList = (res, source) => {
          const root = res?.result?.data || res?.result || {};
          const arr = Array.isArray(root?.data)
            ? root.data
            : (Array.isArray(root?.list)
              ? root.list
              : (Array.isArray(root?.items) ? root.items : []));
          return (arr || []).map(it => {
            const skuViewId = String(it?.couponPackDetail?.skuViewId || it?.skuViewId || '').trim();
            const brandName = it?.brandInfo?.brandName || it?.brandName || rName;
            const name = it?.couponPackDetail?.name || it?.name || it?.title || '';
            let headUrl = it?.couponPackDetail?.headUrl || it?.headUrl || it?.imgUrl || it?.image || it?.picUrl || '';
            if (typeof headUrl === 'string' && headUrl.startsWith('http://')) headUrl = 'https://' + headUrl.slice(7);
            // 新增：解析价格，保证二级页面显示
            const parseNum = (v) => { const n = (typeof v === 'string') ? parseFloat(v) : (typeof v === 'number' ? v : NaN); return isFinite(n) ? n : 0; };
            const originalPrice = parseNum(it?.couponPackDetail?.originalPrice || it?.originalPrice || it?.originPrice);
            const sellPrice = parseNum(it?.couponPackDetail?.sellPrice || it?.sellPrice || it?.price || it?.currentPrice);
            return { skuViewId, brandName, name, headUrl, source, bizLine: Number(it?.bizLine ?? (source === 'onsite' ? 1 : 0)), originalPrice, sellPrice };
          }).filter(x => !!x.skuViewId);
        };

        const wmList = normalizeList(wmRes, 'takeout');
        const osList = normalizeList(osRes, 'onsite');
        console.info('[附近优惠][餐厅聚合] 解析完成', { restaurant: rName, takeoutCount: wmList.length, onsiteCount: osList.length });

        const merged = wmList.concat(osList).slice(0, 6); // 每店最多取前6个用于查询链接
        const itemsWithLink = [];
        let idx = 0;
        const couponWorkersLimit = 3; // 每家餐厅内部并发不超过3
        const worker = async () => {
          while (idx < merged.length) {
            const it = merged[idx++];
            try {
              console.info('[附近优惠][餐厅聚合][referral] 请求 getMeituanReferralLink', { skuViewId: it.skuViewId });
              const lr = await wx.cloud.callFunction({ name: 'getMeituanReferralLink', data: { skuViewId: it.skuViewId } });
              console.info('[附近优惠][餐厅聚合][referral] 响应 result', lr && lr.result);
              const root = lr?.result?.data || lr?.result || {};
              const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;
              const linkMap = dataRoot?.referralLinkMap || {};
              const weapp = linkMap['4'] || linkMap[4] || linkMap.weapp || linkMap.mini;
              if (weapp) {
                itemsWithLink.push({ ...it, referralLinkMap: linkMap });
              } else {
                console.info('[附近优惠][餐厅聚合][referral] 未找到小程序链接，跳过', { skuViewId: it.skuViewId });
              }
            } catch (e) {
              console.warn('[附近优惠][餐厅聚合][referral] 查询失败', { skuViewId: it && it.skuViewId, error: e });
            }
          }
        };
        await Promise.all(new Array(couponWorkersLimit).fill(0).map(() => worker()));

        if (!itemsWithLink.length) {
          console.info('[附近优惠][餐厅聚合] 餐厅无可跳转商品，跳过', { restaurant: rName });
          continue;
        }

        // 提取品牌logo（优先使用美团返回的 brandLogoUrl）
        const extractBrandLogoUrl = (resp) => {
          try {
            const root = resp?.result?.data || resp?.result || {};
            const arr = Array.isArray(root?.data)
              ? root.data
              : (Array.isArray(root?.list)
                ? root.list
                : (Array.isArray(root?.items) ? root.items : []));
            let c = '';
            for (const it of arr) {
              c = it?.brandInfo?.brandLogoUrl || it?.brandLogoUrl || '';
              if (c) break;
            }
            if (typeof c === 'string' && c.startsWith('http://')) c = 'https://' + c.slice(7);
            return c;
          } catch (e) { return ''; }
        };
        const logoCandidate = extractBrandLogoUrl(wmRes) || extractBrandLogoUrl(osRes) || '';
        const logoUrl = logoCandidate || this.getBrandLogo(rName);

        restaurantCards.push({
          id: r.id || (rName + '_' + (r.distance || '')), // 兜底生成id
          name: rName,
          distance: typeof r.distance === 'number' ? r.distance : null,
          logoUrl: logoUrl || cloudImageManager.getCloudImageUrlSync('takeout', 'png'),
          products: itemsWithLink
        });
      }

      const nearbyOffers = restaurantCards;
      const nearbyOffersLoop = []; // 移除重复循环，避免重复卡片
      console.info('[附近优惠][餐厅聚合] 成功聚合餐厅数量', nearbyOffers.length);
      this.setData({ nearbyOffers, nearbyOffersLoop, nearbyLoading: false });
    } catch (err) {
      console.warn('[附近优惠][餐厅聚合] 加载失败', err);
      // 失败也需关闭加载中状态
      this.setData({ nearbyLoading: false });
    }
  },

  onNearbyRestaurantTap(e) {
    try {
      const id = e.currentTarget.dataset.id;
      const list = Array.isArray(this.data.nearbyOffers) ? this.data.nearbyOffers : [];
      const restaurant = list.find(r => String(r.id) === String(id));
      console.info('[附近优惠][餐厅聚合][点击] 选中餐厅', { id, name: restaurant && restaurant.name });
      if (!restaurant) return;
      const name = restaurant.name || '';
      const logo = restaurant.logoUrl || cloudImageManager.getCloudImageUrlSync('takeout', 'png');
      const products = Array.isArray(restaurant.products) ? restaurant.products : [];
      const url = `/pages/brand/detail?name=${encodeURIComponent(name)}&logo=${encodeURIComponent(logo)}`;
      wx.navigateTo({
        url,
        success: (res) => {
          try {
            const channel = res.eventChannel;
            channel && channel.emit && channel.emit('initData', { products });
            console.info('[附近优惠][餐厅聚合][跳转] 已传递商品数量', products.length);
          } catch (e) { console.warn('[附近优惠][餐厅聚合][跳转] 传递数据失败', e); }
        },
        fail: (err) => { console.warn('[附近优惠][餐厅聚合][跳转] 失败', err); }
      });
    } catch (err) {
      console.warn('[附近优惠][餐厅聚合][点击] 处理失败', err);
    }
  },

  async onLocationTap() {
    try {
      console.info('[CouponCenter][位置] 用户触发位置选择');
      this.setData({ locationStatus: 'loading', locationText: '定位中' });
      // 直接调用微信内置位置选择，不进行权限检查与引导
      const loc = await locationService.chooseUserLocation();
      console.info('[CouponCenter][位置] 用户选择位置', loc);
      // 记录用户选择的位置到本地存储（双向同步）
      try { wx.setStorageSync('userLocation', { ...loc, ts: Date.now() }); } catch(e) { console.warn('[CouponCenter][位置] 写入本地缓存失败', e); }
      // 使用真实位置加载附近优惠（静默失败，无提示）
      await this.setData({ userLocation: loc });
      await this.loadNearbyOffers();
      this.setData({
        userLocation: loc,
        locationStatus: 'success',
        locationText: this.truncateLocationName ? this.truncateLocationName(loc.name) : (loc.name || '已设置位置')
      });
      console.info('[CouponCenter][位置] 位置设置完成并已触发附近优惠加载');
    } catch (err) {
      this.setData({ locationStatus: 'idle', locationText: '选择位置' });
      console.warn('[CouponCenter][位置] 选择位置失败', err);
      // 静默失败：不做前端提示
    }
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    this.setData({ selectedCategory: key, couponSwiperCurrent: 0 });
    if (key === 'coupon') {
      const list = this.data.redPacketItems || [];
      if (list.length) {
        this.setData({ couponPages: this.paginateCoupons(list, 4) });
      } else {
        // 空态：清空旧分页，尝试重新加载 ActionCoupon 列表
        this.setData({ couponPages: [] });
        this.loadActionCouponsList();
      }
      // 切换类别时重置红包页码
      this.setData({ couponPageIndex: 1 });
    } else if (key === 'instore') {
      const list = this.data.instoreItems || [];
      if (list.length) {
        this.setData({ couponPages: this.paginateCoupons(list, 4) });
      } else {
        // 空态：清空旧分页，尝试重新加载 ActionCoupon。并显示加载中
        this.setData({ couponPages: [], instoreLoading: true });
        this.loadInstoreCouponsList();
      }
      // 切换类别时重置到店页码
      this.setData({ instorePageIndex: 1 });
    }
  },

  // 刷新按钮点击：按顺序加载下一批40条并替换当前列表
  async onRefreshTap() {
    try {
      if (this.data.couponRefreshing) return; // 避免重复触发
      this.setData({ couponRefreshing: true });
      const key = this.data.selectedCategory;
      if (key === 'coupon') {
        // 仅使用 ActionCoupon 数据源进行刷新
        await this.loadActionCouponsList();
        this.setData({ couponSwiperCurrent: 0, couponPageIndex: 1 });
      } else if (key === 'instore') {
        const nextPage = (this.data.instorePageIndex || 1) + 1;
        const res = await wx.cloud.callFunction({ name: 'getOnsiteCouponsList', data: { page: nextPage, pageSize: 40 } });
        let list = (res.result && (Array.isArray(res.result.items) ? res.result.items : (Array.isArray(res.result.list) ? res.result.list : []))) || [];
        const filled = this.ensureFullBatch(list, this.data.instoreItems || [], 40);
        this.setData({ instoreItems: filled, couponPages: this.paginateCoupons(filled, 4), couponSwiperCurrent: 0, instorePageIndex: nextPage });
      }
    } catch (e) {
      console.warn('[CouponCenter] 刷新失败：', e);
      wx.showToast({ title: '刷新失败，请稍后重试', icon: 'none' });
    } finally {
      // 平滑过渡结束
      setTimeout(() => { this.setData({ couponRefreshing: false }); }, 180);
    }
  },

  onReceiveCoupon(e) {
    try {
      const id = e?.currentTarget?.dataset?.id || e?.target?.dataset?.id; // skuViewId
      const listB = Array.isArray(this.data.instoreItems) ? this.data.instoreItems : [];
      const item = listB.find(c => String(c.skuViewId) === String(id));
      const map = item?.referralLinkMap || {};
      const weapp = map['4'] || map[4];
      if (!weapp) {
        wx.showToast({ title: '暂无可用链接', icon: 'none' });
        return;
      }
      // 对象类型：包含 appId/path，优先使用对象内 appId
      if (wx?.navigateToMiniProgram && typeof weapp === 'object') {
        const info = weapp || {};
        const appId = info.appId || 'wxde8ac0a21135c07d';
        wx.navigateToMiniProgram({
          appId,
          path: info.path || '',
          envVersion: 'release',
          success: () => {},
          fail: (err) => {
            console.warn('[instore] 以对象跳转失败：', err);
            wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' });
          }
        });
        return;
      }
      // 字符串类型：内部页面路径或小程序短链
      if (typeof weapp === 'string') {
        const s = weapp.trim();
        if (s.startsWith('/')) {
          wx.navigateToMiniProgram({
            appId: 'wxde8ac0a21135c07d',
            path: s,
            envVersion: 'release',
            success: () => {},
            fail: (err) => {
              console.warn('[instore] 以内部 path 跳转失败：', err);
              wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' });
            }
          });
          return;
        }
        if (wx?.navigateToMiniProgram) {
          wx.navigateToMiniProgram({
            shortLink: s,
            envVersion: 'release',
            success: () => {},
            fail: (err) => {
              console.warn('[instore] 以短链跳转失败：', err);
              wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' });
            }
          });
          return;
        }
      }
      wx.showToast({ title: '暂无可用链接', icon: 'none' });
    } catch (err) {
      console.warn('[instore] 跳转美团小程序失败：', err);
      wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' });
    }
  },

  onReceiveNearbyCoupon(e) {
    try {
      const id = String(e?.currentTarget?.dataset?.id || '');
      if (!id) return;
      const list = Array.isArray(this.data.nearbyOffers) ? this.data.nearbyOffers : [];
      const item = list.find(x => String(x.id) === id);
      if (!item) return;
      const map = item.referralLinkMap || {};
      const weapp = map['4'] || map[4];
      if (!weapp) { console.info('[附近优惠][点击跳转] 未找到小程序链接'); return; }
      // 对象类型：包含 appId/path，优先使用对象内 appId
      if (wx?.navigateToMiniProgram && typeof weapp === 'object') {
        const info = weapp || {};
        const appId = info.appId || 'wxde8ac0a21135c07d';
        console.info('[附近优惠][点击跳转] 以对象跳转', { appId, path: info.path || '' });
        wx.navigateToMiniProgram({ appId, path: info.path || '', envVersion: 'release' });
        return;
      }
      // 字符串类型：内部页面路径或小程序短链
      if (typeof weapp === 'string' && wx?.navigateToMiniProgram) {
        const s = weapp.trim();
        if (s.startsWith('/')) {
          console.info('[附近优惠][点击跳转] 以内部path跳转', { appId: 'wxde8ac0a21135c07d', path: s });
          wx.navigateToMiniProgram({ appId: 'wxde8ac0a21135c07d', path: s, envVersion: 'release' });
        } else {
          console.info('[附近优惠][点击跳转] 以 shortLink 跳转', { shortLink: s });
          wx.navigateToMiniProgram({ shortLink: s, envVersion: 'release' });
        }
      }
    } catch (err) {
      console.warn('[附近优惠][点击跳转] 失败', err);
      // 静默失败：不做前端提示
    }
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

  navigateToSearch() {
    try {
      wx.navigateTo({ url: '/pages/search/index' });
    } catch (err) {
      console.warn('[coupon] 跳转搜索页失败：', err);
      wx.showToast({ title: '跳转失败', icon: 'none' });
    }
  },

  // 前端触发云函数：调用美团 CPS Open API 的 query_coupon
  async callMeituanCoupon() {
    console.debug('[Meituan][FrontEnd] 准备调用云函数 getMeituanCoupon');
    try {
      const loc = this.data.userLocation || wx.getStorageSync('userLocation') || {};
      const latitude = (loc && typeof loc.latitude === 'number') ? loc.latitude : undefined;
      const longitude = (loc && typeof loc.longitude === 'number') ? loc.longitude : undefined;
      const res = await wx.cloud.callFunction({
        name: 'getMeituanCoupon',
        data: {
          platform: 1,
          searchText: '麦当劳',
          latitude,
          longitude
          // 安全建议：AppKey/Secret 建议通过云函数环境变量配置；若未配置可临时在 data 里传入
        }
      });
      console.debug('[Meituan][FrontEnd] 云函数返回 result:', res && res.result);
      if (res && res.result) {
        if (res.result.ok) {
          console.debug('[Meituan][FrontEnd] 响应数据 data:', res.result.data);
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
  onPlatformBannerImageError(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx || -1);
    const list = (this.data.platformBanners || []).slice();
    if (idx >= 0 && idx < list.length) {
      let failing = list[idx]?.headUrl;
      // 官方推荐：仅将 http:// 提升为 https://；cloud:// 保持原样，但在错误回调中使用占位图兜底
      if (typeof failing === 'string' && failing.startsWith('http://')) {
        failing = 'https://' + failing.slice(7);
        list[idx].headUrl = failing;
      } else {
        list[idx].headUrl = cloudImageManager.getPlaceholderUrlSync();
      }
      this.setData({ platformBanners: list });
    }
  },
  async loadPlatformBanners() {
    try {
      const res = await wx.cloud.callFunction({ name: 'manageMeituanPlatformBanner', data: { refresh: false, actIds: [689, 701, 648, 645, 638, 569] } });
      const list = Array.isArray(res?.result?.banners) ? res.result.banners : [];
      const normalized = list.map(b => {
        const actId = b.actId || b.activityId || b.id || '';
        // 强制：使用 actId 拼接云端 fileID（平台活动图片）
        const headUrl = actId ? `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/platform_actions/${actId}.png` : cloudImageManager.getPlaceholderUrlSync();
        return { ...b, actId, headUrl };
      });

      // 若首次读取为空，不视为错误，主动触发一次刷新再回填
      if (!normalized.length) {
        console.info('[PlatformBanner] 首次读取为空，尝试刷新');
        const res2 = await wx.cloud.callFunction({ name: 'manageMeituanPlatformBanner', data: { refresh: true, actIds: [689, 701, 648, 645, 638, 569] } });
        const list2 = Array.isArray(res2?.result?.banners) ? res2.result.banners : [];
        const normalized2 = list2.map(b => {
          const actId = b.actId || b.activityId || b.id || '';
          // 强制：使用 actId 拼接云端 fileID（平台活动图片）
          const headUrl = actId ? `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/platform_actions/${actId}.png` : cloudImageManager.getPlaceholderUrlSync();
          return { ...b, actId, headUrl };
        });
        const defaultActIds = [689, 701, 648, 645, 638, 569];
        const final = normalized.length ? normalized : [689, 701, 648, 645, 638, 569].map(id => ({ actId: String(id), headUrl: `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/platform_actions/${id}.png`, name: '平台活动' }));
        if (final && final.length) {
          const f = final[0];
          const map = (f && typeof f === 'object') ? (f.referralLinkMap || f.linkMap || f.urlMap || (f.links && f.links.referralLinkMap) || {}) : {};
          const wa = map['4'] || map[4] || map.weapp || map.mini;
          console.info('[PlatformBanner] 刷新后首条数据', { actId: f.actId, headUrl: f.headUrl, weapp: wa });
        }
        this.setData({ platformBanners: final });
        return;
      }

      const final = normalized.length ? normalized : [{ actId: 'placeholder', headUrl: cloudImageManager.getPlaceholderUrlSync(), name: '平台活动' }];
      if (final && final.length) {
        const f = final[0];
        const map = (f && typeof f === 'object') ? (f.referralLinkMap || f.linkMap || f.urlMap || (f.links && f.links.referralLinkMap) || {}) : {};
        const wa = map['4'] || map[4] || map.weapp || map.mini;
        console.info('[PlatformBanner] 首条数据', { actId: f.actId, headUrl: f.headUrl, weapp: wa });
      }
      this.setData({ platformBanners: final });
    } catch (err) {
      console.warn('[PlatformBanner] 读取失败，尝试刷新', err);
      try {
        const res2 = await wx.cloud.callFunction({ name: 'manageMeituanPlatformBanner', data: { refresh: true } });
        const list2 = Array.isArray(res2?.result?.banners) ? res2.result.banners : [];
        const normalized2 = list2.map(b => {
          const actId = b.actId || b.activityId || b.id || '';
          // 强制：使用 actId 拼接云端 fileID（平台活动图片）
          const headUrl = actId ? `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/platform_actions/${actId}.png` : cloudImageManager.getPlaceholderUrlSync();
          return { ...b, actId, headUrl };
        });
        const defaultActIds = [689, 701, 648, 645, 638, 569];
        const fallbackList = defaultActIds.map(id => ({ actId: String(id), headUrl: `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/platform_actions/${id}.png`, name: '平台活动' }));
        this.setData({ platformBanners: fallbackList });
      } catch (err2) {
        console.warn('[PlatformBanner] 刷新失败', err2);
        const defaultActIds = [689, 701, 648, 645, 638, 569];
        const fallbackList = defaultActIds.map(id => ({ actId: String(id), headUrl: `cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/platform_actions/${id}.png`, name: '平台活动' }));
        this.setData({ platformBanners: fallbackList });
      }
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
        let logo = cloudImageManager.getPlaceholderUrlSync();
        for (const c of candidates) {
          if (typeof c === 'string' && c.trim()) { logo = c; break; }
        }
        if (typeof logo === 'string') {
          logo = logo.replace(/`/g, '').trim();
          if (logo.startsWith('http://')) logo = 'https://' + logo.slice(7);
        }
        // 云端缺 logo 时使用本地拼音映射获取 cloud:// 品牌图
        if (!logo || logo === cloudImageManager.getPlaceholderUrlSync()) {
          try {
            const alt = this.getBrandLogo ? this.getBrandLogo(name) : cloudImageManager.getCloudImageUrlInDirSync('logos', name, 'png');
            if (typeof alt === 'string' && alt.trim()) { logo = alt; }
          } catch (eAlt) { /* ignore */ }
        }
        return { name, logo };
      }).filter(x => !!x.name);
      console.debug('[品牌区] 从云端读取的品牌原始列表（name->logo，总数=', brands.length, '）：', brands.map(x => ({ name: x.name, logo: x.logo })));

      // 官方推荐：cloud:// 直接作为 image.src，不再批量转换临时链接
      this.setData({ partnerBrands: brands });
      return brands.length > 0;
    } catch (e) {
      console.warn('[品牌区] 直接读取云端已排序品牌失败：', e);
      this.setData({ partnerBrands: [] });
      return false;
    }
  },
  async onTapPlatformBanner(e) {
    console.debug('[banner] tap event:', e);
    const idx = Number(e?.currentTarget?.dataset?.idx || 0);
    console.debug('[banner] idx:', idx);
    const b = this.data.platformBanners[idx] || {};
    console.debug('[banner] banner data:', b);
    const map = (b && typeof b === 'object') ? (b.referralLinkMap || b.linkMap || b.urlMap || (b.links && b.links.referralLinkMap) || {}) : {};
    const weapp = map['4'] || map[4] || map?.weapp || map?.mini;
    console.debug('[banner] referralLinkMap:', map, 'weapp:', weapp);
    // 直接用小程序链接拉起（优先 weapp 对象 appId，其次短链字符串），不做额外 toast/内部跳转
    try {
      if (weapp && wx?.navigateToMiniProgram && typeof weapp === 'object' && weapp.appId) {
        console.debug('[banner] navigateToMiniProgram object:', weapp);
        wx.navigateToMiniProgram({ appId: weapp.appId, path: weapp.path || '', envVersion: 'release' });
        return;
      }
      if (typeof weapp === 'string' && wx?.navigateToMiniProgram) {
        const s = weapp.trim();
        console.debug('[banner] navigateToMiniProgram shortLink/path:', s);
        if (s.startsWith('/')) {
          wx.navigateToMiniProgram({ appId: 'wxde8ac0a21135c07d', path: s, envVersion: 'release' });
        } else {
          wx.navigateToMiniProgram({ shortLink: s, envVersion: 'release' });
        }
        return;
      }
      // 兜底：通过云函数动态获取小程序链接并拉起
      if (b.actId) {
        console.debug('[banner] fallback by actId:', b.actId);
        const res = await wx.cloud.callFunction({ name: 'getMeituanReferralLink', data: { actId: b.actId } });
        const root = res?.result?.data || {};
        const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;
        const linkMap = dataRoot?.referralLinkMap || {};
        const wa = linkMap['4'] || linkMap[4] || linkMap.weapp || linkMap.mini;
        console.debug('[banner] fallback referralLinkMap:', linkMap, 'weapp:', wa);
        if (wa && typeof wa === 'object' && wa.appId && wx?.navigateToMiniProgram) {
          wx.navigateToMiniProgram({ appId: wa.appId, path: wa.path || '', envVersion: 'release' });
          return;
        }
        if (typeof wa === 'string' && wx?.navigateToMiniProgram) {
          const s2 = wa.trim();
          if (s2.startsWith('/')) {
            wx.navigateToMiniProgram({ appId: 'wxde8ac0a21135c07d', path: s2, envVersion: 'release' });
          } else {
            wx.navigateToMiniProgram({ shortLink: s2, envVersion: 'release' });
          }
          return;
        }
      }
    } catch (e2) {
      console.warn('[banner] 拉起小程序失败或链接缺失', e2);
    }
    // 不做任何 toast 或内部回退跳转，保持简单直达体验
  },
  // 新增：从 ActionCoupon 集合读取活动券（纯图片卡片）
  async loadActionCouponsList() {
    try {
      const db = wx.cloud.database();
      const coll = db.collection('ActionCoupon');
      // 读取全部（批量分页）
      let total = 0;
      try {
        const cnt = await coll.count();
        total = (cnt && typeof cnt.total === 'number') ? cnt.total : 0;
      } catch (eCnt) {
        console.warn('[ActionCoupon] 统计失败，尝试单页读取', eCnt);
      }
      // 当集合为空时，自动触发种子投放一次
      if (total === 0) {
        try {
          await wx.cloud.callFunction({ name: 'manageActionCoupons', data: { strict: true } });
          console.info('[ActionCoupon] 已触发种子投放');
        } catch (eSeed) {
          console.warn('[ActionCoupon] 种子投放失败', eSeed);
        }
      }
      let docs = [];
      if (total > 0) {
        for (let offset = 0; offset < total; offset += 20) {
          try {
            const res = await coll.skip(offset).get();
            const batch = (res && Array.isArray(res.data)) ? res.data : [];
            if (batch.length) docs = docs.concat(batch);
          } catch (ePage) {
            console.warn('[ActionCoupon] 分页读取失败 offset=', offset, ePage);
          }
        }
      } else {
        try {
          const res = await coll.get();
          docs = (res && Array.isArray(res.data)) ? res.data : [];
        } catch (eGet) {
          console.warn('[ActionCoupon] 单页读取失败', eGet);
          docs = [];
        }
      }
      // 组装前端展示项：仅保留必要字段（缺图时用拼音映射拼接cloud路径）
      let list = (docs || []).map(d => {
        const actId = d.actId || '';
        const name = d.name || ('平台活动' + actId);
        const img = (d.imageCloudPath || d.imageUrl || d.image) || '';
        const linkMap = d.referralLinkMap || {};
        let imageUrl = img;
        if (typeof imageUrl === 'string' && imageUrl.startsWith('http://')) {
          imageUrl = 'https://' + imageUrl.slice(7);
        }
        // 缺图或空串：根据中文名称使用 restaurant_pinyin 的 eleme_ 前缀映射生成 cloud:// 路径
        if (!imageUrl || (typeof imageUrl === 'string' && imageUrl.trim() === '')) {
          try {
            const map = restaurantPinyin || {};
            const key = String(name || '').trim();
            let slug = map[key] || map[key.replace(/\s+/g,'')] || '';
            if (!slug && key) {
              // 兼容大小写或全角字符的简单归一化
              const norm = key.replace(/\s+/g,'').toLowerCase();
              slug = map[norm] || '';
            }
            if (slug) {
              imageUrl = cloudImageManager.getCloudImageUrlInDirSync('platform_actions', slug, 'png');
            }
          } catch (_) {}
        }
        return { actId, name, imageUrl, referralLinkMap: linkMap };
      }).filter(x => !!x.imageUrl);

      // 官方推荐：cloud:// 直接作为 image.src，不再批量转换临时链接
      // 设置数据与分页（即使无数据也用占位卡片填充）
      const placeholderImg = cloudImageManager.getPlaceholderUrlSync();
      const finalList = list.length ? list : [
        { actId: 'placeholder_1', name: '平台活动', imageUrl: placeholderImg, referralLinkMap: {} },
        { actId: 'placeholder_2', name: '平台活动', imageUrl: placeholderImg, referralLinkMap: {} },
        { actId: 'placeholder_3', name: '平台活动', imageUrl: placeholderImg, referralLinkMap: {} },
        { actId: 'placeholder_4', name: '平台活动', imageUrl: placeholderImg, referralLinkMap: {} },
      ];
      this.setData({ redPacketItems: finalList });
      if (this.data.selectedCategory === 'coupon') {
        this.setData({ couponPages: this.paginateCoupons(finalList, 4) });
      }
      return finalList.length > 0;
    } catch (err) {
      console.error('[ActionCoupon] 加载失败', err);
      return false;
    }
  },

  // 新增：点击活动券卡片，直接拉起开放平台小程序链接
  onReceiveActionCoupon(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx || -1);
    const list = this.data.redPacketItems || [];
    const item = (idx >= 0 && idx < list.length) ? list[idx] : null;
    if (!item) return;
    const map = item.referralLinkMap || {};
    const weapp = map['4'] || map[4];
    try {
      if (weapp && wx?.navigateToMiniProgram && typeof weapp === 'object' && weapp.appId) {
        wx.navigateToMiniProgram({ appId: weapp.appId, path: weapp.path || '', envVersion: 'release' });
        return;
      }
      if (typeof weapp === 'string' && wx?.navigateToMiniProgram) {
        const s = weapp.trim();
        if (s.startsWith('/')) {
          wx.navigateToMiniProgram({ appId: 'wxde8ac0a21135c07d', path: s, envVersion: 'release' });
        } else {
          wx.navigateToMiniProgram({ shortLink: s, envVersion: 'release' });
        }
        return;
      }
    } catch (e2) {
      console.warn('[ActionCoupon] 拉起小程序失败或链接缺失', e2);
    }
  },

  // 从云函数读取红包领券列表（已废弃），统一改为 ActionCoupon 集合
  async loadRedPacketCouponsList() {
    console.info('[RedPacket] 方法已废弃，改用 loadActionCouponsList');
    return this.loadActionCouponsList();
  },

  // 新增：读取到店优惠列表（仅使用 linkType=4）
  async loadInstoreCouponsList() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOnsiteCouponsList', data: { page: 1, pageSize: 40 } });
      const list = (res.result && (Array.isArray(res.result.items) ? res.result.items : (Array.isArray(res.result.list) ? res.result.list : []))) || [];
      this.setData({ instoreItems: list });
      if (this.data.selectedCategory === 'instore') {
        this.setData({ couponPages: this.paginateCoupons(list, 4) });
      }
    } catch (err) {
      console.error('[getOnsiteCouponsList] failed', err);
      wx.showToast({ title: '到店优惠加载失败', icon: 'none' });
    } finally {
      // 结束加载，隐藏 Loading
      if (this.data.instoreLoading) {
        this.setData({ instoreLoading: false });
      }
    }
  },
  onTapCouponDot(e) {
    const idx = Number(e?.currentTarget?.dataset?.index || 0);
    this.setData({ couponSwiperCurrent: idx });
  },
  onCouponImageError(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx || -1);
    const list = this.data.redPacketItems || [];
    if (idx >= 0 && idx < list.length) {
      const failing = list[idx]?.imageUrl;
      // 官方推荐：仅将 http:// 提升为 https://；cloud:// 保持原样
      if (typeof failing === 'string' && failing.startsWith('http://')) {
        failing = 'https://' + failing.slice(7);
      }
      list[idx].imageUrl = failing || cloudImageManager.getPlaceholderUrlSync();
      this.setData({ redPacketItems: list, couponPages: this.paginateCoupons(list, 4) });
    }
  },
  onInstoreImageError(e) {
    try {
      const idx = Number(e?.currentTarget?.dataset?.idx || -1);
      const list = Array.isArray(this.data.instoreItems) ? this.data.instoreItems : [];
      if (idx >= 0 && idx < list.length) {
        let failing = list[idx]?.headUrl;
        // 官方推荐：仅将 http:// 提升为 https://；其他情况直接回退到占位图避免重复错误
        if (typeof failing === 'string' && failing.startsWith('http://')) {
          failing = 'https://' + failing.slice(7);
          list[idx].headUrl = failing;
        } else {
          list[idx].headUrl = cloudImageManager.getPlaceholderUrlSync();
        }
        // 若当前在到店类别，刷新分页
        if (this.data.selectedCategory === 'instore') {
          this.setData({ instoreItems: list, couponPages: this.paginateCoupons(list, 4) });
        } else {
          this.setData({ instoreItems: list });
        }
      }
    } catch (err) {
      console.warn('[instore] 图片占位兜底失败：', err);
    }
  },
  onBrandLogoError(e) {
    try {
      const name = e?.currentTarget?.dataset?.name || '';
      const logo = e?.currentTarget?.dataset?.logo || '';
      const list = Array.isArray(this.data.partnerBrands) ? this.data.partnerBrands.slice() : [];
      const idx = list.findIndex(b => (b && b.name) === name);
      if (idx >= 0) {
        let fixed = logo;
        // 官方推荐：仅将 http:// 升级为 https://；cloud:// 保持原样，错误时使用占位图兜底
        if (typeof fixed === 'string' && fixed.startsWith('http://')) {
          fixed = 'https://' + fixed.slice(7);
          list[idx].logo = fixed;
        } else {
          list[idx].logo = cloudImageManager.getPlaceholderUrlSync();
        }
        this.setData({ partnerBrands: list });
      }
    } catch (err) {
      console.warn('[品牌区] 品牌logo错误兜底失败：', err);
    }
  },

  // 加载成功日志：平台banner
  onPlatformBannerImageLoad(e) {
    try {
      const idx = Number(e?.currentTarget?.dataset?.idx || -1);
      const list = Array.isArray(this.data.platformBanners) ? this.data.platformBanners : [];
      const src = (idx >= 0 && list[idx]) ? list[idx].image : '';
      console.info(`[${Date.now()}] 平台banner加载成功`, { idx, src, detail: e && e.detail });
    } catch (err) {
      console.warn('[coupon] onPlatformBannerImageLoad 日志异常', err);
    }
  },

  // 加载成功日志：红包卡片图片
  onCouponImageLoad(e) {
    try {
      const idx = Number(e?.currentTarget?.dataset?.idx || -1);
      const pages = Array.isArray(this.data.couponPages) ? this.data.couponPages : [];
      let src = '';
      if (idx >= 0) {
        const pageSize = 4;
        const pageIndex = Math.floor(idx / pageSize);
        const itemIndex = idx % pageSize;
        const page = pages[pageIndex] || [];
        src = (page[itemIndex] && page[itemIndex].imageUrl) || '';
      }
      console.info(`[${Date.now()}] 红包卡片图片加载成功`, { idx, src, detail: e && e.detail });
    } catch (err) {
      console.warn('[coupon] onCouponImageLoad 日志异常', err);
    }
  },

  // 加载成功日志：品牌logo
  onBrandLogoLoad(e) {
    try {
      const name = e?.currentTarget?.dataset?.name || '';
      const logo = e?.currentTarget?.dataset?.logo || '';
      console.info(`[${Date.now()}] 品牌logo加载成功`, { name, logo, detail: e && e.detail });
    } catch (err) {
      console.warn('[coupon] onBrandLogoLoad 日志异常', err);
    }
  },
});