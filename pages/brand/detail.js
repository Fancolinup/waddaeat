// pages/brand/detail.js
const restaurantData = require('../../restaurant_data.js');

Page({
  data: {
    brandName: '',
    brandLogo: '/images/placeholder.png',
    products: [],
    userLocation: null,
    loading: true,
    error: '',
    hasInitProducts: false
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

    // 从上页通过 eventChannel 传入的商品列表（若有则直接渲染，并跳过 fetchProducts）
    try {
      const channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
      channel && channel.on && channel.on('initData', (payload) => {
        const arr = Array.isArray(payload && payload.products) ? payload.products : [];
        console.info('[品牌详情] 接收到上页传入商品数量', arr.length);
        if (arr.length) {
          this.setData({ products: arr, loading: false, hasInitProducts: true });
        }
      });
    } catch (e) { console.warn('[品牌详情] 绑定 eventChannel 失败', e); }

    // 从本地缓存读取位置（不强制选择）
    let loc = null;
    try { loc = wx.getStorageSync('userLocation'); } catch(e) {}
    this.setData({ userLocation: loc || null });

    // 若未通过 eventChannel 传入商品，则拉取
    if (!Array.isArray(this.data.products) || !this.data.products.length) {
      this.fetchProducts();
    }
  },

  initBrandLogo(name) {
    try {
      const map = restaurantData && restaurantData.pinyinMap ? restaurantData.pinyinMap : null;
      const slug = map && name ? (map[name] || 'placeholder') : 'placeholder';
      const { cloudImageManager } = require('../../utils/cloudImageManager.js');
      // 优先使用带降级的异步方法，确保缺图走占位图
      cloudImageManager.getImageUrlWithFallback(slug).then((url) => {
        let final = url || '/images/placeholder.png';
        if (typeof final === 'string' && final.startsWith('http://')) {
          final = 'https://' + final.slice(7);
        }
        this.setData({ brandLogo: final });
      }).catch(() => {
        // 回退同步占位图
        try {
          this.setData({ brandLogo: cloudImageManager.getCloudImageUrlSync('placeholder', 'png') });
        } catch (e2) {
          this.setData({ brandLogo: '/images/placeholder.png' });
        }
      });
    } catch (e) {
      this.setData({ brandLogo: '/images/placeholder.png' });
    }
  },

  async fetchProducts() {
    const name = this.data.brandName;
    if (!name) { this.setData({ loading: false, error: '无品牌名' }); return; }
    // 如果事件通道已初始化商品，避免覆盖
    if (this.data.hasInitProducts) { this.setData({ loading: false }); return; }
    try {
      console.info('[品牌详情] 从数据库读取品牌商品', { brandName: name });
      const db = wx.cloud.database();
      const { data } = await db.collection('MeituanBrandCoupon').where({ brandName: name }).get();
      console.info('[品牌详情] 数据库查询返回条数', Array.isArray(data) ? data.length : -1);
      const doc = Array.isArray(data) && data.length > 0 ? data[0] : null;
      const items = Array.isArray(doc?.items) ? doc.items : [];
      const list = items.map(it => {
        const raw = it && it.raw ? it.raw : null;
        const brandInfo = raw && raw.brandInfo ? raw.brandInfo : null;
        const detail = raw && raw.couponPackDetail ? raw.couponPackDetail : null;
        const timeInfo = raw && raw.couponValidTimeInfo ? raw.couponValidTimeInfo : null;

        // 统一的数值解析（支持字符串数字）
        const parseNum = (v) => {
          const n = (typeof v === 'string') ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
          return isFinite(n) ? n : 0;
        };

        let skuViewId = it?.skuViewId || (detail && detail.skuViewId) || '';
        let name1 = (detail && detail.name) || it?.title || '';
        let headUrl = (detail && detail.headUrl) || it?.imgUrl || '';
        let originalPrice = parseNum((detail && detail.originalPrice) || it?.originalPrice || it?.originPrice);
        let sellPrice = parseNum((detail && detail.sellPrice) || it?.sellPrice || it?.price || it?.currentPrice);
        let endStr = timeInfo && timeInfo.couponValidETime ? timeInfo.couponValidETime : '';

        if (typeof headUrl === 'string' && headUrl.startsWith('http://')) {
          headUrl = 'https://' + headUrl.slice(7);
        }
        const itemObj = {
          skuViewId,
          name: name1,
          headUrl,
          originalPrice,
          sellPrice
          // 不再显示截止日期
        };
        // 若原始数据包含品牌名，回填一次（不覆盖用户手动传入）
        if (brandInfo && typeof brandInfo.brandName === 'string' && brandInfo.brandName.length) {
          try {
            this.setData({ brandName: brandInfo.brandName });
          } catch (e) {}
        }
        return itemObj;
      }).filter(x => !!x.skuViewId);

      console.info('[品牌详情] 数据库解析完成，条数', list.length);
      // 当数据库没有商品时，回退实时拉取
      if (!list.length) {
        try {
          console.info('[品牌详情] 数据库为空，回退调用云函数 getMeituanCoupon', { platform: 1, searchText: name });
          const res = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 1, searchText: name } });
          console.info('[品牌详情] 云函数响应 result', res && res.result);
          const result = res && res.result;
          let realtime = this.transformProducts(result);
          console.info('[品牌详情] 实时解析完成，条数', realtime.length);
          // 批量转换 cloud:// 头图为临时HTTPS
          try {
            const fileIds2 = realtime.filter(x => typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0).map(x => x.headUrl);
            if (fileIds2.length && wx.cloud && wx.cloud.getTempFileURL) {
              console.info('[品牌详情] 请求临时文件URL数量', fileIds2.length);
              const r3 = await wx.cloud.getTempFileURL({ fileList: fileIds2 });
              const m3 = {};
              const fl3 = (r3 && r3.fileList) || [];
              for (const item of fl3) { if (item && item.fileID) m3[item.fileID] = item.tempFileURL || ''; }
              realtime = realtime.map(x => {
                if (typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0) {
                  const tmp3 = m3[x.headUrl];
                  return { ...x, headUrl: (tmp3 && tmp3.indexOf('http') === 0) ? tmp3 : '/images/placeholder.png' };
                }
                return x;
              });
              console.info('[品牌详情] 临时URL转换完成');
            }
          } catch (e3) {
            console.warn('[品牌详情] 临时URL转换失败', e3);
          }
          // 事件通道已初始化，避免覆盖
          if (this.data.hasInitProducts) { this.setData({ loading: false }); return; }
          // 避免覆盖为零条记录
          if (!realtime || !realtime.length) { this.setData({ loading: false }); return; }
          this.setData({ products: realtime, loading: false });
          return;
        } catch (e2) {
          console.warn('[品牌详情] 实时拉取失败', e2);
        }
      }

      // 事件通道已初始化，避免覆盖
      if (this.data.hasInitProducts) { this.setData({ loading: false }); return; }
      this.setData({ products: list, loading: false });
    } catch (err) {
      console.warn('[品牌详情] 读取商品失败：', err);
      this.setData({ loading: false, error: '加载失败' });
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

  resolveWeappLink(mapOrValue) {
    try {
      const v = mapOrValue;
      if (!v) return null;
      const tryObj = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const appId = obj.appId || obj.appID || obj.appid || 'wxde8ac0a21135c07d';
        const path = obj.path || obj.miniPath || obj.weappPath || obj.miniProgramPath || '';
        return path ? { appId, path } : null;
      };
      if (typeof v === 'string') {
        const s = v.trim();
        if (!s) return null;
        if (s.indexOf('path=') >= 0) {
          const path = s.split('path=')[1] || '';
          return { appId: 'wxde8ac0a21135c07d', path };
        }
        // 将整段字符串视为小程序路径
        return { appId: 'wxde8ac0a21135c07d', path: s };
      }
      if (typeof v === 'object') {
        const direct = tryObj(v);
        if (direct) return direct;
        const candidates = [v['4'], v[4], v.weapp, v.mini, v.miniProgram, v.mini_program, v.weappLink, v.miniPath, v.weappPath, v.miniProgramPath].filter(Boolean);
        for (const c of candidates) {
          const r = typeof c === 'string' ? this.resolveWeappLink(c) : (tryObj(c) || this.resolveWeappLink(c));
          if (r) return r;
        }
        const arrays = [v.linkList, v.links, v.referralLinks, v.items, v.list].filter(arr => Array.isArray(arr));
        for (const arr of arrays) {
          for (const item of arr) {
            if (!item) continue;
            const isType4 = item.linkType === 4 || item.link_type === 4 || String(item.linkType) === '4';
            if (isType4) {
              const r = this.resolveWeappLink(item.link || item.value || item);
              if (r) return r;
            }
          }
        }
        if (v.urlMap && (v.urlMap['4'] || v.urlMap[4])) {
          return this.resolveWeappLink(v.urlMap['4'] || v.urlMap[4]);
        }
      }
      return null;
    } catch (e) { return null; }
  },
  async onProductTap(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.products[idx];
    if (!item || !item.skuViewId) return;
    const skuViewId = String(item.skuViewId).trim();
    const brandName = this.data.brandName;
    console.info('[品牌详情][调试] 点击商品', { idx, skuViewId, brandName });
    try {
      const directMap = (item && typeof item.referralLinkMap === 'object') ? item.referralLinkMap : null;
      const directResolved = this.resolveWeappLink(directMap);
      if (directResolved && wx?.navigateToMiniProgram) {
        const { appId, path } = directResolved;
        wx.navigateToMiniProgram({ appId: appId || 'wxde8ac0a21135c07d', path: path || '', envVersion: 'release',
          fail: (err) => { console.warn('[品牌详情] 跳转美团小程序失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
        });
        return;
      }

      const db = wx.cloud.database();
      let map = null;
      let matchMeta = null;
      try {
        const { data: brandDocs } = await db.collection('MeituanBrandCouponURL').where({ brandName }).get();
        const docs = Array.isArray(brandDocs) ? brandDocs : [];
        for (const d of docs) {
          const dSku = String((d && d.skuViewId) ? d.skuViewId : '').trim();
          const candidate = (d && typeof d.linkMap === 'object') ? d.linkMap : ((d && typeof d.referralLinkMap === 'object') ? d.referralLinkMap : null);
          if (candidate && dSku && dSku === skuViewId) { map = candidate; matchMeta = { source: (d && typeof d.linkMap === 'object') ? 'linkMap' : 'referralLinkMap', docId: d && d._id }; break; }
        }
        if (!map) {
          for (const d of docs) {
            const urlMap = d && typeof d.urlMap === 'object' ? d.urlMap : null;
            if (urlMap && urlMap[skuViewId]) { map = urlMap[skuViewId]; matchMeta = { source: 'urlMap', docId: d && d._id, key: skuViewId }; break; }
          }
        }
      } catch (e0) {}
      if (!map) {
        try {
          const { data: skuDocs } = await db.collection('MeituanBrandCouponURL').where({ skuViewId }).get();
          const skuDoc = Array.isArray(skuDocs) && skuDocs.length > 0 ? skuDocs[0] : null;
          const linkMap = skuDoc && typeof skuDoc.linkMap === 'object' ? skuDoc.linkMap : null;
          if (linkMap) { map = linkMap; matchMeta = { source: 'direct_by_skuViewId', docId: skuDoc && skuDoc._id }; }
        } catch (e1) {}
      }
      if (!map) {
        try {
          const lr = await wx.cloud.callFunction({ name: 'getMeituanReferralLink', data: { skuViewId } });
          const root = lr?.result?.data || lr?.result || {};
          const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;
          const candidate = dataRoot?.referralLinkMap || dataRoot?.linkMap || dataRoot?.urlMap || null;
          if (candidate) { map = candidate; matchMeta = { source: 'cloud_function_getMeituanReferralLink' }; }
        } catch (e2) {}
      }

      const resolved = this.resolveWeappLink(map);
      console.info('[品牌详情][跳转检查] 解析小程序链接', { hasLink: !!resolved, matchMeta, mapKeys: map && typeof map === 'object' ? Object.keys(map) : (typeof map) });
      if (resolved && wx?.navigateToMiniProgram) {
        const { appId, path } = resolved;
        wx.navigateToMiniProgram({ appId: appId || 'wxde8ac0a21135c07d', path: path || '', envVersion: 'release',
          fail: (err) => { console.warn('[品牌详情] 跳转美团小程序失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
        });
        return;
      }

      console.warn('[品牌详情][调试] 未找到 linkType=4 小程序链接', { skuViewId, brandName, matchMeta });
      wx.showToast({ title: '暂无可用小程序链接', icon: 'none' });
    } catch (err) {
      console.warn('[品牌详情] 跳转处理失败', err);
      wx.showToast({ title: '推广服务暂不可用', icon: 'none' });
    }
  },
});