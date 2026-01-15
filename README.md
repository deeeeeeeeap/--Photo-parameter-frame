# LensFrame 📸

**摄影海报生成器** - 为您的照片添加专业相框效果

![LensFrame](https://img.shields.io/badge/Electron-31-blue) ![Sharp](https://img.shields.io/badge/Sharp-0.33-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ 功能特点

- 🎨 **毛玻璃模板** - Apple 风格磨砂玻璃效果，饱和度增强 + 高斯模糊
- 📷 **经典白底模板** - 简洁干净的白色背景
- 🏷️ **自动 EXIF 读取** - 相机型号、镜头、焦距、光圈、快门、ISO
- 🖼️ **品牌 Logo 显示** - 支持 Sony、Nikon、Canon、Fujifilm、Leica 等主流品牌
- ⚡ **可自定义 Logo 大小** - 50% ~ 200% 滑块调节
- 📁 **批量导出** - 一键处理多张照片
- 🚀 **快速导出模式** - 限制最大 3000px 加速渲染

## 📥 下载

从 [Releases](../../releases) 页面下载最新版本的 ZIP 文件，解压后运行 `LensFrame.exe`。

## 🎯 使用方法

1. 拖拽或点击添加图片
2. 选择模板（毛玻璃/经典白底）
3. 调整 Logo 大小（可选）
4. 选择导出格式和质量
5. 点击"生成海报"或"批量导出"

## 🔧 自定义 Logo

支持添加自定义品牌 Logo（如手机品牌联动：小米→徕卡、OPPO→哈苏、vivo→蔡司）

详见 `resources/logo/Logo_Guide_教程.txt`

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 开发模式
npm start

# 打包
npm run make
```

## 📋 技术栈

- **Electron** - 跨平台桌面应用
- **Sharp** - 高性能图像处理
- **exifr** - EXIF 元数据读取

## 📄 License

MIT License

---

Made with ❤️ for photographers
