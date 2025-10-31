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
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('MeituanBrandCoupon').where({ brandName: name }).get();
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

      // 当数据库没有商品时，回退实时拉取
      if (!list.length) {
        try {
          const res = await wx.cloud.callFunction({ name: 'getMeituanCoupon', data: { platform: 1, searchText: name } });
          const result = res && res.result;
          let realtime = this.transformProducts(result);
          // 批量转换 cloud:// 头图为临时HTTPS
          try {
            const fileIds2 = realtime.filter(x => typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0).map(x => x.headUrl);
            if (fileIds2.length && wx.cloud && wx.cloud.getTempFileURL) {
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
            }
          } catch (e3) {
            console.warn('[品牌详情] 实时商品云图转HTTPS失败', e3);
            realtime = realtime.map(x => (typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0) ? { ...x, headUrl: '/images/placeholder.png' } : x);
          }
          this.setData({ products: realtime });
          // 尝试用实时结果设置品牌logo
          const logoCandidate2 = realtime.length ? realtime[0].brandLogoUrl : '';
          if (typeof logoCandidate2 === 'string' && logoCandidate2.length) {
            const cleaned2 = logoCandidate2.startsWith('http://') ? ('https://' + logoCandidate2.slice(7)) : logoCandidate2;
            this.setData({ brandLogo: cleaned2.replace(/`/g, '').trim() });
          }
        } catch (eRT) {
          console.warn('[品牌详情] DB无商品，调用云函数实时拉取失败：', eRT);
        }
      }

      // 批量转换 cloud:// 头图为临时HTTPS（数据库已有商品时）
      try {
        const fileIds = list.filter(x => typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0).map(x => x.headUrl);
        if (fileIds.length && wx.cloud && wx.cloud.getTempFileURL) {
          const res2 = await wx.cloud.getTempFileURL({ fileList: fileIds });
          const map2 = {};
          const fl = (res2 && res2.fileList) || [];
          for (const item of fl) { if (item && item.fileID) map2[item.fileID] = item.tempFileURL || ''; }
          const patched = list.map(x => {
            if (typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0) {
              const tmp = map2[x.headUrl];
              return { ...x, headUrl: (tmp && tmp.indexOf('http') === 0) ? tmp : '/images/placeholder.png' };
            }
            return x;
          });
          // 若上面实时回退已设置 products，这里只在 products 仍为空时设置
          if (!Array.isArray(this.data.products) || !this.data.products.length) {
            this.setData({ products: patched });
          }
        } else {
          if (!Array.isArray(this.data.products) || !this.data.products.length) {
            this.setData({ products: list });
          }
        }
      } catch (e2) {
        console.warn('[品牌详情] 头图云链接转换失败，使用占位图替换cloud://', e2);
        const patched = list.map(x => (typeof x.headUrl === 'string' && x.headUrl.indexOf('cloud://') === 0) ? { ...x, headUrl: '/images/placeholder.png' } : x);
        if (!Array.isArray(this.data.products) || !this.data.products.length) {
          this.setData({ products: patched });
        }
      }

      // 尝试从文档或首个商品的brandInfo设置品牌logo
      let logo = this.data.brandLogo;
      if (doc && typeof doc.brandLogo === 'string' && doc.brandLogo) {
        let cleaned = doc.brandLogo.startsWith('http://') ? ('https://' + doc.brandLogo.slice(7)) : doc.brandLogo;
        cleaned = cleaned.replace(/`/g, '').trim();
        logo = cleaned || logo;
      } else if (items.length) {
        const raw0 = items[0] && items[0].raw ? items[0].raw : null;
        let logoCandidate = raw0 && raw0.brandInfo && raw0.brandInfo.brandLogoUrl;
        if (typeof logoCandidate === 'string' && logoCandidate.length) {
          if (logoCandidate.startsWith('http://')) logoCandidate = 'https://' + logoCandidate.slice(7);
          logoCandidate = logoCandidate.replace(/`/g, '').trim();
          logo = logoCandidate || logo;
        }
      }
      this.setData({ brandLogo: logo });

      this.setData({ loading: false, error: (this.data.products && this.data.products.length) ? '' : '暂无可用商品' });
    } catch (err) {
      console.warn('[品牌详情] 读取云端商品失败：', err);
      this.setData({ loading: false, error: err.message || '读取失败' });
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
    const skuViewId = String(item.skuViewId).trim();
    const brandName = this.data.brandName;
    console.info('[品牌详情][调试] 点击商品', { idx, skuViewId, brandName });
    try {
      const db = wx.cloud.database();
      // 优先读取品牌聚合文档中的精确匹配（遍历同品牌所有文档，避免只取第一条导致漏匹配）
      let map = null;
      let matchMeta = null;
      try {
        const { data: brandDocs } = await db.collection('MeituanBrandCouponURL').where({ brandName }).get();
        const docs = Array.isArray(brandDocs) ? brandDocs : [];
        // 1) 先从每条文档的 linkMap/referralLinkMap，按文档的 skuViewId 精确匹配
        for (const d of docs) {
          const dSku = String((d && d.skuViewId) ? d.skuViewId : '').trim();
          const candidate = (d && typeof d.linkMap === 'object') ? d.linkMap : ((d && typeof d.referralLinkMap === 'object') ? d.referralLinkMap : null);
          if (candidate && dSku && dSku === skuViewId) { 
            map = candidate; 
            matchMeta = { source: (d && typeof d.linkMap === 'object') ? 'linkMap' : 'referralLinkMap', docId: d && d._id };
            console.info('[品牌详情][调试] 命中文档（精确）', matchMeta);
            break; 
          }
        }
        // 2) 再从品牌聚合 urlMap 中按 skuViewId 命中（若存在）
        if (!map) {
          for (const d of docs) {
            const urlMap = d && typeof d.urlMap === 'object' ? d.urlMap : null;
            if (urlMap && urlMap[skuViewId]) { 
              map = urlMap[skuViewId]; 
              matchMeta = { source: 'urlMap', docId: d && d._id, key: skuViewId };
              console.info('[品牌详情][调试] 命中文档（urlMap）', matchMeta);
              break; 
            }
          }
        }
        // 3) 仍未命中：不再使用品牌级回退
      } catch (e0) {}
      // 兼容每个 skuViewId 一条记录的写法（单独按 skuViewId 查询）
      if (!map) {
        try {
          const { data: skuDocs } = await db.collection('MeituanBrandCouponURL').where({ skuViewId }).get();
          const skuDoc = Array.isArray(skuDocs) && skuDocs.length > 0 ? skuDocs[0] : null;
          const linkMap = skuDoc && typeof skuDoc.linkMap === 'object' ? skuDoc.linkMap : null;
          if (linkMap) { 
            map = linkMap; 
            matchMeta = { source: 'direct_by_skuViewId', docId: skuDoc && skuDoc._id };
            console.info('[品牌详情][调试] 命中文档（直接按 skuViewId）', matchMeta);
          }
        } catch (e1) {}
      }

      // 默认并仅使用美团小程序链接（linkType=4）进行跳转
      const weapp = map && (map['4'] || map[4]);
      if (weapp) {
        console.info('[品牌详情][调试] 准备跳转', { matchMeta, weappType: typeof weapp, weappPreview: (typeof weapp === 'object') ? { appId: (weapp.appId || 'wxde8ac0a21135c07d'), path: weapp.path || '' } : (typeof weapp === 'string' ? weapp.trim() : weapp) });
        // 对象类型：包含 appId/path，直接以对象参数跳转；若缺少 appId 则使用美团固定 appId
        if (wx?.navigateToMiniProgram && typeof weapp === 'object') {
          const info = weapp || {};
          const appId = info.appId || 'wxde8ac0a21135c07d';
          console.info('[品牌详情][调试] 以对象跳转', { appId, path: info.path || '' });
          wx.navigateToMiniProgram({ appId, path: info.path || '', envVersion: 'release',
            fail: (err) => { console.warn('[品牌详情] 跳转美团小程序失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
          });
          return;
        }
        // 字符串类型：内部路径或短链
        if (typeof weapp === 'string') {
          const s = weapp.trim();
          if (s.startsWith('/')) {
            // 视为美团小程序内部页面路径，带 appId 跳转
            if (wx?.navigateToMiniProgram) {
              console.info('[品牌详情][调试] 以内部 path 跳转', { appId: 'wxde8ac0a21135c07d', path: s });
              wx.navigateToMiniProgram({ appId: 'wxde8ac0a21135c07d', path: s, envVersion: 'release',
                fail: (err) => { console.warn('[品牌详情] 跳转美团小程序失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
              });
              return;
            }
          } else {
            // 视为短链
            if (wx?.navigateToMiniProgram) {
              console.info('[品牌详情][调试] 以 shortLink 跳转', { shortLink: s });
              wx.navigateToMiniProgram({ shortLink: s, envVersion: 'release',
                fail: (err) => { console.warn('[品牌详情] 跳转美团小程序失败', err); wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' }); }
              });
              return;
            }
          }
        }
      }

      console.warn('[品牌详情][调试] 未找到 linkType=4 小程序链接', { skuViewId, brandName, matchMeta });
      // 无可用小程序链接时提示，不再使用/引导 deeplink
      wx.showToast({ title: '暂无可用小程序链接', icon: 'none' });
    } catch (err) {
      console.warn('[品牌详情] 读取推广链接失败：', err);
      wx.showToast({ title: '推广服务暂不可用', icon: 'none' });
    }
  },
});