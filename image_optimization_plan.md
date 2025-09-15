# 餐厅图片分包优化方案

## 当前情况分析
- 总计72张餐厅PNG图片位于 `/images/restaurants/` 目录
- 首屏加载前10个餐厅（restaurant_data.json中的前10条记录）
- 图片路径引用：`/packageRestaurant/images/restaurantpic/${item.id}.png`
- 实际图片位置：`/images/restaurants/${restaurantName}.png`

## 分组策略

### 第一组：首屏必需图片（保留在主包）
基于restaurant_data.json前10条记录的餐厅：
1. putiancanting.png (莆田餐厅 - sh_001)
2. lanwa.png (蓝蛙 - sh_002)
3. Baker&Spice.png (Baker&Spice - sh_003)
4. wogesi.png (沃歌斯 - sh_004)
5. chaojiwan.png (超级碗 - sh_005)
6. chenxianggui.png (陈香贵 - sh_006)
7. majiyong.png (马记永 - sh_007)
8. maidanglao.png (麦当劳 - sh_008)
9. kendeji.png (肯德基 - sh_009)
10. hanbaowang.png (汉堡王 - sh_010)

### 第二组：次要展示图片（packageA分包）
第11-40个餐厅对应的图片（约30张）

### 第三组：低频访问图片（packageB分包）
第41-72个餐厅对应的图片（约32张）

## 实施步骤
1. 在packageA和packageB中创建images/restaurants目录
2. 将对应图片移动到各分包目录
3. 更新图片路径引用逻辑
4. 实现按需加载机制