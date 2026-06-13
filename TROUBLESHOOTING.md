# 安装和故障排查指南

## 安装步骤

### 1. 准备文件
确保你有以下3个必需文件：
- `main.js` (已构建)
- `manifest.json` (插件清单)
- `styles.css` (样式文件，可选)

### 2. 安装插件

#### macOS/Linux
```bash
# 创建插件目录
mkdir -p "/path/to/your/vault/.obsidian/plugins/table-resizer"

# 复制文件
cp main.js manifest.json styles.css "/path/to/your/vault/.obsidian/plugins/table-resizer/"
```

#### Windows (PowerShell)
```powershell
# 创建插件目录
New-Item -ItemType Directory -Force -Path "C:\path\to\your\vault\.obsidian\plugins\table-resizer"

# 复制文件
Copy-Item main.js, manifest.json, styles.css "C:\path\to\your\vault\.obsidian\plugins\table-resizer\"
```

### 3. 启用插件
1. 重启Obsidian
2. 打开 `设置` → `第三方插件`
3. 刷新插件列表
4. 找到 "Table Resizer" 并启用

## 故障排查

### 问题1：插件加载失败

**可能原因：**
- manifest.json格式错误
- main.js文件损坏
- Obsidian版本不兼容

**解决方案：**
1. 检查Obsidian控制台（Ctrl/Cmd + Shift + I）
2. 查看错误信息
3. 验证manifest.json格式：
```bash
# 检查JSON格式
cat manifest.json | python -m json.tool
```

### 问题2：找不到插件

**解决方案：**
1. 确认文件夹名称正确：`table-resizer`
2. 确认文件位置正确：`.obsidian/plugins/table-resizer/`
3. 刷新第三方插件列表
4. 重启Obsidian

### 问题3：表格没有调整手柄

**解决方案：**
1. 切换到阅读视图（Reading View）
2. 确保表格已正确渲染
3. 检查控制台是否有JavaScript错误
4. 尝试切换到其他文件再切回来

### 问题4：拖拽不工作

**解决方案：**
1. 检查是否启用了插件
2. 查看控制台日志：
   - "Table Resizer plugin loading..."
   - "Settings loaded"
   - "Styles registered"
   - "Tables initialized"
3. 确保鼠标悬停在列的右边界

## 调试模式

启用详细日志：

1. 打开开发者工具：`Ctrl/Cmd + Shift + I`
2. 切换到 Console 标签
3. 查看以下日志：
```
Table Resizer plugin loading...
Settings loaded
Styles registered
Tables initialized
Table Resizer plugin loaded successfully
```

## 验证安装

运行以下检查：

1. **文件完整性**
```bash
# 检查文件是否存在
ls -la .obsidian/plugins/table-resizer/
# 应该看到：main.js, manifest.json, styles.css
```

2. **manifest.json内容**
```json
{
  "id": "table-resizer",
  "name": "Table Resizer",
  "version": "1.0.1",
  "minAppVersion": "0.15.0",
  "description": "Drag to resize markdown table column widths",
  "author": "Your Name",
  "authorUrl": "https://your-website.com",
  "isDesktopOnly": false
}
```

3. **Obsidian版本检查**
```
确保你的Obsidian版本 >= 0.15.0
在设置 → 关于 中查看版本号
```

## 常见错误及修复

### 错误：Cannot find module 'obsidian'

**原因：** 这是开发时的依赖问题，不影响已构建的插件

**解决方案：** 使用已构建的 `main.js` 文件，不需要 `node_modules`

### 错误：TypeError: Cannot read properties of undefined

**原因：** DOM元素未正确初始化

**解决方案：**
1. 确保在阅读视图下使用
2. 等待页面完全加载
3. 刷新页面（Ctrl/Cmd + R）

### 错误：Plugin is not compatible

**原因：** Obsidian版本过低

**解决方案：** 升级Obsidian到 0.15.0 或更高版本

## 获取帮助

如果问题仍然存在：

1. **查看控制台日志**
   - 打开开发者工具
   - 粘贴完整错误信息

2. **检查环境**
   - Obsidian版本
   - 操作系统
   - 其他已启用插件

3. **提供信息**
   - 错误截图
   - 控制台日志
   - 复现步骤

## 性能优化

如果插件运行缓慢：

1. 减少同时打开的表格数量
2. 禁用不必要的插件
3. 检查是否有大表格（>100行）
4. 重启Obsidian清理内存

## 卸载

完全卸载插件：

```bash
rm -rf .obsidian/plugins/table-resizer
```

然后在设置中刷新插件列表。
