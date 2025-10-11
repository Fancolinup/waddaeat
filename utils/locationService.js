/**
 * 位置服务模块
 * 处理用户位置授权、获取位置信息和附近餐厅搜索
 */

// 模拟的城市坐标数据
const MOCK_LOCATIONS = {
  beijing: { latitude: 39.9042, longitude: 116.4074, name: '北京国贸' },
  shanghai: { latitude: 31.2304, longitude: 121.4737, name: '上海陆家嘴' },
  guangzhou: { latitude: 23.1291, longitude: 113.2644, name: '广州天河' },
  shenzhen: { latitude: 22.5431, longitude: 114.0579, name: '深圳南山' }
};

// 模拟的附近餐厅数据（基于高德API格式）
// TODO: 当高德API可用时，替换为真实API调用返回的数据
const MOCK_NEARBY_RESTAURANTS = [
  { 
    id: 'nearby_001', 
    name: '海底捞火锅', 
    distance: 200, 
    category: '火锅',
    latitude: 31.2304,
    longitude: 121.4737,
    address: '上海市浦东新区陆家嘴环路1000号'
  },
  { 
    id: 'nearby_002', 
    name: '麦当劳', 
    distance: 350, 
    category: '快餐',
    latitude: 31.2280,
    longitude: 121.4750,
    address: '上海市浦东新区世纪大道1号'
  },
  { 
    id: 'nearby_003', 
    name: '星巴克', 
    distance: 180, 
    category: '咖啡',
    latitude: 31.2320,
    longitude: 121.4720,
    address: '上海市浦东新区银城中路501号'
  },
  { 
    id: 'nearby_004', 
    name: '必胜客', 
    distance: 420, 
    category: '西餐',
    latitude: 31.2250,
    longitude: 121.4780,
    address: '上海市浦东新区东方路800号'
  },
  { 
    id: 'nearby_005', 
    name: '肯德基', 
    distance: 300, 
    category: '快餐',
    latitude: 31.2290,
    longitude: 121.4760,
    address: '上海市浦东新区浦东南路1200号'
  },
  { 
    id: 'nearby_006', 
    name: '西贝莜面村', 
    distance: 500, 
    category: '西北菜',
    latitude: 31.2200,
    longitude: 121.4800,
    address: '上海市浦东新区张杨路1500号'
  },
  { 
    id: 'nearby_007', 
    name: '外婆家', 
    distance: 600, 
    category: '杭帮菜',
    latitude: 31.2180,
    longitude: 121.4820,
    address: '上海市浦东新区花木路1800号'
  },
  { 
    id: 'nearby_008', 
    name: '绿茶餐厅', 
    distance: 450, 
    category: '江浙菜',
    latitude: 31.2260,
    longitude: 121.4790,
    address: '上海市浦东新区民生路1300号'
  },
  { 
    id: 'nearby_009', 
    name: '呷哺呷哺', 
    distance: 280, 
    category: '火锅',
    latitude: 31.2310,
    longitude: 121.4730,
    address: '上海市浦东新区陆家嘴西路168号'
  },
  { 
    id: 'nearby_010', 
    name: '真功夫', 
    distance: 380, 
    category: '中式快餐',
    latitude: 31.2270,
    longitude: 121.4770,
    address: '上海市浦东新区世纪大道1568号'
  }
];

/**
 * 检查位置授权状态
 * @returns {Promise<boolean>} 是否已授权
 */
function checkLocationAuth() {
  return new Promise((resolve) => {
    wx.getSetting({
      success(res) {
        const hasAuth = res.authSetting['scope.userLocation'];
        resolve(!!hasAuth);
      },
      fail() {
        resolve(false);
      }
    });
  });
}

/**
 * 引导用户授权位置信息
 * @returns {Promise<boolean>} 用户是否同意授权
 */
function requestLocationAuth() {
  return new Promise((resolve) => {
    wx.showModal({
      title: '位置权限',
      content: '需要获取你的位置信息来推荐附近餐厅，请在设置中开启位置权限',
      confirmText: '去设置',
      cancelText: '暂不开启',
      success(res) {
        if (res.confirm) {
          wx.openSetting({
            success(settingRes) {
              const hasAuth = settingRes.authSetting['scope.userLocation'];
              resolve(!!hasAuth);
            },
            fail() {
              resolve(false);
            }
          });
        } else {
          resolve(false);
        }
      },
      fail() {
        resolve(false);
      }
    });
  });
}

/**
 * 获取用户选择的位置
 * @returns {Promise<Object>} 位置信息 {latitude, longitude, name, address}
 */
function chooseUserLocation() {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success(res) {
        console.log('用户选择的位置:', res);
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          name: res.name || '选择的位置',
          address: res.address || ''
        });
      },
      fail(err) {
        console.error('选择位置失败:', err);
        if (err.errMsg && err.errMsg.includes('cancel')) {
          reject(new Error('用户取消选择位置'));
        } else {
          reject(new Error('选择位置失败，请重试'));
        }
      }
    });
  });
}

/**
 * 搜索附近餐厅
 * @param {Object} location 用户位置 {latitude, longitude}
 * @param {number} radius 搜索半径（米），默认1000米
 * @returns {Promise<Array>} 附近餐厅列表
 */
function searchNearbyRestaurants(location, radius = 1000) {
  return new Promise((resolve, reject) => {
    if (!location || !location.latitude || !location.longitude) {
      reject(new Error('位置信息无效'));
      return;
    }

    // TODO: 当高德API可用时，替换为真实API调用
    // const url = `https://restapi.amap.com/v3/place/around`;
    // const params = {
    //   key: 'YOUR_AMAP_KEY',
    //   location: `${location.longitude},${location.latitude}`,
    //   keywords: '餐厅|美食',
    //   types: '050000', // 餐饮服务
    //   radius: radius,
    //   offset: 20,
    //   page: 1,
    //   extensions: 'all'
    // };

    // 暂时使用模拟数据
    setTimeout(() => {
      // 过滤距离范围内的餐厅
      const nearbyRestaurants = MOCK_NEARBY_RESTAURANTS.filter(restaurant => 
        restaurant.distance <= radius
      ).sort((a, b) => a.distance - b.distance); // 按距离排序

      console.log('[locationService] 搜索到附近餐厅:', nearbyRestaurants.length, '家');
      resolve(nearbyRestaurants);
    }, 800); // 模拟网络延迟
  });
}

/**
 * 计算两点间距离（米）
 * @param {number} lat1 纬度1
 * @param {number} lng1 经度1
 * @param {number} lat2 纬度2
 * @param {number} lng2 经度2
 * @returns {number} 距离（米）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * 获取附近餐厅的完整流程
 * @param {number} radius 搜索半径，默认1000米
 * @returns {Promise<Object>} {location, restaurants}
 */
async function getNearbyRestaurants(radius = 1000) {
  try {
    wx.showLoading({ title: '选择位置中...' });
    
    // 让用户选择位置
    const location = await chooseUserLocation();
    
    wx.showLoading({ title: '搜索附近餐厅...' });
    
    // 搜索附近餐厅
    const restaurants = await searchNearbyRestaurants(location, radius);
    
    wx.hideLoading();
    
    return {
      location,
      restaurants
    };
  } catch (error) {
    wx.hideLoading();
    wx.showToast({
      title: error.message || '获取位置失败',
      icon: 'none'
    });
    throw error;
  }
}

module.exports = {
  checkLocationAuth,
  requestLocationAuth,
  chooseUserLocation,
  searchNearbyRestaurants,
  calculateDistance,
  getNearbyRestaurants
};