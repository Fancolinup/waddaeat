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

9. CSS 布局与位置调整最佳实践

元素位置调整策略
● **优先使用 transform**: 对于需要精确位置调整的元素，优先使用 `transform: translateX()` 和 `translateY()` 而非 margin 或 padding。
● **transform 的优势**:
  ○ 不受其他布局元素影响，独立于文档流
  ○ 不会触发重排（reflow），性能更好
  ○ 可以精确控制元素位置，避免布局冲突
● **margin 调整的局限性**:
  ○ 容易被其他CSS规则覆盖或影响
  ○ 在复杂布局中可能产生意外的布局偏移
  ○ 负margin可能与相邻元素的transform产生冲突

布局层级管理
● **z-index 配合使用**: 位置调整时注意设置合适的 `z-index` 确保元素层级正确。
● **相对定位**: 使用 `position: relative` 配合 `transform` 进行微调，避免影响其他元素布局。
● **检查布局依赖**: 调整元素位置前，检查是否有其他元素使用了 `transform` 或特殊定位，避免相互干扰。

调试技巧
● **逐步调试**: 位置调整不生效时，先检查CSS优先级和布局流，再考虑使用不同的定位方式。
● **浏览器开发工具**: 使用开发者工具检查元素的实际计算样式，确认CSS规则是否生效。
● **分离测试**: 将位置调整的CSS规则单独测试，排除其他样式的干扰。

示例对比
```css
/* ❌ 不推荐：使用负margin调整位置 */
.element {
  margin-top: -50rpx; /* 可能被其他布局影响 */
}

/* ✅ 推荐：使用transform调整位置 */
.element {
  position: relative;
  transform: translateY(-50rpx); /* 独立于布局流，更可靠 */
  z-index: 10; /* 确保层级正确 */
}
```

附：定位与微调实战规范与避坑（项目经验沉淀）

定位方式选择顺序（由高到低）
- 不改变周围布局的微调：position: relative + top/left/right/bottom（优先）
- 动画或交互联动：transform: translate(...)（仅用于需要过渡/动画的节点）
- 彻底脱离文档流的锚定：position: absolute + 明确定位上下文（父级 position: relative）
- 区块间距控制：使用 margin（调整相邻区块间距）

何时避免使用 transform
- 目标元素或祖先在状态切换时会应用 transform（例如 .xxx.switching），你的 translate 可能被覆盖或叠加导致不可预测
- 需要影响命中区域/滚动区域的几何尺寸（transform 不改变布局尺寸，仅改变视觉）
- 需要参与容器尺寸计算（transform 不会改变占位，可能导致对齐错位）

关于负值与流影响
- padding 不能为负，不能通过负 padding 缩小间距
- 负 margin 会影响兄弟元素布局，容易产生“联动位移”，非必要不要用
- top/bottom/left/right 仅改变自身视觉位置，不会挤压兄弟元素，适合局部上/下/左/右微移

绝对定位要点
- 明确定位上下文：最近的祖先必须设 position: relative（或 absolute/fixed），否则锚点不受控
- 优先用 bottom/right 等相对锚点，避免硬编码 magic number
- 注意交互区域不被遮挡；必要时配合 z-index，同时避免滥用极大 z-index

堆叠上下文与 z-index
- transform、filter、opacity<1 等会创建新的 stacking context，子元素 z-index 可能被“困住”
- 覆盖层需在相同 stacking context 或将父级 z-index 一并抬高

分层与职责
- 避免同一节点既用于状态动画（transform）又用于静态微调（translate/top 同时存在）
- 使用“外包裹层用于静态微调，内层用于动画”的分层策略，降低冲突

本项目最佳实践示例
- 切换区容器微调：将切换按钮容器仅上移 15rpx，采用 position: relative + top: -15rpx，而非 translateY，原因：
  - 切换状态类可能在目标或祖先节点上写入 transform，translateY 易被复写或叠加
  - top 仅影响自身视觉位置，不改变其它节点布局，避免色盘按钮、轮盘等组件发生联动位移
- 右下角锚定按钮：将按钮放在轮盘容器内部；父容器设 position: relative，按钮设 position: absolute; right/bottom 指定间距，获得稳定锚定

调试清单
- 检查计算样式与优先级（是否被更高优先级选择器覆盖）
- 检查是否存在状态类（如 .switching）在切换时写入 transform
- 检查点击/触摸区域是否与视觉位置一致（尤其在使用 transform 时）
- 检查不同机型与 DPR 下 rpx 缩放表现
- 多轮切换/动画后是否出现“累积位移”或错位

统一单位与可维护性
- 定位与微调统一使用 rpx，避免 px 带来的适配偏差
- 避免魔法数；需要时加注释说明来源与依赖
- 避免在多处重复定义偏移值，必要时抽为公共样式变量（或集中注释）
```