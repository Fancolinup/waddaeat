# 微信小程序开发对话记录

## 项目概述
- 项目名称：Eatigo 微信小程序
- 开发时间：2024年
- 技术规范：基于 webspec.md 文档要求

## 对话记录

### 2024年对话 - 项目初始化

**用户需求：**
1. 从零开始开发微信小程序
2. 严格遵循 webspec.md 技术规范文档
3. 创建 chat_history.md 记录对话内容
4. 优先搭建基础框架结构
5. 保持现有 JSON 文件不变

**AI 响应：**
- 已阅读技术规范文档，了解微信小程序双线程模型、数据驱动理念等要求
- 创建了对话记录文件 chat_history.md
- 完成基础框架结构搭建

**已完成的工作：**

1. **基础目录结构创建**
   - pages/ (页面目录)
   - components/ (组件目录)
   - utils/ (工具函数目录)
   - assets/ (资源目录)
   - images/ (图片目录)
   - styles/ (样式目录)

2. **核心配置文件**
   - app.json (小程序配置)
   - app.js (应用入口)
   - app.wxss (全局样式)
   - sitemap.json (站点地图)

3. **首页页面文件**
   - pages/index/index.js (页面逻辑)
   - pages/index/index.wxml (页面结构)
   - pages/index/index.wxss (页面样式)
   - pages/index/index.json (页面配置)

4. **通用组件**
   - components/loading/ (加载组件)

5. **工具函数**
   - utils/util.js (通用工具函数)
   - utils/request.js (网络请求封装)

6. **静态资源**
   - images/placeholder.svg (占位图标)
   - images/README.md (资源说明)

**框架特点：**
- 遵循微信小程序官方规范
- 采用模块化组件设计
- 包含完整的工具函数库
- 支持网络请求封装
- 响应式设计支持

---

### 2024年对话 - 产品需求理解

**用户提供产品概述：**

**产品定位调整：** 从餐厅预订应用调整为决策辅助工具
- 产品愿景：为用户提供有趣、个性化的决策辅助工具，通过游戏化交互解决选择困难问题
- 目标用户：20-35岁年轻职场人群，面临餐饮选择困难，喜欢轻量级娱乐应用
- 核心痛点：
  - 群体决策效率低：工作餐选择平均耗时10-15分钟
  - 个人决策焦虑：面对过多选项时产生心理压力
  - 现有工具不足：随机数生成器过于机械，缺乏个性化能力

**核心价值主张：**
- 极简操作，3次点击完成决策
- 越用越懂你的个性化推荐
- 每日轻量内容提升用户粘性和转发意愿

**商业化模式：**
- 短期：IAA模式（启动广告、banner广告）
- 中长期：混合模式（会员订阅制、场景扩展付费）

**产品结构概览理解：**

**核心架构：**
- 微信小程序，采用纯本地数据存储策略（wx.setStorageSync）
- 所有用户数据（偏好、历史、收藏）均存储在用户设备上，无需后端服务器
- 核心是混合推荐系统：基于规则的协同过滤 + 基于内容特征的机器学习

**页面结构分析（重新理解）：**

*正确的页面结构：*
**三个Tab页面：**
1. **今日选择页** (pages/index/index) - 核心决策页面
2. **职场嘴替页** (pages/voice/voice) - 内容互动页面  
3. **个人中心页** (pages/profile/profile) - 用户管理页面

**今日选择页内部复杂结构：**
- 欢迎页 (pages/welcome/welcome) - 首次启动导航页
- 转盘区 - 核心交互组件
- 结果浮层 - 动态显示组件
  - 分享文案区 - 结果浮层的子组件
- 备选区 - 用户自定义区域
- 决策区 - 就这家/换一个/备选 按钮

**职场嘴替页组件：**
- 语录卡片 - 页面内组件
- 投票卡片 - 页面内组件

**个人中心页组件：**
- "我的喜好"浮层 - 页面内组件
- "我的选择"浮层 - 页面内组件
- "我的收藏"浮层 - 页面内组件

*与当前项目对比：*
- 当前有四个Tab页面，需要调整为三个
- 需要新增 pages/voice/voice 和 pages/welcome/welcome 页面
- 需要删除 pages/restaurant 和 pages/booking 页面
- 今日选择页需要重新设计为决策辅助工具的核心交互界面

### 核心数据流与状态管理架构理解

**数据来源 (Data Sources)：**

*静态数据 (Static Data):*
- `data/restaurant_data.json` - 系统预设的餐厅数据集
- `data/app_content.json` - 系统预设的语录和投票话题

*用户数据 (User Data) - 通过 wx.getStorageSync('userData') 读写:*
- `tasteProfile` (对象) - 用户抽象的口味偏好向量（辣、甜、咸权重）
- `restaurantScores` (对象) - 用户对具体餐厅的评分（协同过滤）
- `decisionHistory` (数组) - 用户的决策历史记录
- `contentInteractions` (对象) - 用户对"职场嘴替"内容的互动（点赞、收藏）
- `customRestaurants` (数组) - 用户手动添加的餐厅名称
- `welcomeSelections` (数组) - 用户在欢迎页选择的餐厅ID

**关键数据流 (Key Data Flow)：**

1. **今日选择页 → 用户数据**：每次决策（"就这家"、"换一个"、"备选"）触发 scoringManager 和 preferenceLearner 模块，更新 restaurantScores 和 tasteProfile

2. **用户数据 → 今日选择页**：generateRecommendations 函数读取最新 userData 生成个性化推荐

3. **欢迎页 → 用户数据**：用户选择和添加操作初始化 welcomeSelections 和 customRestaurants，并为这些餐厅设置高分

4. **职场嘴替页 → 用户数据**：点赞、收藏、投票操作更新 contentInteractions

**核心功能模块 (Utils)：**

1. `dataManager.js` - 用户数据的增删改查中心（getUserData, updateUserData, addDecisionRecord等）
2. `scoringManager.js` - 协同过滤核心，管理基于明确规则的餐厅评分（updateRestaurantScore, getCurrentRestaurantScore）
3. `preferenceLearner.js` - 内容过滤核心，管理用户抽象口味偏好（updateUserPreference, calculatePreferenceScore）
4. `recommendation.js` - 推荐算法入口，调用上述模块执行混合推荐（generateRecommendations）
5. `shareUtils.js` - 处理分享图片生成和文案复制

### 分包策略设计

**分包规则：**
- **主包** (/pages/, /utils/, /components/) - 启动页、加载页、核心功能页（今日选择、欢迎页、职场嘴替、个人中心）、全局工具函数和TabBar图标、前10个餐厅图片
- **分包A** (/packageA/) - 职场嘴替扩展功能(voice-extra)、餐厅ID 11-40图片资源
- **分包B** (/packageB/) - 个人中心扩展功能(profile-extra)、餐厅ID 41+图片资源

**最新分包结构：**

**主包 (Main Package) - 143.22 KB 图片 + 核心功能**
```
├── pages/
│   ├── loading/loading - 加载页面
│   ├── index/index - 首页餐厅推荐 (TabBar)
│   ├── welcome/welcome - 欢迎引导页
│   ├── voice/index - 职场嘴替页面 (TabBar)
│   └── profile/profile - 个人中心页面 (TabBar)
├── utils/ - 工具函数库 (dataManager, recommendation, scoringManager等)
├── images/restaurants/ - 餐厅ID 1-10 图片 (143.22 KB)
├── components/ - 公共组件
└── assets/ - 全局资源
```

**分包A (PackageA - voice-extra) - 819.2 KB 图片**
```
├── root: "packageA"
├── name: "voice-extra"
├── images/restaurants/ - 餐厅ID 11-40 图片 (819.2 KB)
└── pages/voice/ - 职场嘴替扩展页面
```

**分包B (PackageB - profile-extra) - 1569.08 KB 图片**
```
├── root: "packageB"
├── name: "profile-extra"
├── images/restaurants/ - 餐厅ID 41+ 图片 (1569.08 KB)
└── pages/profile/ - 个人中心扩展页面
```

**优化效果：**
- 主包体积减少：2388.28 KB (约2.3MB)
- 分包比例：主包 5.7% | 分包A 32.4% | 分包B 62%
- 图片路径智能分配：buildImagePath()函数根据餐厅ID自动选择对应分包路径
- 按需加载：首屏优先加载主包，滚动时按需加载对应分包图片

**优化后的目录结构：**
```
miniprogram/
├── app.js
├── app.json
├── app.wxss
├── assets/           # 主包公共资源（主Tab图标、通用图片）
├── utils/            # 主包公共工具库
│   ├── dataManager.js
│   ├── scoringManager.js
│   ├── preferenceLearner.js
│   ├── recommendation.js
│   └── shareUtils.js
├── packageA/         # 【分包A】职场嘴替模块
│   ├── pages/        # 分包页面
│   │   └── voice/    # 职场嘴替页
│   ├── assets/       # 分包专属资源（语录、投票相关图片）
│   └── components/   # 分包专属组件（语录卡片、投票卡片）
├── packageB/         # 【分包B】个人中心模块
│   └── pages/        # 分包页面
│       └── profile/  # 个人中心页
└── pages/            # 【主包】页面
    ├── index/        # 今日选择页（核心功能）
    ├── loading/      # 加载页（启动必需）
    └── welcome/      # 欢迎页（与核心功能强相关）
```

**分包配置详情：**
```json
{
  "pages": [
    "pages/loading/loading",   // 主包-启动加载页
    "pages/index/index",      // 主包-核心页
    "pages/welcome/welcome"    // 主包-核心流程页
  ],
  "subPackages": [
    {
      "root": "packageA",     // 分包A的根目录
      "name": "voice",        // 分包别名
      "pages": [
        "pages/voice/index"   // 分包页面路径（相对于root）
      ],
      "independent": false    // 非独立分包
    },
    {
      "root": "packageB",     // 分包B的根目录
      "name": "profile",      // 分包别名
      "pages": [
        "pages/profile/profile" // 分包页面路径（相对于root）
      ],
      "independent": false    // 非独立分包
    }
  ],
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",           // 今日选择（主包）
        "text": "今日选择"
      },
      {
        "pagePath": "packageA/pages/voice/index",  // 职场嘴替（分包A）
        "text": "职场嘴替"
      },
      {
        "pagePath": "packageB/pages/profile/profile", // 个人中心（分包B）
        "text": "个人"
      }
    ]
  }
}
```

**跳转规则：**
- 跳转到分包页面使用：`wx.navigateTo({ url: '/packageA/pages/voice/index' })`
- 路径必须以 '/' 开头，使用完整路径

### 数据管理工具函数开发需求理解

#### PRD核心要求

**模块名称**：`dataManager.js`
**功能定位**：统一管理小程序的本地数据存储和读取
**技术要求**：ES6+语法，模块化编写，清晰注释

#### 需要实现的6个核心函数

1. **`initUserData()`**
   - 功能：初始化用户数据，如果本地没有则创建默认结构
   - 默认数据结构包含：
     - `tasteProfile`：口味偏好权重
     - `restaurantScores`：协同过滤模型的餐厅评分
     - `decisionHistory`：决策历史记录数组
     - `contentInteractions`：内容互动记录

2. **`getUserData()`**
   - 功能：同步获取完整的用户数据对象

3. **`updateUserData(key, value)`**
   - 功能：更新用户数据中的特定字段并自动保存
   - 支持嵌套属性更新（如：`'tasteProfile.spicy'`）

4. **`addDecisionRecord(record)`**
   - 功能：向决策历史数组添加新记录并自动保存
   - 记录结构：`{ timestamp, options, selected, feedback }`

5. **`getRestaurantData()`**
   - 功能：从本地静态文件 `restaurant_data.json` 获取餐厅数据
   - 使用 `require` 导入

6. **`getAppContent()`**
   - 功能：从本地静态文件 `app_content.json` 获取语录和投票数据
   - 使用 `require` 导入

#### 技术实现要点

- 使用 `wx.setStorageSync` 和 `wx.getStorageSync` 进行本地存储
- 需要处理异常情况
- 支持嵌套属性的更新操作
- 模块化导出，便于其他文件引用

#### 数据结构设计

**用户数据默认结构**：
```javascript
{
  tasteProfile: { spicy: 0.5, sweet: 0.5, ... }, // 口味偏好权重
  restaurantScores: { 
    // "餐厅ID": 当前偏好分 (基于初始分和用户互动计算得出)
    // "bj_guomao_001": 6.5,
    // "user_added_1": 9.0,
  },
  decisionHistory: [], // 决策历史记录
  contentInteractions: { likedQuotes: [], votedTopics: {} } // 内容互动记录
}
```

**决策记录结构**：
```javascript
{
  timestamp: Date.now(),
  options: [], // 选项数组
  selected: String, // 选中的选项
  feedback: 'like'/'dislike' // 用户反馈
}
```

#### 开发注意事项

1. **异常处理**：需要处理存储读取失败的情况
2. **数据完整性**：确保初始化时创建完整的数据结构
3. **性能考虑**：同步操作，避免异步复杂性
4. **扩展性**：设计时考虑未来可能的数据结构变化
5. **调试友好**：添加清晰的注释和错误日志

#### 实现完成情况

✅ **已完成文件**：
- `utils/dataManager.js` - 数据管理工具模块（完整实现）
- `使用Pilot dialogues.json` - 替代app_content.json，使用预设的对话数据文件

✅ **核心功能实现**：
1. `initUserData()` - 用户数据初始化，支持数据结构升级
2. `getUserData()` - 同步获取用户数据，自动容错处理
3. `updateUserData(key, value)` - 支持嵌套属性更新（如 `tasteProfile.spicy`）
4. `addDecisionRecord(record)` - 决策记录添加，完整的参数验证
5. `getRestaurantData()` - 餐厅数据获取，使用现有 `restaurant_data.json`
6. `getAppContent()` - 应用内容获取，新建 `app_content.json` 数据源

✅ **技术特性**：
- ES6+ 语法和模块化设计
- 完善的异常处理和错误日志
- 数据结构自动合并和升级机制
- 嵌套属性路径解析支持
- 详细的JSDoc注释文档
- 微信小程序存储API集成

### preferenceLearner.js 模块需求理解

#### 模块概述
`preferenceLearner.js` 是一个用于处理用户口味偏好的提取、学习和计算的工具模块，为小程序提供本地化的偏好学习系统。

#### 核心功能

##### 1. 特征提取函数 `extractFeatureVector(restaurant)`
- **功能**：从餐厅数据中提取标准化特征向量
- **输入**：餐厅对象（包含tags、spicyScore、healthScore、priceLevel等属性）
- **输出**：特征向量对象，与用户tasteProfile结构一致
- **映射规则**：
  - spicy: 直接使用restaurant.spicyScore
  - sweet: 根据tags判断，包含关键词则0.7-0.9，否则0.3
  - salty: 根据tags判断，包含关键词则0.7-0.9，否则0.3
  - light: 计算(1 - spicyScore) * healthScore
  - greasy: 根据tags判断，包含关键词则0.7-0.9，否则0.3
  - price: priceLevel(1-3)映射到0.3/0.6/0.9
  - health: 直接使用restaurant.healthScore
- **约束**：所有输出值必须在[0,1]范围内

##### 2. 用户偏好更新函数 `updateUserPreference(userData, restaurant, feedback)`
- **功能**：根据用户反馈更新用户的口味偏好
- **输入**：用户数据对象、餐厅对象、反馈字符串('like'/'dislike')
- **输出**：无（直接修改传入的userData对象）
- **算法逻辑**：
  - 获取餐厅特征向量R
  - 获取用户当前偏好向量U
  - 学习率alpha=0.1
  - 根据反馈确定更新方向
  - 对每个特征执行梯度更新：U[k] = U[k] + alpha * direction * (R[k] - U[k])
  - 确保更新后的值在[0,1]范围内
  - 保存更新后的用户数据

##### 3. 偏好匹配度计算函数 `calculatePreferenceScore(restaurant, userTasteProfile)`
- **功能**：计算餐厅与用户口味的匹配度
- **输入**：餐厅数据对象、用户口味偏好对象
- **输出**：0-1之间的匹配度分数
- **算法逻辑**：
  - 获取餐厅特征向量R
  - 计算余弦相似度
    - 点积：sum(R[k] * userTasteProfile[k])
    - 模长：sqrt(sum(R[k]^2)) 和 sqrt(sum(userTasteProfile[k]^2))
    - 相似度：点积/(模长R * 模长U)
  - 将相似度从[-1,1]映射到[0,1]：(相似度+1)/2

#### 技术要求
- 使用ES6+语法
- 模块化编写
- 清晰的注释和错误处理
- 详细的JSDoc注释

#### 实现完成情况

✅ **已完成文件**：
- `utils/preferenceLearner.js` - 偏好学习模块（完整实现）

✅ **核心功能实现**：
1. `extractFeatureVector(restaurant)` - 从餐厅数据中提取标准化特征向量
2. `updateUserPreference(userData, restaurant, feedback)` - 根据用户反馈更新口味偏好
3. `calculatePreferenceScore(restaurant, userTasteProfile)` - 计算餐厅与用户口味的匹配度

✅ **技术特性**：
- 使用ES6+语法和模块化设计
- 实现了基于梯度下降的偏好学习算法
- 使用余弦相似度计算口味匹配度
- 完善的特征提取和映射系统
- 详细的JSDoc注释和错误处理

### scoringManager.js 模块需求理解

#### 模块概述
`scoringManager.js` 是一个用于管理餐厅评分的工具模块，负责根据用户操作更新餐厅评分和获取当前餐厅评分。

#### 核心功能

##### 1. 餐厅评分更新函数 `updateRestaurantScore(userData, restaurantId, action, restaurantData)`
- **功能**：根据用户操作更新餐厅评分
- **输入**：用户数据对象、餐厅ID、用户操作('accept'/'reject')、餐厅数据对象
- **输出**：无（直接修改传入的userData对象）
- **业务规则**：
  - 初始值判断：如果用户数据中没有该餐厅评分，则调用getCurrentRestaurantScore获取初始分
  - 餐厅类型判断：
    - 用户手动添加的餐厅：ID以"user_added_"开头
    - 用户欢迎页选择的餐厅：ID存在于userData.welcomeSelections数组中
    - 系统预设餐厅：其他情况
  - 更新规则：
    - 'accept'操作：系统预设+2分，欢迎页选择+1.5分，手动添加+1分
    - 'reject'操作：系统预设-1分，欢迎页选择-0.8分，手动添加-0.5分
  - 边界限制：分数必须在[0, 10]范围内

##### 2. 餐厅当前评分获取函数 `getCurrentRestaurantScore(userData, restaurantId, restaurantData)`
- **功能**：获取餐厅当前评分
- **输入**：用户数据对象、餐厅ID、餐厅数据对象
- **输出**：餐厅的当前偏好分（数字）
- **获取逻辑**：
  1. 如果userData.restaurantScores[restaurantId]存在，返回该值
  2. 根据餐厅类型返回默认高分：
     - 用户手动添加的餐厅：返回9分
     - 用户欢迎页选择的餐厅：返回8分
  3. 对于系统预设餐厅，如果restaurantData.basePreferenceScore存在，返回该值
  4. 最终兜底：返回5分

#### 辅助函数

1. **isUserAddedRestaurant(restaurantId)**
   - 功能：检查是否为用户手动添加的餐厅
   - 输入：餐厅ID
   - 输出：布尔值

2. **isWelcomeSelection(restaurantId, userData)**
   - 功能：检查是否为欢迎页选择的餐厅
   - 输入：餐厅ID，用户数据对象
   - 输出：布尔值

3. **clampScore(score)**
   - 功能：确保分数在[0, 10]范围内
   - 输入：分数
   - 输出：限制在范围内的分数

#### 技术要求
- 使用ES6+语法
- 添加健壮的错误处理
- 添加详细的JSDoc注释
- 模块化设计，导出所有函数

**架构优势：**
1. 本地存储策略保护用户隐私
2. 无需服务器降低运营成本
3. 混合推荐系统提供精准个性化服务
4. 模块化设计便于维护和扩展
5. 数据流清晰，状态管理统一
6. 分包策略优化加载性能，职场嘴替模块按需加载
7. 主包保持轻量，核心功能快速启动

**AI 分析：**
- 需要重新调整现有框架，从餐厅预订转向决策辅助工具
- 核心功能应围绕游戏化决策体验设计
- 需要个性化推荐算法和用户行为分析
- 界面设计需要更加轻松有趣，符合年轻用户喜好
- 当前四个Tab页面结构需要调整为三个主要Tab页面

---

## 项目结构调整记录

### 2025年1月14日 - 项目结构重构完成
**按照正确的设计文档重新调整项目结构：**

#### 删除的内容
- 删除错误页面：`pages/restaurant/` 和 `pages/booking/`
- 删除错误分包：`packageRestaurant/`（包含80张图片，约2.6MB）

#### 新增的内容
- 创建加载页面：`pages/loading/`（主包启动页面）
- 创建欢迎页面：`pages/welcome/`（主包引导页面）
- 创建新分包：`packageA/pages/voice/`（职场嘴替功能）

#### app.json 配置调整
- **主包页面**：loading → index → welcome → profile
- **分包配置**：packageA（职场嘴替页面）
- **TabBar调整**：3个入口（今日选择、职场嘴替、个人）
- **启动流程**：loading → welcome → index

#### 项目结构现状
```
**当前分包结构 (已优化)：**

主包 (143.22 KB 图片)：
- pages/loading/     # 启动加载页
- pages/index/       # 今日选择页（Tab）- 包含buildImagePath智能路径分配
- pages/welcome/     # 欢迎引导页
- pages/voice/       # 职场嘴替页（Tab）
- pages/profile/     # 个人中心页（Tab）
- utils/            # 完整工具函数库 (dataManager, recommendation等)
- images/restaurants/ # 餐厅ID 1-10 图片资源

分包A (packageA - 819.2 KB 图片)：
- name: "voice-extra"
- images/restaurants/ # 餐厅ID 11-40 图片资源
- pages/voice/       # 职场嘴替扩展功能

分包B (packageB - 1569.08 KB 图片)：
- name: "profile-extra"
- images/restaurants/ # 餐厅ID 41+ 图片资源
- pages/profile/     # 个人中心扩展功能

**性能优化成果：**
- 主包减少 2388.28 KB，启动速度显著提升
- 智能图片分包，按需加载机制完善
- 总图片 2531.5 KB，合理分布在三个包中
```

---

*此文件将持续更新记录开发过程中的所有重要对话内容*

---

### 2025-09-17 欢迎页重要改动（最新摘要）

本节为对 packageA/pages/welcome 的最新一次集中修改摘要，追加记录在文末，便于后续追踪与对比（不删除历史）。

- 颜色与样式
  - 主色从绿色改为紫晶色：#7C4DFF；统一移除旧绿色（#27AE60、#2ECC71）残留。
  - 选中态采用 box-shadow 圆环，避免因 border 导致的布局抖动：0 0 0 5rpx #7C4DFF；
    - 外发光：rgba(124,77,255,0.16)
    - 柔和下投影：rgba(124,77,255,0.22)
  - 呼吸动画统一为紫色梯度：#7C4DFF → #A08BFF → #7C4DFF（透明度优化为 0.85）。

- 交互与行为
  - 手动添加餐厅默认即为选中：新增项的 selected = true，并立刻把其 sid 推入 selectedRestaurants。
  - 添加成功后提示：wx.showToast 文案为“已添加至列表末尾”，时长 1500ms。

- 模板与状态绑定
  - 以 item.selected 直接控制 selected 类；不再通过 selectedRestaurants.indexOf(item.sid) 做选中判断，避免类型/比较异常导致“默认全选”。
  - sid 统一为字符串类型，确保与 selectedRestaurants 的比较一致。

- 存储与持久化
  - 使用 wx.setStorageSync('welcomeSelections', selectedRestaurants) 持久化用户在欢迎页的选择结果。

- 兼容性与稳定性
  - 通过纯 box-shadow 环形描边提升不同终端一致性；不改变布局盒模型。
  - 图片加载失败提供兜底回退到可用 logo 或占位图，避免重复触发错误。

- 影响范围与文件
  - 主要涉及：welcome.wxss（选中态样式与动画配色）、welcome.js（新增默认选中与 Toast 提示）。
  - 未改动其它业务模块及静态数据文件。

- 辅助预览（不影响小程序实体）
  - 颜色对比页：preview/selection-preview.html（6 种主色并排对比）。
  - 添加交互演示：preview/add-custom-preview.html（新增项默认选中 + 提示）。

- 验证建议
  - 模拟器：验证选中高亮是否为紫晶色、卡片无布局抖动、Toast 文案正确。
  - 真机：清缓存后重跑，确认 logo 回退正常、欢迎页守卫逻辑与持久化一致。