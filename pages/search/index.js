// pages/search/index.js
Page({
  data: {
    inputText: '',
    results: [],
    autoFocus: true
  },
  onShow() {
    wx.nextTick(() => this.setData({ autoFocus: true }));
  },
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  async onConfirm() {
    const q = (this.data.inputText || '').trim();
    console.debug('[search] onConfirm keyword:', q);
    if (!q) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '搜索中', mask: true });
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const tasks = [];
      // 修复：RegExp 参数必须使用 regexp 字段；并做正则安全转义+模糊匹配
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = db.RegExp({ regexp: `.*${escaped}.*`, options: 'i' });
      console.debug('[search] db.RegExp:', reg);
      tasks.push(db.collection('MeituanBrandCoupon').where({ brandName: reg }).limit(40).get());
      tasks.push(db.collection('MeituanOnsiteCoupon').where({ brandName: reg }).limit(40).get());
      const res = await Promise.all(tasks);
      console.debug('[search] raw query results size:', res.map(r => (r && Array.isArray(r.data) ? r.data.length : 0)));
      const all = [];
      for (const r of res) {
        const arr = (r && Array.isArray(r.data)) ? r.data : [];
        for (const it of arr) {
          // 展开品牌聚合文档中的 items（如马记永的多商品）
          if (Array.isArray(it.items) && it.items.length > 0) {
            for (const child of it.items) {
              const normalizedChild = {
                _id: child._id || `${it._id}-${child.skuViewId || child.name || Math.random()}`,
                name: child.name || child.title || (child.raw && child.raw.couponPackDetail && child.raw.couponPackDetail.name) || it.name || it.brandName || '',
                brandName: child.brandName || (child.raw && child.raw.brandInfo && child.raw.brandInfo.brandName) || it.brandName || '',
                headUrl: child.headUrl || (child.raw && child.raw.couponPackDetail && child.raw.couponPackDetail.headUrl) || it.headUrl || cloudImageManager.getPlaceholderUrlSync(),
                sellPrice: child.sellPrice || (child.raw && child.raw.couponPackDetail && child.raw.couponPackDetail.sellPrice) || '',
                originalPrice: child.originalPrice || (child.raw && child.raw.couponPackDetail && child.raw.couponPackDetail.originalPrice) || '',
                label1: child.label1 || (child.raw && child.raw.productLabel && (child.raw.productLabel.historyPriceLabel || child.raw.productLabel.beatMTLabel)) || '',
                skuViewId: child.skuViewId || '',
                actId: child.actId || it.actId || '',
                referralLinkMap: child.referralLinkMap || child.linkMap || child.urlMap || it.referralLinkMap || it.linkMap || it.urlMap || (it.links && it.links.referralLinkMap) || {},
              };
              all.push(normalizedChild);
            }
            continue;
          }
          const normalized = {
            _id: it._id,
            name: it.name || it.brandName || (it.raw && it.raw.name) || '',
            brandName: it.brandName || '',
            headUrl: (it.headUrl || it.image || (it.raw && it.raw.headUrl)) || cloudImageManager.getPlaceholderUrlSync(),
            sellPrice: it.sellPrice || (it.price && it.price.sell) || '',
            originalPrice: it.originalPrice || (it.price && it.price.original) || '',
            label1: it.label1 || it.promotion || '',
            skuViewId: it.skuViewId || it.skuId || '',
            actId: it.actId || '',
            referralLinkMap: it.referralLinkMap || it.linkMap || it.urlMap || (it.links && it.links.referralLinkMap) || {},
          };
          all.push(normalized);
        }
      }
      console.debug('[search] normalized results size:', all.length);
      try {
        const uniqBrands = Array.from(new Set(all.map(x => x.brandName).filter(Boolean)));
        const uniqActIds = Array.from(new Set(all.map(x => x.actId).filter(Boolean)));
        console.debug('[search] uniqBrands:', uniqBrands, 'uniqActIds:', uniqActIds);
        const urlFetchTasksBrand = [
          ...uniqBrands.map(bn => db.collection('MeituanBrandCouponURL').where({ brandName: bn }).limit(1).get()),
          ...uniqBrands.map(bn => db.collection('MeituanOnsiteCouponURL').where({ brandName: bn }).limit(1).get()),
        ];
        const urlResBrand = await Promise.all(urlFetchTasksBrand);
        const brandUrlMap = new Map();
        for (const ur of urlResBrand) {
          const d = (ur && Array.isArray(ur.data)) ? ur.data[0] : null;
          if (d && d.brandName) {
            const m = d.referralLinkMap || d.linkMap || d.urlMap || d.links?.referralLinkMap || {};
            if (m && Object.keys(m).length > 0) brandUrlMap.set(d.brandName, m);
          }
        }
        const actIdUrlMap = new Map();
        if (uniqActIds.length > 0) {
          const actBatch = await db.collection('MeituanOnsiteCouponURL').where({ actId: _.in(uniqActIds) }).get();
          const list = (actBatch && Array.isArray(actBatch.data)) ? actBatch.data : [];
          for (const d of list) {
            const m = d.referralLinkMap || d.linkMap || d.urlMap || d.links?.referralLinkMap || {};
            if (d.actId && m && Object.keys(m).length > 0) actIdUrlMap.set(String(d.actId), m);
          }
        }
        for (const x of all) {
          const hasMap = x.referralLinkMap && Object.keys(x.referralLinkMap).length > 0;
          if (!hasMap) {
            const mBrand = x.brandName ? brandUrlMap.get(x.brandName) : null;
            const mAct = x.actId ? actIdUrlMap.get(String(x.actId)) : null;
            x.referralLinkMap = mAct || mBrand || {};
          }
        }
        console.debug('[search] after fill referralLinkMap count:', all.filter(x => x.referralLinkMap && Object.keys(x.referralLinkMap).length > 0).length);
      } catch (eUrl) {
        console.warn('[search] 补充 URL 失败：', eUrl);
      }

      const dedup = [];
      const seen = new Set();
      for (const x of all) {
        const key = String(x.skuViewId || x.actId || x._id || `${x.brandName}-${x.name}`);
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(x);
      }
      console.debug('[search] dedup size:', dedup.length);

      if (dedup.length === 0) {
        wx.showToast({ title: '无结果', icon: 'none' });
        this.setData({ results: [] });
      } else {
        this.setData({ results: dedup });
      }
    } catch (err) {
      console.warn('[search] 搜索失败：', err);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  onResultTap(e) {
    try {
      console.debug('[search] onResultTap:', e);
      const id = e.currentTarget.dataset.id;
      console.debug('[search] tap id:', id);
      const list = Array.isArray(this.data.results) ? this.data.results : [];
      const item = list.find(x => String(x.skuViewId) === String(id) || String(x.actId) === String(id) || String(x._id) === String(id)) || {};
      console.debug('[search] selected item:', item);
      const map = item.referralLinkMap || item.linkMap || item.urlMap || (item.links && item.links.referralLinkMap) || {};
      const weapp = map['4'] || map[4] || map.weapp || map.mini;
      console.debug('[search] referralLinkMap:', map, 'weapp:', weapp);
      if (wx?.navigateToMiniProgram && typeof weapp === 'object' && weapp.appId) {
        console.debug('[search] navigateToMiniProgram object:', weapp);
        wx.navigateToMiniProgram({ appId: weapp.appId, path: weapp.path || '', envVersion: 'release' });
        return;
      }
      if (typeof weapp === 'string' && wx?.navigateToMiniProgram) {
        const s = String(weapp).trim();
        console.debug('[search] navigateToMiniProgram shortLink/path:', s);
        if (s.startsWith('/')) {
          wx.navigateToMiniProgram({ appId: 'wxde8ac0a21135c07d', path: s, envVersion: 'release' });
        } else {
          wx.navigateToMiniProgram({ shortLink: s, envVersion: 'release' });
        }
        return;
      }
      if (item.actId) {
        console.debug('[search] fallback by actId:', item.actId);
        wx.cloud.callFunction({ name: 'getMeituanReferralLink', data: { actId: item.actId } }).then(res => {
          const root = res?.result?.data || {};
          const dataRoot = (root && typeof root === 'object' && root.data && typeof root.data === 'object') ? root.data : root;
          const m = dataRoot?.referralLinkMap || dataRoot?.linkMap || dataRoot?.urlMap || {};
          const wa = m['4'] || m[4] || m.weapp || m.mini;
          console.debug('[search] fallback referralLinkMap:', m, 'weapp:', wa);
          if (wa && typeof wa === 'object' && wa.appId && wx?.navigateToMiniProgram) {
            wx.navigateToMiniProgram({ appId: wa.appId, path: wa.path || '', envVersion: 'release' });
            return;
          }
          if (typeof wa === 'string' && wx?.navigateToMiniProgram) {
            const s2 = String(wa).trim();
            if (s2.startsWith('/')) {
              wx.navigateToMiniProgram({ appId: 'wxde8ac0a21135c07d', path: s2, envVersion: 'release' });
            } else {
              wx.navigateToMiniProgram({ shortLink: s2, envVersion: 'release' });
            }
          }
        }).catch(err => console.warn('[search] 兜底拉取链接失败', err));
      }
    } catch (err) {
      console.warn('[search] 结果跳转失败：', err);
    }
  },
  // 重复的 onResultTap 已移除，避免与上面的实现冲突
});
const { cloudImageManager } = require('../../utils/cloudImageManager');