// app.js
App({
  onLaunch() {
    //初始云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        // 使用当前选择的云环境，避免因环境 ID 不匹配导致 env not exists
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true, // 可选，是否记录用户访问
      });
    }
    
    // 统一日志级别（默认 warn）：抑制冗余 info/debug 输出，保留关键 warn/error
    try {
      const levelOrder = { none: 0, error: 1, warn: 2, info: 3, debug: 4 };
      const saved = wx.getStorageSync('logLevel') || 'warn';
      const cur = levelOrder[saved] ?? 2;
      const oLog = console.log.bind(console);
      const oInfo = (console.info ? console.info.bind(console) : oLog);
      const oDebug = (console.debug ? console.debug.bind(console) : oLog);
      const oWarn = console.warn.bind(console);
      const oError = console.error.bind(console);
      console.debug = (...args) => { if (cur >= 4) oDebug(...args); };
      console.info = (...args) => { if (cur >= 3) oInfo(...args); };
      console.log = (...args) => { if (cur >= 3) oLog(...args); };
      console.warn = (...args) => { if (cur >= 2) oWarn(...args); };
      console.error = (...args) => { if (cur >= 1) oError(...args); };
    } catch (e) {}
    
    // 仅记录隐私协议状态，不在启动时弹窗，避免影响用户体验
    wx.getPrivacySetting({
      success: (res) => {
        if (res.needAuthorization) {
          console.info('隐私协议需要用户授权，将在用户点击定位按钮时触发弹窗');
        } else {
          console.info('用户已同意过隐私协议');
        }
      },
      fail: (err) => {
        console.warn('隐私设置查询失败', err);
      }
    });
    
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        console.info('登录成功', res.code)
      }
    })
  },
  
  onShow() {
    // 小程序启动，或从后台进入前台显示时触发
    console.info('小程序显示')
  },
  
  onHide() {
    // 小程序从前台进入后台时触发
    console.info('小程序隐藏')
  },
  
  onError(msg) {
    // 小程序发生脚本错误或 API 调用报错时触发
    console.error('小程序错误', msg)
  },
  
  // 动态设置日志级别：none/error/warn/info/debug
  setLogLevel(level) {
    try {
      const levelOrder = { none: 0, error: 1, warn: 2, info: 3, debug: 4 };
      const cur = levelOrder[level] ?? 2;
      wx.setStorageSync('logLevel', level);
      const oLog = console.log.bind(console);
      const oInfo = (console.info ? console.info.bind(console) : oLog);
      const oDebug = (console.debug ? console.debug.bind(console) : oLog);
      const oWarn = console.warn.bind(console);
      const oError = console.error.bind(console);
      console.debug = (...args) => { if (cur >= 4) oDebug(...args); };
      console.info = (...args) => { if (cur >= 3) oInfo(...args); };
      console.log = (...args) => { if (cur >= 3) oLog(...args); };
      console.warn = (...args) => { if (cur >= 2) oWarn(...args); };
      console.error = (...args) => { if (cur >= 1) oError(...args); };
    } catch (e) {}
  },
  
  // 全局数据
  globalData: {
    userInfo: null,
    systemInfo: null,
    restaurants: [],
    bookings: []
  },
  
  // 全局方法
  getUserInfo() {
    return new Promise((resolve, reject) => {
      if (this.globalData.userInfo) {
        resolve(this.globalData.userInfo)
      } else {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: res => {
            this.globalData.userInfo = res.userInfo
            resolve(res.userInfo)
          },
          fail: reject
        })
      }
    })
  },
  
  getSystemInfo() {
    return new Promise((resolve, reject) => {
      if (this.globalData.systemInfo) {
        resolve(this.globalData.systemInfo)
      } else {
        wx.getSystemInfo({
          success: res => {
            this.globalData.systemInfo = res
            resolve(res)
          },
          fail: reject
        })
      }
    })
  }
})