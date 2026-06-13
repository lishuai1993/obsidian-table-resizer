# Obsidian Table Resizer Plugin

一个用于Obsidian的插件，允许通过拖拽调整Markdown表格列宽度。

## 功能特性

- 🎯 **拖拽调整列宽** - 直接拖拽表格列边界调整宽度
- 📊 **可视化反馈** - 拖拽时显示调整手柄和视觉提示
- ⚙️ **可配置** - 自定义最小/最大列宽限制
- 💾 **设置持久化** - 自动保存和加载配置
- 🔄 **实时预览** - 在预览模式下实时调整

## 兼容性

- **最低版本**: Obsidian 1.12.7
- **支持平台**: 桌面端、移动端

## 安装

### 手动安装

1. 下载最新版本的 `main.js`、`manifest.json` 和 `styles.css`
2. 在你的Obsidian vault中创建文件夹：`.obsidian/plugins/table-resizer/`
3. 将下载的文件复制到该文件夹
4. 重启Obsidian
5. 在设置中启用插件

### 开发安装

```bash
# 克隆仓库
git clone https://github.com/your-username/obsidian-table-resizer.git

# 进入目录
cd obsidian-table-resizer

# 安装依赖
npm install

# 构建插件
npm run build

# 运行测试
npm test
```

## 使用方法

1. 在Obsidian中打开包含表格的Markdown文件
2. 切换到阅读视图
3. 将鼠标悬停在表格列边界上
4. 当光标变为调整大小图标时，拖拽调整列宽
5. 释放鼠标完成调整

## 命令

- **Toggle table resizer** - 启用/禁用表格调整功能

## 配置

在插件设置中可以配置：

- **Enable Resizer**: 启用或禁用调整功能
- **Min Column Width**: 最小列宽（像素）
- **Max Column Width**: 最大列宽（像素）
- **Save Widths**: 是否保存宽度设置

## 开发

### 项目结构

```
obsidian-table-resizer/
├── main.ts              # 主插件代码
├── manifest.json        # 插件清单
├── styles.css          # 样式文件
├── package.json        # Node.js配置
├── tsconfig.json       # TypeScript配置
├── esbuild.config.mjs  # 构建配置
├── test/               # 测试文件
│   ├── setup.ts
│   ├── dom.test.ts
│   └── integration.test.ts
└── README.md
```

### 构建

```bash
# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build
```

### 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch
```

## 技术栈

- **TypeScript** - 类型安全的JavaScript
- **Jest** - 测试框架
- **jsdom** - DOM模拟环境
- **esbuild** - 快速构建工具

## 已知限制

- 调整后的宽度仅在预览模式下生效
- Markdown源码不会自动更新（Markdown语法不支持列宽）
- 复杂的嵌套表格可能无法正确调整

## 贡献

欢迎提交Issue和Pull Request！

1. Fork本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交Pull Request

## 许可证

MIT License

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本的表格列宽调整
- 完整的自动化测试覆盖
