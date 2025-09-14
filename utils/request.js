// utils/request.js

// API基础配置
const config = {
  baseURL: 'https://api.eatigo.com', // 替换为实际的API地址
  timeout: 10000,
  header: {
    'Content-Type': 'application/json'
  }
}

/**
 * 封装wx.request
 * @param {Object} options 请求配置
 * @returns {Promise} 请求Promise
 */
const request = (options) => {
  return new Promise((resolve, reject) => {
    // 显示加载提示
    if (options.loading !== false) {
      wx.showLoading({
        title: options.loadingText || '请求中...'
      })
    }

    // 合并配置
    const requestOptions = {
      url: config.baseURL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        ...config.header,
        ...options.header
      },
      timeout: options.timeout || config.timeout,
      success: (res) => {
        wx.hideLoading()
        
        // 根据状态码处理响应
        if (res.statusCode === 200) {
          // 根据业务逻辑处理响应数据
          if (res.data.code === 0 || res.data.success) {
            resolve(res.data)
          } else {
            // 业务错误
            const errorMsg = res.data.message || res.data.msg || '请求失败'
            if (options.showError !== false) {
              wx.showToast({
                title: errorMsg,
                icon: 'none'
              })
            }
            reject(new Error(errorMsg))
          }
        } else {
          // HTTP错误
          const errorMsg = `请求失败 (${res.statusCode})`
          if (options.showError !== false) {
            wx.showToast({
              title: errorMsg,
              icon: 'none'
            })
          }
          reject(new Error(errorMsg))
        }
      },
      fail: (err) => {
        wx.hideLoading()
        
        let errorMsg = '网络请求失败'
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMsg = '请求超时'
          } else if (err.errMsg.includes('fail')) {
            errorMsg = '网络连接失败'
          }
        }
        
        if (options.showError !== false) {
          wx.showToast({
            title: errorMsg,
            icon: 'none'
          })
        }
        
        reject(new Error(errorMsg))
      }
    }

    // 添加token到请求头
    const token = wx.getStorageSync('token')
    if (token) {
      requestOptions.header.Authorization = `Bearer ${token}`
    }

    // 发起请求
    wx.request(requestOptions)
  })
}

/**
 * GET请求
 * @param {String} url 请求地址
 * @param {Object} data 请求参数
 * @param {Object} options 其他配置
 * @returns {Promise} 请求Promise
 */
const get = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'GET',
    data,
    ...options
  })
}

/**
 * POST请求
 * @param {String} url 请求地址
 * @param {Object} data 请求数据
 * @param {Object} options 其他配置
 * @returns {Promise} 请求Promise
 */
const post = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'POST',
    data,
    ...options
  })
}

/**
 * PUT请求
 * @param {String} url 请求地址
 * @param {Object} data 请求数据
 * @param {Object} options 其他配置
 * @returns {Promise} 请求Promise
 */
const put = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'PUT',
    data,
    ...options
  })
}

/**
 * DELETE请求
 * @param {String} url 请求地址
 * @param {Object} data 请求参数
 * @param {Object} options 其他配置
 * @returns {Promise} 请求Promise
 */
const del = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'DELETE',
    data,
    ...options
  })
}

/**
 * 上传文件
 * @param {String} url 上传地址
 * @param {String} filePath 文件路径
 * @param {Object} formData 额外的表单数据
 * @param {Object} options 其他配置
 * @returns {Promise} 上传Promise
 */
const upload = (url, filePath, formData = {}, options = {}) => {
  return new Promise((resolve, reject) => {
    // 显示上传进度
    if (options.showProgress !== false) {
      wx.showLoading({
        title: '上传中...'
      })
    }

    const uploadTask = wx.uploadFile({
      url: config.baseURL + url,
      filePath,
      name: options.name || 'file',
      formData,
      header: {
        ...options.header
      },
      success: (res) => {
        wx.hideLoading()
        
        try {
          const data = JSON.parse(res.data)
          if (data.code === 0 || data.success) {
            resolve(data)
          } else {
            const errorMsg = data.message || data.msg || '上传失败'
            wx.showToast({
              title: errorMsg,
              icon: 'none'
            })
            reject(new Error(errorMsg))
          }
        } catch (e) {
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          })
          reject(new Error('上传失败'))
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
        reject(err)
      }
    })

    // 监听上传进度
    if (options.onProgress) {
      uploadTask.onProgressUpdate(options.onProgress)
    }
  })
}

/**
 * 下载文件
 * @param {String} url 下载地址
 * @param {Object} options 其他配置
 * @returns {Promise} 下载Promise
 */
const download = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    if (options.showProgress !== false) {
      wx.showLoading({
        title: '下载中...'
      })
    }

    const downloadTask = wx.downloadFile({
      url: config.baseURL + url,
      success: (res) => {
        wx.hideLoading()
        if (res.statusCode === 200) {
          resolve(res.tempFilePath)
        } else {
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          })
          reject(new Error('下载失败'))
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        })
        reject(err)
      }
    })

    // 监听下载进度
    if (options.onProgress) {
      downloadTask.onProgressUpdate(options.onProgress)
    }
  })
}

/**
 * 设置基础URL
 * @param {String} baseURL 基础URL
 */
const setBaseURL = (baseURL) => {
  config.baseURL = baseURL
}

/**
 * 设置默认请求头
 * @param {Object} header 请求头
 */
const setHeader = (header) => {
  config.header = {
    ...config.header,
    ...header
  }
}

module.exports = {
  request,
  get,
  post,
  put,
  del,
  upload,
  download,
  setBaseURL,
  setHeader
}