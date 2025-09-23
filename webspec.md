本文档旨在明确本项目（微信小程序）的技术规范和约束，请严格遵循。任何生成的代码都必须与微信小程序的环境和能力兼容。
1. 核心架构与理念
双线程模型
● 逻辑层 (App Service): 运行 .js 文件，处理业务逻辑、API 调用、数据存储。使用 JavaScript 引擎。
● 视图层 (WebView): 渲染 WXML 模板和 WXSS 样式。逻辑层与视图层分离，通过数据绑定和事件系统进行通信。
● 绝对禁止: 不能直接操作 DOM (如 document.getElementById, element.style)。所有 UI 更新必须通过 数据驱动 模式实现。
数据驱动
● UI 是数据的映射。只需修改 Page 或 Component 中的 data 字段，视图会自动更新。
● 更新数据必须且只能使用 this.setData() 方法。直接赋值 this.data.someField = ... 不会更新视图。
2. 文件结构与组件
页面文件
每个页面由同名四个文件组成，缺一不可：
● page-name.js: 页面逻辑
● page-name.json: 页面配置
● page-name.wxml: 页面结构（模板）
● page-name.wxss: 页面样式
自定义组件
● 必须使用 Component({...}) 构造器，而非 Page({...})。
● 组件的属性必须在 properties 中定义。
● 组件的方法必须定义在 methods 字段中。
● 组件间样式隔离，可使用 options: { addGlobalClass: true } 或 styleIsolation 选项应用外部样式。
项目结构示例
text
project-root/
├── app.js
├── app.json
├── app.wxss
├── pages/
│   └── index/
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
└── components/
    └── custom/
        ├── custom.js
        ├── custom.json
        ├── custom.wxml
        └── custom.wxss
3. 编程规范与语法
API 调用
● 所有微信原生 API 都以 wx 对象为命名空间。
优先使用 Promise 语法。例如：
● javascript
// 正确 (Promise)
wx.request({ url: '...' }).then(res => {}).catch(err => {});
// 也可用 (Callback)
wx.request({ url: '...', success() {}, fail() {} });
数据加载与文件引用
● JSON 文件限制: 微信小程序无法直接读取 .json 数据文件（如通过 require('./data.json') 或文件系统 API）。
● 正确做法: 将数据定义在 .js 文件中，使用 module.exports 导出，然后通过 require() 引入。
● 示例:
  ```javascript
  // data/config.js
  module.exports = {
    items: [{ id: 1, name: 'item1' }],
    settings: { theme: 'light' }
  };
  
  // pages/index/index.js
  const config = require('../../data/config.js');
  ```
● 动态数据: 如需动态加载数据，使用 wx.request() 从服务器获取，或使用 wx.getStorage() 读取本地存储。

数据与事件
● 数据绑定: WXML 中使用 {{ }} 语法绑定数据。
● 事件绑定: 使用 bind: 或 catch: 前缀（如 bindtap, catchtouchstart）。
● 获取事件参数: 通过 event.currentTarget.dataset 获取 data-* 自定义属性。
● 更新数据: 必须使用 this.setData({ key: value })。路径语法是支持的：this.setData({ 'obj.name': 'value' })。
WXML 模板语法
● 条件渲染: wx:if, wx:elif, wx:else
● 列表渲染: wx:for, wx:for-item, wx:for-index, wx:key
● 模板引用: <template is="templateName" data="{{...}}" />
WXS 使用
● WXS 是运行在视图层的脚本，不能调用大多数 wx.xxx API。
● 主要用于 WXML 中的过滤器或计算属性（如日期格式化）。
● 定义在 <wxs module="m1"> 标签内或外联 .wxs 文件。
4. 样式 (WXSS) 规范
● 尺寸单位: 优先使用 rpx（响应式像素），而非 px。
● 样式选择器: 支持大多数 CSS 选择器，但不能使用 * 通配符。
● 局部样式: 页面和组件的 WXSS 默认局部生效。App 的 app.wxss 是全局样式。
● 字体图标: 禁止使用外链 Web 字体。请使用 base64 或本地字体文件。
5. 路由与导航
● 禁止使用 <a> 标签或 window.location。
● 必须使用小程序导航 API：
  ○ wx.navigateTo({ url: '/pages/a/a' }): 保留当前页面，跳转新页面。
  ○ wx.redirectTo({ url: '' }): 关闭当前页面，跳转新页面。
  ○ wx.switchTab({ url: '' }): 跳转到 tabBar 页面。
  ○ wx.navigateBack(): 返回上一页面。
6. 网络与安全
● 服务器域名必须在[微信公众平台]后台配置。
● 开发阶段可在开发者工具中开启“不校验合法域名”进行调试。
● 所有网络请求必须使用 wx.request。
7. 性能与最佳实践
分包加载
● 项目必须配置分包以优化首屏加载。
● 在 app.json 中配置 subpackages 字段。
● TabBar 页面必须在主包中。
setData 优化
● 仅传输变化的数据：this.setData({ specificField: newValue })，避免传输大量无关数据。
● 严格控制 setData 的频率和数据量。
图片资源
● 必须对图片进行压缩。
● 使用懒加载：<image lazy-load></image>。
8. 常见 AI “幻觉”与禁忌清单
🚫 绝对禁止以下操作：
● ❌ 使用 document, window, jQuery 等浏览器特有对象。
● ❌ 操作 DOM (如 .querySelector, .innerHTML, .style)。
● ❌ 使用 require 引入未安装的 npm 包或未声明的模块。
● ❌ 在 WXML 中直接编写复杂的 JavaScript 逻辑（应使用 WXS 或计算后通过数据绑定传入）。
● ❌ 使用 iframe, WebSocket (需用 wx.connectSocket), alert, console 弹窗 (需用 wx.showModal)。
✅ 正确的做法：
● ✔️ 使用 wx 命名空间下的 API。
● ✔️ 使用 this.setData() 驱动视图更新。
● ✔️ 使用 wx.navigateTo 等进行路由跳转。
● ✔️ 使用 rpx 作为样式单位。
● ✔️ 在 app.json 中提前规划 pages 和 subpackages。