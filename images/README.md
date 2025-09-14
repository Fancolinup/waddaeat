# 静态资源目录说明

## 目录结构

```
images/
├── icons/          # 图标文件
├── banners/        # 轮播图
├── restaurants/    # 餐厅图片
├── avatars/        # 用户头像
└── common/         # 通用图片
```

## 文件命名规范

- 使用小写字母和下划线
- 图标文件：`icon_name.png`
- 轮播图：`banner_01.jpg`
- 餐厅图片：`restaurant_id.jpg`
- 通用图片：`common_name.png`

## 图片规格建议

- 图标：64x64px (2x), 32x32px (1x)
- 轮播图：750x300px
- 餐厅图片：400x300px
- 头像：200x200px

## 注意事项

1. 优先使用 SVG 格式的矢量图标
2. 图片文件大小控制在 200KB 以内
3. 使用合适的压缩比例保证清晰度
4. 为不同分辨率准备 @2x 和 @3x 版本