/**
 * 云图片管理器
 * 统一管理餐厅logo的云存储访问、预加载、缓存和懒加载
 */

class CloudImageManager {
  constructor() {
    // 云存储基础路径（包含 bucket 标识，确保在开发者工具和真机一致）
    this.cloudBase = 'cloud://cloud1-4gw154ajfc4d5163.636c-cloud1-4gw154ajfc4d5163-1379600796/FullRest/';
    
    // 预加载缓存
    this.preloadCache = new Set();
    
    // 图片加载状态缓存
    this.loadStatusCache = new Map();

    // 临时 HTTPS 链接缓存（fileID -> tempURL）
    this.tempUrlCache = new Map();
    
    // 常用餐厅列表（用于预加载）
    this.popularRestaurants = [
      'haidilao', 'maidanglao', 'kendeji', 'dingtaifeng',
      'xingbake', 'xicha', 'naixuedecha', 'yonghedawang',
      'duxiaoyue', 'xiaolongkan'
    ];
    
    console.log('[CloudImageManager] 初始化完成，云存储基础路径:', this.cloudBase);
  }

  /**
   * 获取云图片URL（返回 fileID）
   * @param {string} imageName - 图片名称（不含扩展名）
   * @param {string} extension - 文件扩展名，默认为 'png'
   * @returns {string} 完整的云存储 fileID
   */
  getCloudImageUrl(imageName, extension = 'png') {
    if (!imageName) {
      const url = `${this.cloudBase}placeholder.${extension}`;
      console.log('[CloudImageManager] imageName为空，使用placeholder:', url);
      return url;
    }
    if (imageName === 'placeholder') {
      const url = `${this.cloudBase}placeholder.${extension}`;
      console.log('[CloudImageManager] 获取placeholder图片URL:', url);
      return url;
    }
    // 直接返回文件ID路径
    const url = `${this.cloudBase}${imageName}.${extension}`;
    console.log('[CloudImageManager] 获取图片URL:', imageName, '->', url);
    return url;
  }

  /**
   * 获取placeholder的临时HTTPS链接，专门用于手动添加餐厅的默认logo
   * @returns {Promise<string>} 临时HTTPS链接或云端fileID
   */
  async getPlaceholderHttpsUrl() {
    try {
      const fileId = this.getCloudImageUrl('placeholder', 'png');
      console.log('[CloudImageManager] 获取placeholder临时链接，fileId:', fileId);
      
      const httpsUrl = await this.getTempHttpsUrl('placeholder', 'png');
      if (httpsUrl && httpsUrl.indexOf('https://') === 0) {
        console.log('[CloudImageManager] 成功获取placeholder临时链接:', httpsUrl);
        return httpsUrl;
      } else {
        console.warn('[CloudImageManager] 临时链接获取失败，返回fileId:', fileId);
        return fileId;
      }
    } catch (error) {
      console.error('[CloudImageManager] 获取placeholder临时链接出错:', error);
      // 返回云端fileId作为备用
      return this.getCloudImageUrl('placeholder', 'png');
    }
  }

  // 辅助：根据图片名与扩展名生成 fileID
  getFileId(imageName, extension = 'png') {
    if (!imageName || imageName === 'placeholder') return `${this.cloudBase}placeholder.${extension}`;
    return `${this.cloudBase}${imageName}.${extension}`;
  }

  /**
   * 将云文件 fileID 转换为临时 HTTPS 链接（带缓存）
   * @param {string} imageName - 图片名称（不含扩展名）
   * @param {string} extension - 扩展名（默认 png）
   * @returns {Promise<string>} 临时 HTTPS 链接
   */
  async getTempHttpsUrl(imageName, extension = 'png') {
    const fileId = this.getFileId(imageName, extension);
    const cached = this.tempUrlCache.get(fileId);
    if (cached) {
      return cached;
    }

    return new Promise((resolve, reject) => {
      try {
        if (!wx.cloud || !wx.cloud.getTempFileURL) {
          console.warn('[CloudImageManager] wx.cloud.getTempFileURL 不可用，回退使用 fileID');
          resolve(fileId);
          return;
        }
        wx.cloud.getTempFileURL({
          fileList: [fileId],
          success: (res) => {
            try {
              const list = res && res.fileList ? res.fileList : [];
              const item = list[0] || {};
              const tempUrl = item.tempFileURL || '';
              if (tempUrl) {
                this.tempUrlCache.set(fileId, tempUrl);
                console.log('[CloudImageManager] 生成临时链接成功:', imageName, extension, '->', tempUrl);
                resolve(tempUrl);
              } else {
                console.warn('[CloudImageManager] 临时链接为空，回退使用 fileID:', fileId);
                resolve(fileId);
              }
            } catch (parseErr) {
              console.warn('[CloudImageManager] 解析临时链接失败，回退 fileID:', parseErr);
              resolve(fileId);
            }
          },
          fail: (error) => {
            console.warn('[CloudImageManager] 获取临时链接失败，回退 fileID:', error);
            resolve(fileId);
          }
        });
      } catch (err) {
        console.warn('[CloudImageManager] getTempHttpsUrl 异常，回退 fileID:', err);
        resolve(fileId);
      }
    });
  }

  /**
   * 预加载图片
   * @param {string|Array} imageNames - 单个图片名或图片名数组
   * @returns {Promise} 预加载Promise
   */
  preloadImages(imageNames) {
    const names = Array.isArray(imageNames) ? imageNames : [imageNames];
    
    const preloadPromises = names.map(name => {
      if (this.preloadCache.has(name)) {
        return Promise.resolve();
      }
      
      return new Promise((resolve, reject) => {
        const imageUrl = this.getCloudImageUrl(name);
        
        // 使用微信小程序的图片预加载API
        wx.getImageInfo({
          src: imageUrl,
          success: () => {
            this.preloadCache.add(name);
            this.loadStatusCache.set(name, 'loaded');
            resolve();
          },
          fail: (error) => {
            console.warn(`预加载图片失败: ${name}`, error);
            this.loadStatusCache.set(name, 'failed');
            // 预加载失败不影响整体流程
            resolve();
          }
        });
      });
    });
    
    return Promise.all(preloadPromises);
  }

  /**
   * 预加载热门餐厅图片
   * @returns {Promise} 预加载Promise
   */
  preloadPopularImages() {
    return this.preloadImages(this.popularRestaurants);
  }

  /**
   * 懒加载图片（带回退机制）
   * @param {string} imageName - 图片名称
   * @param {Function} onSuccess - 成功回调
   * @param {Function} onError - 失败回调
   */
  lazyLoadImage(imageName, onSuccess, onError) {
    const imageUrl = this.getCloudImageUrl(imageName);
    console.log('[CloudImageManager] 开始懒加载图片:', imageName, imageUrl);
    
    // 检查缓存状态
    const cacheStatus = this.loadStatusCache.get(imageName);
    if (cacheStatus === 'loaded') {
      console.log('[CloudImageManager] 图片已缓存:', imageName);
      onSuccess && onSuccess(imageUrl);
      return;
    }
    if (cacheStatus === 'failed') {
      console.log('[CloudImageManager] 图片加载曾失败:', imageName);
      onError && onError();
      return;
    }
    
    // 开始加载
    this.loadStatusCache.set(imageName, 'loading');
    
    wx.getImageInfo({
      src: imageUrl,
      success: (res) => {
        console.log('[CloudImageManager] 图片加载成功:', imageName, res);
        this.loadStatusCache.set(imageName, 'loaded');
        onSuccess && onSuccess(imageUrl);
      },
      fail: (error) => {
        console.error(`[CloudImageManager] 云存储图片加载失败: ${imageName}`, error);
        console.error('[CloudImageManager] 失败的URL:', imageUrl);
        this.loadStatusCache.set(imageName, 'failed');
        onError && onError();
      }
    });
  }

  /**
   * 批量获取图片URL
   * @param {Array} imageNames - 图片名称数组
   * @returns {Array} URL数组
   */
  getBatchImageUrls(imageNames) {
    return imageNames.map(name => this.getCloudImageUrl(name));
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.preloadCache.clear();
    this.loadStatusCache.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      preloadedCount: this.preloadCache.size,
      totalCachedCount: this.loadStatusCache.size,
      loadedCount: Array.from(this.loadStatusCache.values()).filter(status => status === 'loaded').length,
      failedCount: Array.from(this.loadStatusCache.values()).filter(status => status === 'failed').length
    };
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