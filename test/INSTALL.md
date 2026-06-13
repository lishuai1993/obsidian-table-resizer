# 测试安装脚本

本目录包含测试文件和安装说明。

## 快速安装命令

### macOS
```bash
# 设置你的vault路径
VAULT_PATH="/path/to/your/obsidian/vault"

# 创建目录并复制文件
mkdir -p "$VAULT_PATH/.obsidian/plugins/table-resizer" && \
cp ../main.js ../manifest.json ../styles.css "$VAULT_PATH/.obsidian/plugins/table-resizer/"
```

### 验证安装
```bash
# 检查文件
ls -la "$VAULT_PATH/.obsidian/plugins/table-resizer/"

# 应该看到：
# main.js
# manifest.json
# styles.css
```

### 完整示例（使用当前目录）
```bash
# 假设你在obsidian-table-resizer目录下
cd /Users/lishuai/CodeBuddy/ai_as_me/obsidian-table-resizer

# 复制到Obsidian vault（请替换路径）
cp main.js manifest.json styles.css "/your/vault/path/.obsidian/plugins/table-resizer/"

# 或者使用相对路径
# 如果vault在 ~/Documents/MyVault
cp main.js manifest.json styles.css ~/Documents/MyVault/.obsidian/plugins/table-resizer/
```

## 测试步骤

1. 安装插件后重启Obsidian
2. 打开开发者工具：Cmd/Ctrl + Shift + I
3. 查看控制台输出：
   ```
   Table Resizer plugin loading...
   Settings loaded
   Styles registered
   Tables initialized
   Table Resizer plugin loaded successfully
   ```
4. 打开包含表格的Markdown文件
5. 切换到阅读视图
6. 悬停在表格列右边界
7. 拖拽调整宽度
