#!/bin/bash

# Table Resizer Plugin 安装脚本
# 用法: ./install.sh /path/to/your/obsidian/vault

set -e

# 检查参数
if [ -z "$1" ]; then
    echo "❌ 错误：请提供Obsidian vault路径"
    echo "用法: ./install.sh /path/to/your/obsidian/vault"
    echo ""
    echo "示例:"
    echo "  ./install.sh ~/Documents/MyVault"
    echo "  ./install.sh /Users/username/Obsidian/MyVault"
    exit 1
fi

VAULT_PATH="$1"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/table-resizer"

# 检查vault是否存在
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ 错误：vault目录不存在: $VAULT_PATH"
    exit 1
fi

# 检查是否是Obsidian vault
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "❌ 错误：这不是一个有效的Obsidian vault（缺少.obsidian目录）"
    exit 1
fi

# 检查必需文件
for file in main.js manifest.json styles.css; do
    if [ ! -f "$file" ]; then
        echo "❌ 错误：缺少文件 $file"
        echo "请确保在插件目录下运行此脚本"
        exit 1
    fi
done

echo "📦 准备安装 Table Resizer 插件..."
echo "   Vault: $VAULT_PATH"
echo "   插件目录: $PLUGIN_DIR"
echo ""

# 创建插件目录
mkdir -p "$PLUGIN_DIR"

# 复制文件
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"

# 验证安装
echo "✅ 文件已复制:"
ls -lh "$PLUGIN_DIR/"

echo ""
echo "✨ 安装成功！"
echo ""
echo "📋 下一步："
echo "  1. 重启 Obsidian"
echo "  2. 打开 设置 → 第三方插件"
echo "  3. 刷新插件列表"
echo "  4. 启用 'Table Resizer' 插件"
echo ""
echo "🔍 如果遇到问题，请查看:"
echo "   - TROUBLESHOOTING.md 文件"
echo "   - Obsidian 控制台（Cmd/Ctrl + Shift + I）"
