# Table Resizer

Resize Markdown table column widths by dragging in Obsidian — no HTML or plugin-specific syntax is ever added to your notes.

## Features

- **Drag to resize** — hover the right edge of a column in a rendered table, then drag. The column width follows your cursor in real time.
- **Reading View and Live Preview** — resizing works in both rendered table views.
- **Widths are remembered** — reopen the file or restart Obsidian and your column widths are restored.
- **New tables, ready to drag** — a table you just typed can be resized right away, no manual refresh needed.
- **Min/max protection** — widths are clamped to 50–800 px by default so a column never collapses or overruns.
- **Per-table, per-file storage** — each table keeps its own widths, and multiple tables in one file work independently.
- **A command to toggle** — "Toggle table resizer" enables or disables resizing on the fly.
- **Non-destructive** — your Markdown source is never modified; disabling or uninstalling the plugin leaves your notes unchanged.

## How widths are stored

Widths live in the plugin's own data file, not inside your notes:

- Stored at `<vault>/.obsidian/plugins/table-resizer/data.json`.
- Each table is identified by *file path + table order + first-row header text*, so the same table is recognized again after you reopen the file or restart Obsidian.
- Because widths are kept outside the note, other people opening your note — or the same note on another device or vault — will not see your column widths.

## Compatibility

- **Platform:** Desktop Obsidian only.
- **Minimum version:** Obsidian 1.12.7.
- Resizing needs a *rendered* table: Reading View or Live Preview. Plain Markdown Source mode does not render tables, so resize handles are not available there.

## Installation

- **Community plugins** — once published, install from *Settings → Community plugins → Browse* and search for "Table Resizer".
- **Manual** — download `main.js`, `manifest.json`, and `styles.css`, then place them in:

  ```
  <vault>/.obsidian/plugins/table-resizer/
  ```

  Restart Obsidian, then enable the plugin in *Settings → Community plugins → Installed plugins*.

## Usage

1. Open a note that contains a Markdown table.
2. Switch to **Reading View**, or stay in **Live Preview**.
3. Move the pointer to the **right edge of a column** until the resize handle appears.
4. Drag left or right to change the width, then release.

To stop resizing without uninstalling, run the command **Toggle table resizer** from the Command palette.

## Limitations

- **No source writes** — column widths are saved to the plugin's data file, not into the Markdown table.
- **Identity depends on header and position** — widths are matched by file path, table order, and the first row's text. If you rename the header, move the table earlier in the file, or insert a table above it, previously saved widths may no longer apply — just re-drag to re-save.
- **Widths are local to the plugin** — they don't travel with the note to other devices or vaults.
- **Complex or nested tables** may not resize reliably.
- Tables with no rows are skipped.



---

# 表格列宽调整插件（Table Resizer）

在 Obsidian 中通过拖拽调整 Markdown 表格列宽。全程不会向笔记中写入任何 HTML 或插件专用语法。

## 功能特性

- **拖拽调宽** — 悬停到已渲染表格某列的右边缘即可拖拽，列宽实时跟随光标。
- **阅读视图与实时预览均支持** — 两种渲染视图下都可使用。
- **宽度自动记忆** — 重新打开文件或重启 Obsidian 后，列宽自动恢复。
- **新建表格立即可拖** — 刚输入的表格无需手动刷新即可调宽。
- **最小 / 最大宽度保护** — 列宽默认限制在 50–800 像素，避免列被拖没或拖得过宽。
- **按文件、按表格分别存储** — 每个表格独立保存，同一文件内的多个表格互不影响。
- **命令开关** — 通过 “Toggle table resizer” 命令随时启用或停用调整功能。
- **非破坏性** — 绝不修改 Markdown 源码；停用或卸载插件都不会改动笔记内容。

## 宽度保存在哪里

宽度存放在插件自身的数据文件中，而不是写进笔记：

- 存储位置：`<vault>/.obsidian/plugins/table-resizer/data.json`。
- 每个表格以「文件路径 + 表序 + 首行表头文字」作为标识，因此重开文件或重启后仍能识别同一张表。
- 宽度独立于笔记存放，因此他人打开你的笔记（或在其他设备 / 库中打开同一笔记）不会看到你设置的列宽。

## 兼容性

- **平台**：仅桌面端 Obsidian。
- **最低版本**：Obsidian 1.12.7。
- 调宽需要“已渲染的表格”，即阅读视图或实时预览；纯 Markdown 源码模式不渲染表格，因此没有调宽手柄可用。

## 安装

- **社区插件市场**：上架后可在「设置 → 社区插件 → 浏览」中搜索 “Table Resizer” 一键安装。
- **手动安装**：下载 `main.js`、`manifest.json`、`styles.css` 三个文件，放入：

  ```
  <vault>/.obsidian/plugins/table-resizer/
  ```

  重启 Obsidian 后，在「设置 → 社区插件 → 已安装插件」中启用。

## 使用方法

1. 打开包含 Markdown 表格的笔记。
2. 切换到阅读视图，或停留在实时预览。
3. 将指针移到某列**右边缘**，出现调宽手柄后拖拽。
4. 拖到合适的宽度后松开即可。

如需停用而不卸载，可在命令面板运行 **Toggle table resizer**。

## 已知限制

- **不写入源码** — 列宽保存到插件的数据文件，不写入 Markdown 表格。
- **依赖表头与表序** — 宽度按「文件路径 + 表序 + 首行文字」匹配。若修改了表头文字、把表格在文件中前移，或在它上方插入新表，之前保存的宽度可能失效（重新拖一次即可重新保存）。
- **宽度随插件本地保存** — 不会随笔记迁移到其他设备或库。
- **复杂的嵌套表格**可能无法可靠调整。
- 无行数据的表格会被跳过。

