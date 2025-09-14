// utils/util.js

/**
 * 格式化时间
 * @param {Date} date 日期对象
 * @param {String} format 格式化字符串，如 'YYYY-MM-DD HH:mm:ss'
 * @returns {String} 格式化后的时间字符串
 */
const formatTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return format
    .replace('YYYY', year)
    .replace('MM', month.toString().padStart(2, '0'))
    .replace('DD', day.toString().padStart(2, '0'))
    .replace('HH', hour.toString().padStart(2, '0'))
    .replace('mm', minute.toString().padStart(2, '0'))
    .replace('ss', second.toString().padStart(2, '0'))
}

/**
 * 获取当前时间戳
 * @returns {Number} 时间戳
 */
const getCurrentTimestamp = () => {
  return Date.now()
}

/**
 * 防抖函数
 * @param {Function} func 要防抖的函数
 * @param {Number} wait 等待时间
 * @returns {Function} 防抖后的函数
 */
const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 * @param {Function} func 要节流的函数
 * @param {Number} limit 时间间隔
 * @returns {Function} 节流后的函数
 */
const throttle = (func, limit) => {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 深拷贝对象
 * @param {Object} obj 要拷贝的对象
 * @returns {Object} 拷贝后的对象
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item))
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {}
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

/**
 * 生成随机字符串
 * @param {Number} length 字符串长度
 * @returns {String} 随机字符串
 */
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 验证手机号
 * @param {String} phone 手机号
 * @returns {Boolean} 是否有效
 */
const validatePhone = (phone) => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 验证邮箱
 * @param {String} email 邮箱地址
 * @returns {Boolean} 是否有效
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 格式化价格
 * @param {Number} price 价格
 * @param {Number} decimals 小数位数
 * @returns {String} 格式化后的价格
 */
const formatPrice = (price, decimals = 2) => {
  return '¥' + Number(price).toFixed(decimals)
}

/**
 * 计算距离
 * @param {Number} lat1 纬度1
 * @param {Number} lng1 经度1
 * @param {Number} lat2 纬度2
 * @param {Number} lng2 经度2
 * @returns {Number} 距离（公里）
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371 // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 格式化距离显示
 * @param {Number} distance 距离（公里）
 * @returns {String} 格式化后的距离
 */
const formatDistance = (distance) => {
  if (distance < 1) {
    return Math.round(distance * 1000) + 'm'
  } else {
    return distance.toFixed(1) + 'km'
  }
}

/**
 * 获取星期几
 * @param {Date} date 日期对象
 * @returns {String} 星期几
 */
const getWeekDay = (date = new Date()) => {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekDays[date.getDay()]
}

/**
 * 检查是否为空值
 * @param {*} value 要检查的值
 * @returns {Boolean} 是否为空
 */
const isEmpty = (value) => {
  return value === null || value === undefined || value === '' || 
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
}

module.exports = {
  formatTime,
  getCurrentTimestamp,
  debounce,
  throttle,
  deepClone,
  generateRandomString,
  validatePhone,
  validateEmail,
  formatPrice,
  calculateDistance,
  formatDistance,
  getWeekDay,
  isEmpty
}