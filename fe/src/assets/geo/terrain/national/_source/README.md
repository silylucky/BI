# 卫星源图（sat-hunter 手动导出）

将 sat-hunter 按行政区轮廓下载的 PNG 放入此目录：

| 文件 | 说明 |
|------|------|
| `diffuse.png` | 卫星彩色底图（高德/Google 卫星，必需） |
| `normal.png` | ESRI Hillshade 或同类阴影图（推荐） |

然后在上级目录执行：

```bash
cd fe && pnpm run build:geo-terrain
```

**或使用构建期自动下载（轮廓 mask + ESRI，对标 sat-hunter）**：

```bash
cd fe && pnpm run fetch:terrain-sat -- --force && pnpm run build:geo-terrain
```

> 运行时只加载上级目录的 `diffuse.webp` / `normal.webp`，符合 GEO-IRON-01。
