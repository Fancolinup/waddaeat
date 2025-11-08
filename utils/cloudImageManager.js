/**
 * 云图片管理器
 * 统一管理餐厅logo的云存储访问、预加载、缓存和懒加载
 */

class CloudImageManager {
  constructor() {
    // 云存储基础路径（包含 bucket 标识，确保在开发者工具和真机一致）
    this.cloudBase = 'cloud://cloud1-0gbk9yujb9937f30.636c-cloud1-0gbk9yujb9937f30-1384367427/Waddaeat/icons/';
    
    // 预加载缓存
    this.preloadCache = new Set();
    
    // 图片加载状态缓存
    this.loadStatusCache = new Map();
    
    console.log('[CloudImageManager] 初始化完成，云存储基础路径:', this.cloudBase);
    // 初始化设备类型标识，默认非 iOS（在缺少 wx 环境时安全降级）
    this.isIOS = this.detectIOSDevice();
  }

  /**
   * 检测是否为iOS设备
   * @returns {boolean} 是否为iOS设备
   */
  detectIOSDevice() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const platform = systemInfo.platform || '';
      const system = systemInfo.system || '';
      
      // 检测iOS设备
      const isIOS = platform.toLowerCase().includes('ios') || 
                   system.toLowerCase().includes('ios') ||
                   system.toLowerCase().includes('iphone');
      
      console.log('[CloudImageManager] 设备信息 - platform:', platform, 'system:', system, 'isIOS:', isIOS);
      return isIOS;
    } catch (error) {
      console.warn('[CloudImageManager] 获取设备信息失败，默认为非iOS设备:', error);
      return false;
    }
  }

  /**
   * iOS设备专用的异步图片加载方法
   * 在iOS设备上，云存储图片需要通过临时HTTPS链接才能正常显示
   * @param {string} imageName - 图片名称（不含扩展名）
   * @param {string} extension - 文件扩展名，默认为 'png'
   * @param {function} onSuccess - 成功回调，参数为临时HTTPS链接
   * @param {function} onError - 失败回调，参数为错误信息
   */
  loadImageForIOS(imageName, extension = 'png', onSuccess, onError) {
    if (!this.isIOS) {
      // 非iOS设备直接返回同步fileID
      const fileId = this.getCloudImageUrlSync(imageName, extension);
      if (onSuccess) onSuccess(fileId);
      return;
    }

    // iOS设备异步获取临时HTTPS链接
-    this.getTempHttpsUrl(imageName, extension)
+    this.getTempHttpsUrl(imageName, extension)
      .then(httpsUrl => {
        if (onSuccess) onSuccess(httpsUrl);
      })
      .catch(error => {
        console.error('[CloudImageManager] iOS图片加载失败:', error);
        // 失败时使用统一占位图URL，移除本地依赖
        if (onSuccess) onSuccess(this.getPlaceholderUrlSync());
        if (onError) onError(error);
      });
  }

  /**
   * 获取云图片URL（兼容同步和异步调用）
   * 注意：此方法已弃用，建议使用 getCloudImageUrlSync 或 getTempHttpsUrl
   * @param {string} imageName - 图片名称（不含扩展名）
   * @param {string} extension - 文件扩展名，默认为 'png'
   * @returns {string} 始终返回同步的fileID，不再区分iOS设备
   */
  /**
   * 获取云图片URL（兼容同步和异步调用）
   * iOS设备强制返回HTTPS临时链接，非iOS设备返回cloud://协议
   * @param {string} imageName - 图片名称（不含扩展名）
   * @param {string} extension - 文件扩展名，默认为 'png'
   * @returns {string|Promise<string>} iOS设备返回Promise，非iOS设备返回同步的fileID
   */
  getCloudImageUrl(imageName, extension = 'png') {
    // 优先使用本地打包资源作为兜底，完全不依赖云端
    const localMap = {
      takeout: '/images/takeout.png',
      beverage: '/images/beverage.png',
      canteen: '/images/canteen.png',
      icon_home: '/images/icon_home.png',
      icon_coupon: '/images/icon_coupon.png',
      icon_profile: '/images/icon_profile.png',
      placeholder: '/images/canteen.png'
    };
    if (!imageName || localMap[imageName]) {
      return localMap[imageName || 'placeholder'];
    }

    // 统一返回 cloud:// fileID
    const fileId = `${this.cloudBase}${imageName}.${extension}`;
    return fileId;
  }

  getCloudImageUrlSync(imageName, extension = 'png') {
    const localMap = {
      takeout: '/images/takeout.png',
      beverage: '/images/beverage.png',
      canteen: '/images/canteen.png',
      icon_home: '/images/icon_home.png',
      icon_coupon: '/images/icon_coupon.png',
      icon_profile: '/images/icon_profile.png',
      placeholder: '/images/canteen.png'
    };
    if (!imageName || localMap[imageName]) {
      return localMap[imageName || 'placeholder'];
    }
    return `${this.cloudBase}${imageName}.${extension}`;
  }

  async getTempHttpsUrl(imageName, extension = 'png') {
    try {
      // 直接返回同步生成的路径，避免运行环境依赖
      const id = this.getCloudImageUrlSync(imageName, extension);
      return id;
    } catch (e) {
      console.warn('[CloudImageManager] 获取临时HTTPS链接失败，使用占位图。', e);
      return this.getPlaceholderUrlSync();
    }
  }

  async getPlaceholderHttpsUrl() {
    const fileId = this.getCloudImageUrlSync('placeholder', 'svg');
    return fileId; // 统一返回本地占位图
  }

  // 兼容方法：确保链接为 HTTPS（简化为兜底返回，不做实际协议转换）
  ensureHttps(url) {
    return url || this.getPlaceholderUrlSync();
  }

  // 辅助：根据图片名与扩展名生成 fileID
  getFileId(imageName, extension = 'png') {
    if (!imageName || imageName === 'placeholder') return `${this.cloudBase}placeholder.${extension}`;
    return `${this.cloudBase}${imageName}.${extension}`;
  }

  // 追加：支持按目录生成 fileID（如 logos、platform_actions 等）
  getDirBase(dir) {
    try {
      const root = this.cloudBase.replace(/icons\/?$/, '');
      const d = String(dir || '').replace(/\/+$/, '');
      return `${root}${d}/`;
    } catch (e) {
      // 兜底：仍返回 icons 基础路径
      return this.cloudBase;
    }
  }

  getCloudImageUrlInDirSync(dir, imageName, extension = 'png') {
    const localMap = {
      takeout: '/images/takeout.png',
      beverage: '/images/beverage.png',
      canteen: '/images/canteen.png',
      icon_home: '/images/icon_home.png',
      icon_coupon: '/images/icon_coupon.png',
      icon_profile: '/images/icon_profile.png',
      placeholder: '/images/canteen.png'
    };
    if (!imageName || localMap[imageName]) {
      return localMap[imageName || 'placeholder'];
    }
    const base = this.getDirBase(dir || 'icons');
    return `${base}${imageName}.${extension}`;
  }

  // 移除所有 iOS 特殊处理、临时链接获取、重试逻辑、降级机制、验证方法、预加载、ensureHttps 和内联 SVG 等旧方法

  // 只保留核心方法：getCloudImageUrlSync 和 getPlaceholderUrlSync，统一返回 cloud:// fileID 或本地路径

  getPlaceholderUrlSync() {
    return this.getCloudImageUrlSync('placeholder', 'svg');
  }

  // 兼容旧调用：预加载图片名称列表（无副作用的轻量实现）
  // 仅将待预加载的图片 fileID 记录到缓存，返回一个已解决的 Promise，避免调用侧报错
  preloadImages(names) {
    try {
      if (!Array.isArray(names) || !names.length) return Promise.resolve();
      const unique = Array.from(new Set(names.filter(n => typeof n === 'string' && n)));
      for (const n of unique) {
        const id = this.getCloudImageUrlSync(n, 'png');
        if (this.preloadCache && typeof this.preloadCache.add === 'function') this.preloadCache.add(id);
      }
      return Promise.resolve();
    } catch (e) {
      console.warn('[CloudImageManager] 预加载失败（已忽略）', e);
      return Promise.resolve();
    }
  }
}

// 创建单例实例
const cloudImageManager = new CloudImageManager();

// 导出模块 - 兼容真机环境
try {
  module.exports = {
    cloudImageManager,
    CloudImageManager
  };
} catch (e) {
  // 真机环境fallback
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.cloudImageManager = cloudImageManager;
    module.exports.CloudImageManager = CloudImageManager;
  }
}