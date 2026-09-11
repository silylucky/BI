# Dashboard 富文本画布内联编辑设计

日期：2026-07-13  
状态：待用户审核  
范围：DASH-007 富文本 Widget 增强  
参考：DataEase `rich-main-class` / `shape-inner` 双击编辑交互

## 1. 背景与目标

当前 `TextWidget` 只负责展示 plain/markdown 字符串，内容编辑位于右侧
`TextWidgetInspector` 的 textarea，画布中不能直接编辑，也没有完整富文本能力。

本次目标：

1. 使用成熟开源编辑器，在画布原位置双击进入富文本编辑。
2. 提供常用格式能力，并保持 VitalSpan 的 TailAdmin/Radix 视觉语言。
3. 保存 HTML，兼容现有 plain/markdown 布局。
4. 阻止编辑过程误触画布拖拽、缩放或组件切换。
5. 对输入和历史 HTML 做白名单净化，避免 XSS。

非目标：

- 协同编辑、评论、AI 写作。
- 图片上传和媒体资源管理。
- TinyMCE 高级商业插件能力。
- 修改 Dashboard layout 版本或新增后端 API。

## 2. 技术选型

采用 Tiptap 3：

- `@tiptap/react`
- `@tiptap/pm`
- `@tiptap/starter-kit`
- 按需加入下划线、文本对齐、颜色、文本样式和链接扩展

Tiptap 核心为 MIT 许可证，官方 React 包支持 React 19。它基于成熟的
ProseMirror，扩展生态完整，且 headless UI 能与项目现有设计系统一致。

未采用：

- TinyMCE 8：成品度高，但自托管采用 GPLv2+ 或商业许可，不适合默认引入政企商业产品。
- Lexical：MIT 且性能优秀，但需要自行实现更多工具栏、序列化和插件编排，交付成本更高。

HTML 净化优先选用 MIT 许可且支持浏览器端白名单配置的成熟库；实现前通过
包管理器确认当前版本、许可证和 bundle 兼容性。

## 3. 数据契约与兼容

`TextWidgetConfig` 扩展为：

```ts
type TextVariant = "plain" | "markdown" | "html";

type TextWidgetConfig = {
  content: string;
  variant: TextVariant;
};
```

后端 `TextVariant` 同步增加 `html`，继续使用原有长度限制和
`textConfig` 字段，不改变 layout version。

兼容规则：

1. `variant=html`：净化后直接渲染。
2. `variant=plain`：先做 HTML 转义，再按换行生成段落。
3. `variant=markdown`：按当前简易语义转为安全 HTML，不引入完整 Markdown 方言。
4. 旧内容首次进入编辑时转换成 HTML；成功提交后写回
   `{ content: sanitizedHtml, variant: "html" }`。
5. 未编辑的旧 layout 保持原数据，不在读取时静默迁移。

## 4. 交互设计

### 4.1 查看与选中

- view 模式只渲染净化后的只读 HTML。
- edit 模式单击正文只选中组件，不进入文字编辑。
- edit 模式双击正文进入内联编辑并把光标放到点击位置。
- 空内容在只读状态显示“**双击编辑文字**”，该提示不写入真实 content。

### 4.2 编辑态

进入编辑后：

- 正文切换为 Tiptap `EditorContent`，保留组件原尺寸和内边距。
- 正文与工具栏添加 `dashboard-no-drag`，并停止 pointer/mouse 事件向画布传播。
- 隐藏只读占位提示，自动聚焦编辑器。
- 组件保持 selected 状态，但编辑器内部点击不会切换选择。
- 顶部出现紧凑浮动工具栏，支持：
  - 撤销、重做
  - 段落及标题层级
  - 字号
  - 粗体、斜体、下划线
  - 文字颜色
  - 左/中/右对齐
  - 有序/无序列表
  - 链接
  - 清除格式

工具栏使用现有 Button、DropdownMenu/Select 和语义 Token，覆盖 hover、
focus-visible、active、disabled 与 dark 状态。

### 4.3 提交与取消

- 点击组件外：净化编辑器 HTML，提交到 layout 草稿并退出。
- `Ctrl+Enter`：执行相同提交。
- `Esc`：恢复进入编辑前的 content/variant 并退出。
- 编辑结果只进入前端 layout 草稿；仍需点击页面“保存布局”才写入后端。
- 空编辑结果规范化为 `""`，退出后重新显示占位提示。

## 5. 组件与职责

### `RichTextEditor.tsx`

- 创建和销毁 Tiptap editor。
- 接收 initial HTML、提交和取消回调。
- 管理 focus、outside click 与键盘快捷键。
- 不直接修改 Dashboard widgets。

### `RichTextToolbar.tsx`

- 只负责将 UI 操作映射到 Tiptap command。
- 从 editor state 派生 active/disabled 状态。
- 不处理持久化或 Dashboard 选择。

### `richTextHtml.ts`

- `textConfigToHtml(config)`：兼容 plain/markdown/html。
- `sanitizeRichTextHtml(html)`：白名单净化。
- `isRichTextEmpty(html)`：识别空段落等编辑器空值。
- 所有转换函数保持纯函数并单测。

### `TextWidget.tsx`

- 管理 `isEditing` 和进入编辑前快照。
- 单击选中、双击编辑。
- 编辑结束时通过新增 `onTextConfigChange` 回传配置。
- view 模式绝不创建编辑器实例。

### `DashboardWidget.tsx` / `DashboardEditPage.tsx`

- 透传 `onTextConfigChange`。
- 将回调收口为 `setWidgets` 更新，纳入现有 undo/redo 与 dirty 检测。

### `TextWidgetInspector.tsx`

- 移除与画布内联编辑重复的 textarea。
- 保留格式摘要、内容字数和“在画布中双击编辑”的明确提示。
- 不提供危险的原始 HTML 编辑入口。

## 6. 安全与错误处理

允许的基础标签包括段落、标题、换行、粗体、斜体、下划线、删除线、列表、
链接和带受控样式的 span。仅允许必要属性：

- 链接：`href`、`target`、`rel`
- 文本样式：白名单内的 `color`、`font-size`、`text-align`

必须移除：

- `script`、`iframe`、`object`、`embed`
- 所有 `on*` 事件属性
- `javascript:`、危险 data URL
- 非白名单 style 和任意 class/id

链接在新窗口打开时强制 `rel="noopener noreferrer"`。

若编辑器初始化失败，保留只读内容并显示非阻断提示；不得清空现有内容。

## 7. 测试与验收

### 单元测试

- plain/markdown/html 转换。
- XSS 标签、事件属性和危险 URL 被移除。
- 空文档识别。
- 后端 `variant=html` round-trip；非法 variant 拒绝。

### 组件测试

- 单击只选中，双击进入编辑。
- 双击后 editor 聚焦并显示工具栏。
- 格式命令更新 HTML。
- 点击外部和 `Ctrl+Enter` 提交 HTML。
- `Esc` 恢复原内容。
- 编辑器区域事件不触发画布拖动。
- view 模式只读且不渲染工具栏。

### 回归与人工验收

- Dashboard smoke、layout 测试和后端 schema 测试通过。
- 保存并刷新后文字及格式保持。
- 旧 plain/markdown widget 正常显示并可编辑升级。
- desktop/tablet、light/dark 浏览器截图检查无裁切、遮挡和层级错位。

## 8. 文档同步

- `docs/automate/prd/F07-DASH.md`：补充 DASH-007 富文本内联编辑验收。
- `docs/ui/layout.md`：登记双击编辑和退出规则。
- `fe/src/components/README.md`：登记 RichTextEditor、RichTextToolbar。
- 若依赖或 bundle 策略影响架构，再同步 `docs/arch.md`；否则无需更新 API 文档。

