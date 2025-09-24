// app.js
App({
  onLaunch() {
    //初始云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        // 替换为你的云环境 ID，可以在云控制台查看
        env: 'cloud1-4gw154ajfc4d5163',
        traceUser: true, // 可选，是否记录用户访问
      });
    }
    
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        console.log('登录成功', res.code)
      }
    })
  },
  
  onShow() {
    // 小程序启动，或从后台进入前台显示时触发
    console.log('小程序显示')
  },
  
  onHide() {
    // 小程序从前台进入后台时触发
    console.log('小程序隐藏')
  },
  
  onError(msg) {
    // 小程序发生脚本错误或 API 调用报错时触发
    console.log('小程序错误', msg)
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