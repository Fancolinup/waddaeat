// pages/coupon/index.js
// 领券中心页面
const takeoutData = require('../../data/takeout');
const beverageData = require('../../data/beverage');
const locationService = require('../../utils/locationService');
const restaurantData = require('../../restaurant_data.js');
const { cloudImageManager } = require('../../utils/cloudImageManager.js');

Page({
  data: {
    partnerBrands: [
      { name: '美团', logo: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
      { name: '饿了么', logo: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
      { name: '肯德基', logo: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
      { name: '麦当劳', logo: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' },
      { name: '星巴克', logo: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png' }
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
      image: 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/canteen.png',
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
    this.loadRedPacketCouponsList(); // 接入云端红包领券列表
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
        let logo = r.logoUrl || cloudImageManager.getCloudImageUrlSync('takeout', 'png');
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
              logo = cloudImageManager.getPlaceholderUrlSync();
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
    const pages = [];
    for (let i = 0; i < list.length; i += pageSize) {
      pages.push(list.slice(i, i + pageSize));
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

  // 辅助：根据餐厅/品牌名获取云端logo（带 https 兜底）
  getBrandLogo(name) {
    try {
      const { cloudImageManager } = require('../../utils/cloudImageManager.js');
      const map = restaurantData && restaurantData.pinyinMap ? restaurantData.pinyinMap : null;
      const slug = map && name ? (map[name] || 'placeholder') : 'placeholder';
      let url = cloudImageManager.getCloudImageUrl(slug);
      if (typeof url === 'string' && url.startsWith('http://')) url = 'https://' + url.slice(7);
      return url || cloudImageManager.getPlaceholderUrlSync();
    } catch (e) {
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
        try {
          wmRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 1, searchText: qName, latitude: lat, longitude: lng } });
          console.info('[附近优惠][餐厅聚合] 外卖响应 result', wmRes && wmRes.result);
        } catch (e1) { console.warn('[附近优惠][餐厅聚合] 外卖拉取失败', { name: rName, error: e1 }); }
        try {
          osRes = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 2, bizLine: 1, searchText: qName, latitude: lat, longitude: lng } });
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
        // 空态：先清空旧分页，避免残留到店/红包列表
        this.setData({ couponPages: [] });
        this.loadRedPacketCouponsList();
      }
      // 切换类别时重置红包页码
      this.setData({ couponPageIndex: 1 });
    } else if (key === 'instore') {
      const list = this.data.instoreItems || [];
      if (list.length) {
        this.setData({ couponPages: this.paginateCoupons(list, 4) });
      } else {
        // 空态：先清空旧分页，避免残留红包列表，并显示加载中
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
        const nextPage = (this.data.couponPageIndex || 1) + 1;
        const res = await wx.cloud.callFunction({ name: 'getRedPacketCouponsList', data: { page: nextPage, pageSize: 40, priceCap: 100 } });
        let list = (res.result && (Array.isArray(res.result.list) ? res.result.list : (Array.isArray(res.result.items) ? res.result.items : []))) || [];
        const cap = 100;
        list = list.filter(it => {
          const sp = Number(it?.sellPrice || 0);
          const op = Number(it?.originalPrice || 0);
          const hasSp = sp > 0;
          const hasOp = op > 0;
          if (hasSp && hasOp) return sp <= cap && op <= cap;
          if (hasSp && !hasOp) return sp <= cap;
          if (!hasSp && hasOp) return op <= cap;
          return false;
        });
        const filled = this.ensureFullBatch(list, this.data.redPacketItems || [], 40);
        this.setData({ redPacketItems: filled, couponPages: this.paginateCoupons(filled, 4), couponSwiperCurrent: 0, couponPageIndex: nextPage });
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
      const listA = Array.isArray(this.data.redPacketItems) ? this.data.redPacketItems : [];
      const listB = Array.isArray(this.data.instoreItems) ? this.data.instoreItems : [];
      const all = listA.concat(listB);
      const item = all.find(c => String(c.skuViewId) === String(id));
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
            console.warn('[coupon] 以对象跳转失败：', err);
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
              console.warn('[coupon] 以内部 path 跳转失败：', err);
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
              console.warn('[coupon] 以短链跳转失败：', err);
              wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' });
            }
          });
          return;
        }
      }
      wx.showToast({ title: '暂无可用链接', icon: 'none' });
    } catch (err) {
      console.warn('[coupon] 跳转美团小程序失败：', err);
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
      const weapp = map['4'] || map[4] || map.weapp || map.mini;
      console.info('[附近优惠][点击跳转] 选中项', { id, itemPreview: { name: item && item.name, category: item && item.category }, linkMap: map });
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
  onBrandLogoError(e) {
    const name = e.currentTarget.dataset.name;
    const failingUrl = e.currentTarget.dataset.logo;
    console.warn('[品牌区] 品牌logo加载失败，回退占位图：', name, 'src=', failingUrl);
    const list = (this.data.partnerBrands || []).slice();
    const idx = list.findIndex(x => x.name === name);
    if (idx >= 0) {
      list[idx].logo = cloudImageManager.getPlaceholderUrlSync();
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

      console.debug('[coupon] 平台banner从云端读取数量:', list.length);
      // 如果云端没有有效数据，使用本地种子 actId 作为回退
      if (!list.length) {
        const fallbackActIds = [689, 701, 648, 645, 638, 569];
        list = fallbackActIds.map(actId => ({ actId, couponValidETimestamp: now + 7 * 24 * 3600 * 1000 }));
        console.debug('[coupon] 使用回退 actId 列表:', fallbackActIds);
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

      console.debug('[coupon] 平台banner fileIds:', fileIds);

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
            return { ...x, headUrl: (temp && temp.indexOf('http') === 0) ? temp : cloudImageManager.getPlaceholderUrlSync() };
          });
          console.debug('[coupon] 平台banner云图转HTTPS结果:', normalized.map(x => ({ actId: x.actId, url: x.headUrl })));
        }
      } catch (eUrl) {
        console.warn('[coupon] 平台banner云图转HTTPS失败：', eUrl);
        normalized = normalized.map(x => ({ ...x, headUrl: cloudImageManager.getPlaceholderUrlSync() }));
      }

      // 输出平台banner图片路径日志以便排查
      try {
        const urls = (normalized || []).map(x => ({ actId: x.actId, url: x.headUrl }));
        console.debug('[coupon] 平台banner图片路径（actId->url）：', urls);
      } catch (eLog) {}

      // 预填平台 Banner 的推广链接，减少点击时的等待
      try {
        const actIds = Array.from(new Set((normalized || []).map(x => String(x.actId || '')).filter(Boolean)));
        if (actIds.length) {
          const _ = db.command;
          const urlBatch = await db.collection('MeituanOnsiteCouponURL').where({ actId: _.in(actIds) }).get();
          const arr = Array.isArray(urlBatch?.data) ? urlBatch.data : [];
          const mapAct = {};
          for (const d of arr) {
            const m = d.referralLinkMap || d.linkMap || d.urlMap || (d.links && d.links.referralLinkMap) || {};
            if (d.actId && m && Object.keys(m).length > 0) mapAct[String(d.actId)] = m;
          }
          normalized = (normalized || []).map(x => ({ ...x, referralLinkMap: mapAct[String(x.actId)] || x.referralLinkMap || {} }));
          console.debug('[coupon] 预填平台banner链接完成，数量：', Object.keys(mapAct).length);
        }
      } catch (eFill) {
        console.warn('[coupon] 预填平台banner链接失败：', eFill);
      }

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
      list[idx].headUrl = cloudImageManager.getPlaceholderUrlSync();
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
        let logo = cloudImageManager.getPlaceholderUrlSync();
        for (const c of candidates) {
          if (typeof c === 'string' && c.trim()) { logo = c; break; }
        }
        if (typeof logo === 'string') {
          logo = logo.replace(/`/g, '').trim();
          if (logo.startsWith('http://')) logo = 'https://' + logo.slice(7);
        }
        return { name, logo };
      }).filter(x => !!x.name);

      console.debug('[品牌区] 从云端读取的品牌原始列表（name->logo，总数=', brands.length, '）：', brands.map(x => ({ name: x.name, logo: x.logo })));

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
              return { ...x, logo: (temp && temp.indexOf('http') === 0) ? temp : cloudImageManager.getPlaceholderUrlSync() };
            }
            return x;
          });
          console.debug('[品牌区] 云logo转HTTPS结果：', brands.map(x => ({ name: x.name, logo: x.logo })));
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
  // 从云函数读取红包领券列表，并映射为 UI 卡片
  async loadRedPacketCouponsList() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getRedPacketCouponsList', data: { page: 1, pageSize: 40, priceCap: 100 } });
      let list = (res.result && (Array.isArray(res.result.list) ? res.result.list : (Array.isArray(res.result.items) ? res.result.items : []))) || [];
      // 前端兜底：过滤价格上限（单位：元），同时约束 sellPrice 与 originalPrice
      const cap = 100;
      list = list.filter(it => {
        const sp = Number(it?.sellPrice || 0);
        const op = Number(it?.originalPrice || 0);
        const hasSp = sp > 0;
        const hasOp = op > 0;
        if (hasSp && hasOp) return sp <= cap && op <= cap;
        if (hasSp && !hasOp) return sp <= cap;
        if (!hasSp && hasOp) return op <= cap;
        return false;
      });
      this.setData({ redPacketItems: list });
      if (this.data.selectedCategory === 'coupon') {
        this.setData({ couponPages: this.paginateCoupons(list, 4) });
      }
    } catch (err) {
      console.error('[getRedPacketCouponsList] failed', err);
    }
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
});