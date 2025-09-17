WXML：
<view class="container">
  <view class="background-blur"></view>

  <view class="header">
    <text class="greeting">Good Afternoon</text>
    <text class="time">It's 12:55, Tuesday</text>
  </view>

  <view class="title">
    <text>WHAT TO EAT TODAY?</text>
  </view>

  <view class="roulette-wheel-container">
    <image src="/images/roulette_wheel.png" class="roulette-wheel"></image>
    <view class="spin-button">
      <image src="/images/hand_icon.png" class="hand-icon"></image>
      <text>SPIN</text>
    </view>
  </view>

  <view class="decision-float-layer {{ showDecisionLayer ? 'show' : '' }}">
    <view class="restaurant-info">
      <image src="/images/mcdonalds_logo.png" class="restaurant-logo"></image>
      <view class="text-info">
        <text class="restaurant-name">McDonald's</text>
        <text class="restaurant-type">Fast Food</text>
        <text class="offer">Get 20% off!</text>
      </view>
    </view>
    <view class="decision-buttons">
      <button class="primary-button">LET'S EAT!</button>
      <button class="secondary-button">RE-ROLL</button>
      <button class="secondary-button">SHORTLIST</button>
    </view>
  </view>

  <view class="shortlist-area">
    <view class="shortlist-card">
      <image src="/images/mcdonalds_logo_small.png" class="shortlist-logo"></image>
      <text class="shortlist-name">McDonald's</text>
      <view class="close-button">X</view>
    </view>
    <view class="shortlist-empty-card"></view>
    <view class="shortlist-empty-card"></view>
  </view>

  <view class="share-area">
    <text class="share-text">Copy Feeling hungry? Lets eat!</text>
    <image src="/images/copy_icon.png" class="icon"></image>
    <image src="/images/refresh_icon.png" class="icon"></image>
  </view>

  <view class="tab-bar">
    <view class="tab-item active">
      <text>WHAT TO EAT TODAY</text>
    </view>
    <view class="tab-item">
      <text>WORK MOUTHPIECE</text>
    </view>
    <view class="tab-item">
      <text>PROFILE</text>
    </view>
  </view>
</view>


WXSS：
/* 全局设置 */
page {
  height: 100%;
  overflow: hidden; /* 防止滚动 */
}

.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  font-family: Arial, sans-serif; /* 示例字体 */
  color: #333;
}

/* 背景毛玻璃效果 */
.background-blur {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 假设有一个背景图或渐变色 */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(20px) saturate(150%); /* 玻璃拟态关键 */
  -webkit-backdrop-filter: blur(20px) saturate(150%); /* 兼容性 */
  z-index: -1; /* 确保在最底层 */
}

/* 顶部信息 */
.header {
  display: flex;
  justify-content: space-between;
  padding: 40rpx 40rpx 20rpx;
  font-size: 28rpx;
  color: rgba(51, 51, 51, 0.7);
}

/* 标题 */
.title {
  text-align: center;
  font-size: 48rpx;
  font-weight: bold;
  margin-bottom: 40rpx;
  color: #333;
}

/* 转盘区 */
.roulette-wheel-container {
  position: relative;
  width: 600rpx; /* 根据需要调整大小 */
  height: 600rpx; /* 保持圆形 */
  margin: 0 auto 60rpx;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.1); /* 轻微阴影 */
  background: rgba(255, 255, 255, 0.3); /* 模拟玻璃感 */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.roulette-wheel {
  width: 100%;
  height: 100%;
  /* 实际项目中这里可能是一个Canvas组件或动态生成的扇形 */
  /* 假设为一个静态图片作为示例 */
  transition: transform 3s ease-out; /* 旋转动画 */
}

.spin-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background-color: #007bff; /* 按钮颜色 */
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 28rpx;
  box-shadow: 0 5rpx 15rpx rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: background-color 0.3s;
}

.spin-button:active {
  background-color: #0056b3;
}

.hand-icon {
  width: 50rpx;
  height: 50rpx;
  margin-bottom: 10rpx;
}

/* 决策区浮层 */
.decision-float-layer {
  position: absolute; /* 相对于container定位 */
  bottom: -500rpx; /* 默认隐藏在屏幕下方 */
  left: 50%;
  transform: translateX(-50%);
  width: 90%; /* 根据需要调整宽度 */
  max-width: 680rpx;
  padding: 40rpx;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-radius: 30rpx;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.15);
  transition: bottom 0.5s ease-out; /* 上滑动画 */
  z-index: 10; /* 确保在其他元素之上 */
}

.decision-float-layer.show {
  bottom: 250rpx; /* 显示时的位置，需要根据实际布局调整 */
}

.restaurant-info {
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;
}

.restaurant-logo {
  width: 100rpx;
  height: 100rpx;
  border-radius: 10rpx;
  margin-right: 30rpx;
}

.text-info {
  display: flex;
  flex-direction: column;
}

.restaurant-name {
  font-size: 38rpx;
  font-weight: bold;
  margin-bottom: 5rpx;
}

.restaurant-type {
  font-size: 26rpx;
  color: rgba(51, 51, 51, 0.6);
  margin-bottom: 5rpx;
}

.offer {
  font-size: 28rpx;
  color: #e67e22; /* 优惠信息颜色 */
  font-weight: 500;
}

.decision-buttons {
  display: flex;
  justify-content: space-around;
  gap: 20rpx; /* 按钮间距 */
}

.primary-button, .secondary-button {
  flex: 1;
  height: 80rpx;
  border-radius: 20rpx;
  font-size: 30rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  border: none;
}

.primary-button {
  background-color: #007bff;
  color: #fff;
}

.secondary-button {
  background-color: rgba(255, 255, 255, 0.6);
  color: #333;
  border: 1rpx solid rgba(0, 0, 0, 0.1);
}

/* 备选区 */
.shortlist-area {
  display: flex;
  justify-content: space-around;
  padding: 40rpx 30rpx;
  margin-top: 20rpx; /* 与决策区浮层错开 */
}

.shortlist-card, .shortlist-empty-card {
  width: 200rpx;
  height: 160rpx;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  box-shadow: 0 5rpx 15rpx rgba(0, 0, 0, 0.08);
}

.shortlist-empty-card {
  border: 2rpx dashed rgba(0, 0, 0, 0.2);
  background: transparent;
}

.shortlist-logo {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 10rpx;
}

.shortlist-name {
  font-size: 26rpx;
  color: #333;
}

.close-button {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.2);
  color: #fff;
  font-size: 24rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

/* 分享操作区 */
.share-area {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx 40rpx;
  margin-top: auto; /* 推到备选区下方 */
  background: rgba(255, 255, 255, 0.2); /* 玻璃感 */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1rpx solid rgba(255, 255, 255, 0.3);
}

.share-text {
  flex-grow: 1;
  font-size: 28rpx;
  color: #555;
  margin-right: 20rpx;
}

.share-area .icon {
  width: 40rpx;
  height: 40rpx;
  margin-left: 20rpx;
  opacity: 0.7;
}

/* 底部Tab栏 */
.tab-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 100rpx;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-top: 1rpx solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 -5rpx 20rpx rgba(0, 0, 0, 0.05);
  font-size: 26rpx;
  color: rgba(51, 51, 51, 0.7);
}

.tab-item {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  border-right: 1rpx solid rgba(255, 255, 255, 0.4); /* Tab之间的边框 */
}

.tab-item:last-child {
  border-right: none;
}

.tab-item.active {
  color: #007bff;
  font-weight: bold;
  /* 可以在这里添加一个底部的蓝色高亮条 */
  position: relative;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 6rpx;
  background-color: #007bff;
  border-radius: 3rpx;
}

JavaScript：
Page({
  data: {
    showDecisionLayer: false, // 控制决策浮层的显示隐藏
    rouletteRotation: 0, // 转盘旋转角度
    selectedRestaurant: null, // 选中餐厅数据
  },

  onLoad: function () {
    // 初始化页面数据，例如动态问候语和时间
    this.updateDateTime();
    setInterval(this.updateDateTime, 60000); // 每分钟更新时间
  },

  updateDateTime: function() {
    const now = new Date();
    const hours = now.getHours();
    let greeting = "Good Evening";
    if (hours < 12) {
      greeting = "Good Morning";
    } else if (hours < 18) {
      greeting = "Good Afternoon";
    }

    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    this.setData({
      greeting: greeting,
      currentTime: `It's ${time}, ${dayOfWeek}`
    });
  },

  spinRoulette: function () {
    // 随机计算旋转角度，模拟转动
    const randomDegrees = Math.floor(Math.random() * 360) + 360 * 5; // 至少转5圈
    this.setData({
      rouletteRotation: randomDegrees,
      showDecisionLayer: false // 再次转动时隐藏之前的浮层
    });

    // 模拟转盘停止后的回调
    setTimeout(() => {
      // 假设根据最终角度计算出选中的餐厅
      const restaurants = ['Burger King', 'Pizza Hut', 'Starbucks', 'KFC', 'Taco Bell', 'Wendy\'s', 'Chipotle']; // 示例数据
      const selectedIndex = Math.floor((randomDegrees % 360) / (360 / restaurants.length));
      this.setData({
        selectedRestaurant: {
          name: restaurants[selectedIndex],
          logo: `/images/${restaurants[selectedIndex].replace(/\s/g, '_').toLowerCase()}_logo.png`,
          type: 'Fast Food', // 示例
          offer: 'Get 20% off!' // 示例
        },
        showDecisionLayer: true // 显示决策浮层
      });
    }, 3500); // 略长于CSS过渡时间
  },

  // ... 其他按钮点击事件和逻辑
});