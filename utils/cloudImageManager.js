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
    
    // 检测设备类型，iOS设备强制使用HTTPS临时链接
    this.isIOS = this.detectIOSDevice();
    
    console.log('[CloudImageManager] 初始化完成，云存储基础路径:', this.cloudBase);
    console.log('[CloudImageManager] 检测到设备类型:', this.isIOS ? 'iOS' : '其他');
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
    this.getTempHttpsUrl(imageName, extension)
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
      placeholder: '/images/placeholder.png'
    };
    if (!imageName || localMap[imageName]) {
      return localMap[imageName || 'placeholder'];
    }

    if (this.isIOS) {
      // iOS设备必须返回可用的字符串URL：优先缓存的HTTPS，否则返回统一占位图
      const fileId = this.getFileId(imageName, extension);
      const cached = this.tempUrlCache.get(fileId);
      if (cached && cached.startsWith('https://')) {
        return cached;
      }
      // 返回统一占位图，避免将 cloud:// 传递到渲染层
      return this.getPlaceholderUrlSync();
    } else {
      // 非iOS设备使用同步的fileID
      return this.getCloudImageUrlSync(imageName, extension);
    }
  }

  /**
   * 获取云图片URL（同步版本，兼容旧代码）
   * @param {string} imageName - 图片名称（不含扩展名）
   * @param {string} extension - 文件扩展名，默认为 'png'
   * @returns {string} 完整的云存储 fileID
   */
  getCloudImageUrlSync(imageName, extension = 'png') {
    // 优先使用本地打包资源作为兜底，完全不依赖云端
    const localMap = {
      takeout: '/images/takeout.png',
      beverage: '/images/beverage.png',
      canteen: '/images/canteen.png',
      icon_home: '/images/icon_home.png',
      icon_coupon: '/images/icon_coupon.png',
      icon_profile: '/images/icon_profile.png',
      placeholder: '/images/placeholder.png'
    };
    if (!imageName || localMap[imageName]) {
      return localMap[imageName || 'placeholder'];
    }

    if (this.isIOS) {
      // iOS设备必须返回可用的字符串URL：优先缓存的HTTPS，否则返回统一占位图
      const fileId = this.getFileId(imageName, extension);
      const cached = this.tempUrlCache.get(fileId);
      if (cached && cached.startsWith('https://')) {
        return cached;
      }
      // 返回统一占位图，避免将 cloud:// 传递到渲染层
      return this.getPlaceholderUrlSync();
    } else {
      // 非iOS设备使用同步的fileID
      return this.getCloudImageUrlSync(imageName, extension);
    }
  }

  /**
   * 获取云图片URL（同步版本，兼容旧代码）
   * @param {string} imageName - 图片名称（不含扩展名）
   * @param {string} extension - 文件扩展名，默认为 'png'
   * @returns {string} 完整的云存储 fileID
   */
  getCloudImageUrlSync(imageName, extension = 'png') {
    // 优先使用本地打包资源作为兜底，完全不依赖云端
    const localMap = {
      takeout: '/images/takeout.png',
      beverage: '/images/beverage.png',
      canteen: '/images/canteen.png',
      icon_home: '/images/icon_home.png',
      icon_coupon: '/images/icon_coupon.png',
      icon_profile: '/images/icon_profile.png',
      placeholder: '/images/placeholder.png'
    };

    if (!imageName || imageName === 'placeholder') {
      console.log('[CloudImageManager] imageName为空或为placeholder，使用本地占位图:', localMap.placeholder);
      return localMap.placeholder;
    }

    if (localMap[imageName]) {
      console.log('[CloudImageManager] 使用本地兜底图片:', imageName, '->', localMap[imageName]);
      return localMap[imageName];
    }
    
    // 直接返回云文件ID路径（非兜底图片）
    const fileId = `${this.cloudBase}${imageName}.${extension}`;
    console.log('[CloudImageManager] 获取图片URL:', imageName, '->', fileId);
    return fileId;
  }

  /**
   * 获取placeholder的临时HTTPS链接，专门用于手动添加餐厅的默认logo
   * @returns {Promise<string>} 临时HTTPS链接或云端fileID
   */
  async getPlaceholderHttpsUrl() {
    try {
      const fileId = this.getCloudImageUrlSync('placeholder', 'png');
      console.log('[CloudImageManager] 获取placeholder临时链接，fileId:', fileId);
      
      const httpsUrl = await this.getTempHttpsUrl('placeholder', 'png');
      if (httpsUrl && httpsUrl.indexOf('https://') === 0) {
        console.log('[CloudImageManager] 成功获取placeholder临时链接:', httpsUrl);
        return httpsUrl;
      } else {
        console.warn('[CloudImageManager] 临时链接获取失败，返回统一占位图');
        return this.getPlaceholderUrlSync();
      }
    } catch (error) {
      console.error('[CloudImageManager] 获取placeholder临时链接出错:', error);
      // 返回统一占位图作为备用
      return this.getPlaceholderUrlSync();
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
      console.log('[CloudImageManager] 使用缓存的临时链接:', imageName, '->', cached);
      return cached;
    }

    return new Promise((resolve, reject) => {
      try {
        if (!wx.cloud || !wx.cloud.getTempFileURL) {
          console.warn('[CloudImageManager] wx.cloud.getTempFileURL 不可用，回退占位图/文件ID');
          if (this.isIOS) {
            resolve(this.getPlaceholderUrlSync());
          } else {
            resolve(fileId);
          }
          return;
        }
        
        console.log('[CloudImageManager] 开始获取临时链接:', imageName, extension, 'fileId:', fileId);
        
        wx.cloud.getTempFileURL({
          fileList: [fileId],
          success: (res) => {
            try {
              console.log('[CloudImageManager] getTempFileURL success response:', JSON.stringify(res));
              
              const list = res && res.fileList ? res.fileList : [];
              const item = list[0] || {};
              const tempUrl = item.tempFileURL || '';
              const status = item.status;
              const errCode = item.errCode;
              
              console.log('[CloudImageManager] 解析结果:', {
                imageName,
                tempUrl,
                status,
                errCode,
                hasFileList: !!res.fileList,
                fileListLength: list.length
              });
              
              // 检查是否有错误状态
              if (status !== 0 || errCode) {
                console.warn('[CloudImageManager] 临时链接获取有错误:', { status, errCode, imageName, errMsg: item.errMsg });
                
                // 检查是否是权限错误 (STORAGE_EXCEED_AUTHORITY)
                if (item.errMsg && item.errMsg.includes('STORAGE_EXCEED_AUTHORITY')) {
                  console.error('[CloudImageManager] 云存储权限不足或配额超限:', imageName);
                  // 权限错误不需要重试，直接使用占位图
                  if (this.isIOS) {
                    resolve(this.getPlaceholderUrlSync());
                  } else {
                    resolve(fileId); // 非iOS设备回退到fileId
                  }
                  return;
                }
                
                // 对于其他错误，iOS设备尝试重试
                if (this.isIOS) {
                  console.log('[CloudImageManager] iOS设备检测到非权限错误，尝试重试:', imageName);
                  setTimeout(() => {
                    this.retryGetTempUrl(fileId, imageName, extension, resolve);
                  }, 1000);
                  return;
                } else {
                  resolve(fileId);
                  return;
                }
              }
              
              if (tempUrl && tempUrl.startsWith('https://')) {
                // 缓存有效的HTTPS链接
                this.tempUrlCache.set(fileId, tempUrl);
                console.log('[CloudImageManager] 生成临时链接成功:', imageName, extension, '->', tempUrl);
                resolve(tempUrl);
              } else {
                console.warn('[CloudImageManager] 临时链接无效或非HTTPS:', {
                  imageName,
                  tempUrl,
                  tempUrlType: typeof tempUrl,
                  tempUrlLength: tempUrl ? tempUrl.length : 0,
                  isHttps: tempUrl ? tempUrl.startsWith('https://') : false
                });
                
                // 对于iOS设备，尝试重试
                if (this.isIOS) {
                  console.log('[CloudImageManager] iOS设备临时链接无效，尝试重试:', imageName);
                  setTimeout(() => {
                    this.retryGetTempUrl(fileId, imageName, extension, resolve);
                  }, 1000);
                } else {
                  resolve(fileId);
                }
              }
            } catch (parseErr) {
              console.warn('[CloudImageManager] 解析临时链接失败:', parseErr, 'imageName:', imageName);
              if (this.isIOS) {
                setTimeout(() => {
                  this.retryGetTempUrl(fileId, imageName, extension, resolve);
                }, 1000);
              } else {
                resolve(fileId);
              }
            }
          },
          fail: (error) => {
            console.warn('[CloudImageManager] 获取临时链接失败:', error);
            
            // 新增：检测云环境异常（env not exists / INVALID_ENV），直接使用本地占位图，避免无意义重试
            if (error && error.errMsg && (error.errMsg.includes('env not exists') || error.errMsg.includes('INVALID_ENV'))) {
              console.warn('[CloudImageManager] 云环境无效，使用本地占位图兜底');
              resolve(this.getPlaceholderUrlSync());
              return;
            }
            
            // 检查是否是权限相关错误
            if (error && error.errMsg && error.errMsg.includes('STORAGE_EXCEED_AUTHORITY')) {
              console.error('[CloudImageManager] 云存储权限不足或配额超限，直接使用占位图:', imageName);
              if (this.isIOS) {
                resolve(this.getPlaceholderUrlSync());
              } else {
                resolve(fileId); // 非iOS设备回退到fileId
              }
              return;
            }
            
            // iOS设备上获取临时链接失败时，尝试重试一次
            if (this.isIOS) {
              console.log('[CloudImageManager] iOS设备重试获取临时链接:', imageName);
              setTimeout(() => {
                this.retryGetTempUrl(fileId, imageName, extension, (url) => {
                  // 如果重试仍失败或返回非HTTPS，则统一使用本地占位图
                  if (!url || !String(url).startsWith('https://')) {
                    resolve(this.getPlaceholderUrlSync());
                  } else {
                    resolve(url);
                  }
                });
              }, 1000);
            } else {
              resolve(fileId);
            }
          }
        });
      } catch (err) {
        console.warn('[CloudImageManager] getTempHttpsUrl 异常，回退占位图/文件ID:', err);
        if (this.isIOS) {
          resolve(this.getPlaceholderUrlSync());
        } else {
          resolve(fileId);
        }
      }
    });
  }

  /**
   * 重试获取临时链接（仅用于iOS设备）
   * @param {string} fileId - 文件ID
   * @param {string} imageName - 图片名称
   * @param {string} extension - 扩展名
   * @param {Function} resolve - Promise resolve函数
   */
  retryGetTempUrl(fileId, imageName, extension, resolve) {
    console.log('[CloudImageManager] 开始重试获取临时链接:', imageName, 'fileId:', fileId);
    
    wx.cloud.getTempFileURL({
      fileList: [fileId],
      success: (res) => {
        try {
          console.log('[CloudImageManager] 重试 getTempFileURL success response:', JSON.stringify(res));
          
          const list = res && res.fileList ? res.fileList : [];
          const item = list[0] || {};
          const tempUrl = item.tempFileURL || '';
          const status = item.status;
          const errCode = item.errCode;
          
          console.log('[CloudImageManager] 重试解析结果:', {
            imageName,
            tempUrl,
            status,
            errCode,
            hasFileList: !!res.fileList,
            fileListLength: list.length
          });
          
          // 检查是否有错误状态
          if (status !== 0 || errCode) {
            console.warn('[CloudImageManager] 重试仍有错误:', { status, errCode, imageName, errMsg: item.errMsg });
            
            // 新增：云环境无效直接占位
            if (item.errMsg && (item.errMsg.includes('env not exists') || item.errMsg.includes('INVALID_ENV'))) {
              resolve(this.getPlaceholderUrlSync());
              return;
            }
            
            // 检查是否是权限错误 (STORAGE_EXCEED_AUTHORITY)
            if (item.errMsg && item.errMsg.includes('STORAGE_EXCEED_AUTHORITY')) {
              console.error('[CloudImageManager] 重试时发现云存储权限不足或配额超限:', imageName);
            }
            
            // 无论什么错误，重试失败后都使用占位图
            resolve(this.getPlaceholderUrlSync());
            return;
          }
          
          if (tempUrl && tempUrl.startsWith('https://')) {
            this.tempUrlCache.set(fileId, tempUrl);
            console.log('[CloudImageManager] iOS设备重试获取临时链接成功:', imageName, '->', tempUrl);
            resolve(tempUrl);
          } else {
            console.warn('[CloudImageManager] iOS设备重试仍失败，临时链接无效:', {
              imageName,
              tempUrl,
              tempUrlType: typeof tempUrl,
              tempUrlLength: tempUrl ? tempUrl.length : 0,
              isHttps: tempUrl ? tempUrl.startsWith('https://') : false
            });
            resolve(this.getPlaceholderUrlSync());
          }
        } catch (parseErr) {
          console.warn('[CloudImageManager] iOS设备重试解析失败，使用占位图:', parseErr, 'imageName:', imageName);
          resolve(this.getPlaceholderUrlSync());
        }
      },
      fail: (error) => {
        console.warn('[CloudImageManager] iOS设备重试失败:', error, 'imageName:', imageName);
        
        // 新增：检测云环境异常（env not exists / INVALID_ENV），直接使用本地占位图
        if (error && error.errMsg && (error.errMsg.includes('env not exists') || error.errMsg.includes('INVALID_ENV'))) {
          console.warn('[CloudImageManager] 重试检测到云环境无效，使用本地占位图兜底');
          resolve(this.getPlaceholderUrlSync());
          return;
        }
        
        // 检查是否是权限相关错误
        if (error && error.errMsg && error.errMsg.includes('STORAGE_EXCEED_AUTHORITY')) {
          console.error('[CloudImageManager] 重试时发现云存储权限不足或配额超限:', imageName);
        }
        
        // 重试失败，使用占位图
        resolve(this.getPlaceholderUrlSync());
      }
    });
  }

  /**
   * 获取图片URL的降级机制（针对iOS设备优化）
   * @param {string} imageName - 图片名称
   * @param {Array} extensions - 尝试的扩展名数组，默认['png', 'jpg', 'webp']
   * @returns {Promise<string>} 返回可用的图片URL
   */
  async getImageUrlWithFallback(imageName, extensions = ['png', 'jpg', 'webp']) {
    console.log('[CloudImageManager] 开始降级获取图片URL:', imageName);
    
    // 对于iOS设备，优先尝试获取HTTPS临时链接
    for (const ext of extensions) {
      try {
        let url;
        if (this.isIOS) {
          // iOS设备优先使用临时HTTPS链接
          url = await this.getTempHttpsUrl(imageName, ext);
          console.log('[CloudImageManager] iOS设备尝试临时链接:', imageName, ext, '->', url);
        } else {
          // 非iOS设备使用常规方式
          url = this.getCloudImageUrlSync(imageName, ext);
          console.log('[CloudImageManager] 非iOS设备使用云存储链接:', imageName, ext, '->', url);
        }
        
        // 验证URL是否有效
        if (url && (String(url).startsWith('https://') || String(url).startsWith('cloud://') || String(url).startsWith('/'))) {
          return url;
        }
      } catch (error) {
        console.warn('[CloudImageManager] 获取图片URL失败:', imageName, ext, error);
        continue;
      }
    }
    
    // 所有格式都失败，返回占位图
    console.warn('[CloudImageManager] 所有格式都失败，使用占位图:', imageName);
    return this.getPlaceholderUrlSync();
  }

  /**
   * 验证图片URL是否可访问（用于降级机制）
   * @param {string} url - 图片URL
   * @returns {Promise<boolean>} 是否可访问
   */
  validateImageUrl(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      
      wx.getImageInfo({
        src: url,
        success: () => {
          console.log('[CloudImageManager] 图片URL验证成功:', url);
          resolve(true);
        },
        fail: (error) => {
          console.warn('[CloudImageManager] 图片URL验证失败:', url, error);
          resolve(false);
        }
      });
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
      
      return new Promise((resolve) => {
        // iOS 设备使用 HTTPS 临时链接进行预加载与缓存
        if (this.isIOS) {
          this.getTempHttpsUrl(name, 'png').then((url) => {
            const finalUrl = (url && String(url).startsWith('https://')) ? url : this.getPlaceholderUrlSync();
            wx.getImageInfo({
              src: finalUrl,
              success: () => {
                this.preloadCache.add(name);
                this.loadStatusCache.set(name, 'loaded');
                resolve();
              },
              fail: (error) => {
                console.warn(`预加载图片失败(iOS): ${name}`, error);
                // 直接标记占位图状态并结束（不再依赖本地图片）
                this.preloadCache.add(name);
                this.loadStatusCache.set(name, 'placeholder');
                resolve();
              }
            });
          }).catch((err) => {
            console.warn(`预加载获取HTTPS失败(iOS): ${name}`, err);
            // 标记占位图并结束
            this.preloadCache.add(name);
            this.loadStatusCache.set(name, 'placeholder');
            resolve();
          });
          return;
        }
        
        // 非 iOS 设备走原逻辑：cloud:// fileId 预加载
        const imageUrl = this.getCloudImageUrlSync(name);
        wx.getImageInfo({
          src: imageUrl,
          success: () => {
            this.preloadCache.add(name);
            this.loadStatusCache.set(name, 'loaded');
            resolve();
          },
          fail: () => {
            this.loadStatusCache.set(name, 'failed');
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
    // iOS 设备使用 HTTPS 临时链接懒加载，避免 cloud:// 协议
    if (this.isIOS) {
      this.getTempHttpsUrl(imageName, 'png').then((url) => {
        const finalUrl = (url && String(url).startsWith('https://')) ? url : this.getPlaceholderUrlSync();
        console.log('[CloudImageManager] 开始懒加载图片(iOS):', imageName, finalUrl);
        this.loadStatusCache.set(imageName, 'loading');
        wx.getImageInfo({
          src: finalUrl,
          success: (res) => {
            console.log('[CloudImageManager] 图片加载成功(iOS):', imageName, res);
            this.loadStatusCache.set(imageName, 'loaded');
            onSuccess && onSuccess(finalUrl);
          },
          fail: (error) => {
            console.error(`[CloudImageManager] 云存储图片加载失败(iOS): ${imageName}`, error);
            this.loadStatusCache.set(imageName, 'failed');
            onError && onError();
          }
        });
      }).catch((err) => {
        console.warn('[CloudImageManager] 懒加载获取HTTPS失败(iOS):', imageName, err);
        this.loadStatusCache.set(imageName, 'failed');
        onError && onError();
      });
      return;
    }

    // 非 iOS 设备原逻辑
    const imageUrl = this.getCloudImageUrlSync(imageName);
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
    // iOS 返回缓存的 HTTPS 或占位图；非 iOS 返回 cloud:// fileId
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

  // 新增：返回内联 SVG 占位图（data URL），用于 iOS 设备在无 HTTPS 临时链接时兜底
  getInlinePlaceholderSvgDataUrl() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5f5f5"/><stop offset="100%" stop-color="#e9ecef"/></linearGradient></defs><rect x="0" y="0" width="120" height="120" fill="url(#g)"/><circle cx="60" cy="50" r="28" fill="#d1d5db"/><rect x="24" y="80" width="72" height="20" rx="10" fill="#cbd5e1"/></svg>';
    return `data:image/svg+xml;utf8,${svg}`;
  }

  // 新增：统一获取占位图URL（iOS优先HTTPS缓存，否则内联SVG；非iOS返回cloud:// placeholder）
  getPlaceholderUrlSync() {
    // 使用本地打包的占位图，避免云环境异常导致占位图不可用
    return '/images/placeholder.png';
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

// 删除类外重复定义的方法已移除