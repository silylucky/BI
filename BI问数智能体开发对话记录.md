# BI 问数智能体开发对话记录

> 记录范围：从“做一个通用的agent，带有简单的前端的，可以接入插件的 BI问数系统方向”开始。
>
> 安全说明：对话中出现过的 API Key 已脱敏，建议在模型平台控制台轮换该密钥。

---

## 1. 项目目标

**用户：**

> 做一个通用的agent，带有简单的前端的，可以接入插件的
> BI问数系统方向

**助手：**

提出 BI 问数智能体整体方案：

- 前端使用 React，展示对话、工具调用过程、数据表格与 ECharts 图表。
- 后端使用 Python FastAPI，提供 SSE 流式对话接口。
- Agent 使用 Function Calling 驱动工具调用。
- 通过插件基类和注册中心，实现可扩展的外部工具接入。
- 内置 SQL 查询、数据分析、图表生成三个 BI 插件。
- 使用会话历史保存上下文。
- 生产环境建议增加 SQL 权限控制、查询超时、字段脱敏、Redis 会话存储等能力。

## 2. 接入 DeepSeek

**用户：**

> 可以先接deepseek的api，api密钥留着我自己填

**助手：**

设计 DeepSeek 的 OpenAI 兼容客户端配置：

```python
from openai import OpenAI

llm_client = OpenAI(
    api_key=Config.DEEPSEEK_API_KEY,
    base_url=Config.DEEPSEEK_BASE_URL,
)
```

建议使用：

```python
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MODEL = "deepseek-chat"
```

其中 `deepseek-chat` 支持 Function Calling，适合当前 Agent 的插件调用模式。

## 3. 实际搭建项目

**用户：**

> 开始执行

**助手：**

在工作区中完成项目落地，主要内容如下。

### 后端

创建 `backend/` 下的主要模块：

- `config.py`：DeepSeek、数据库和服务配置。
- `main.py`：FastAPI 入口、CORS、SSE 对话接口、插件接口、会话清除接口。
- `agent/llm_client.py`：DeepSeek OpenAI 兼容客户端。
- `agent/core.py`：Agent 主循环。
- `agent/session_manager.py`：会话记忆管理。
- `plugins/base.py`：插件抽象基类。
- `plugins/registry.py`：插件注册和执行中心。
- `plugins/sql_query.py`：只读 SQL 查询插件。
- `plugins/data_analysis.py`：统计分析插件。
- `plugins/chart_generator.py`：生成 ECharts 配置的图表插件。
- `init_db.py`：创建 SQLite 示例业务数据。

Agent 的主循环逻辑：

```text
用户输入
  → 调用 DeepSeek
  → 模型决定是否调用工具
  → 执行插件
  → 工具结果返回模型
  → 输出最终自然语言回答、表格或图表
```

示例 SQLite 数据库位于：

```text
data/business.db
```

包含：

- `users`
- `products`
- `orders`

并生成 500 条模拟订单数据。

### 前端

创建 `frontend/` 下的 React + Vite 项目：

- 对话输入和历史展示。
- SSE 流式读取后端结果。
- 工具调用过程展示。
- SQL 查询结果表格展示。
- ECharts 图表展示。
- 清空会话功能。
- Vite 代理转发 `/chat`、`/plugins`、`/session` 等请求到后端。

### 依赖与验证

- 后端使用项目虚拟环境 `backend/.venv`。
- 使用 `uv pip` 安装后端依赖。
- 前端使用 `npm install` 安装依赖。
- 修复了 `openai==1.51.0` 与较新版 `httpx` 的兼容问题，约束为：

```text
httpx>=0.27,<0.28
```

- 前端生产构建验证通过。
- SQL 查询和图表生成插件验证通过。
- `/health` 和 `/plugins` 接口验证通过。

## 4. npm 找不到 package.json

**用户：**

> 这是什么错误

附带错误：根目录 `C:\agent\universal_agent\package.json` 不存在。

**助手：**

说明这是在错误目录执行 npm 命令导致的。前端 `package.json` 位于：

```text
C:\agent\universal_agent\frontend\package.json
```

正确启动前端：

```powershell
cd C:\agent\universal_agent\frontend
npm install
npm run dev
```

正确启动后端：

```powershell
cd C:\agent\universal_agent\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 5. 会话记忆的存储方式

**用户：**

> 使用什么来存储记忆的

**助手：**

当前项目的对话记忆使用 Python 进程内存字典，位于：

```text
backend/agent/session_manager.py
```

主要结构：

```python
self._sessions: Dict[str, List[dict]] = {}
```

以 `session_id` 为键保存历史消息，最大保留 50 条。该方案适合本地演示，但后端重启会丢失数据，也不支持多实例共享。

业务分析的示例数据存储在 SQLite 文件 `data/business.db` 中，和对话记忆不同。

## 6. Redis 是什么

**用户：**

> Redis是什么

**助手：**

解释 Redis 是高性能内存键值数据库，可用于：

- 短期对话记忆。
- 用户登录会话。
- BI 查询缓存。
- 异步任务进度。
- 接口限流。

推荐架构：

- Redis：短期、快速、可过期的数据，例如会话记忆与缓存。
- MySQL / PostgreSQL：长期、可审计的数据，例如用户、报表、历史记录。
- 向量数据库：基于语义检索的知识库或历史摘要。

## 7. DeepSeek 的 URL 配置

**用户：**

> 这里的URL应该填什么

**助手：**

说明 `base_url` 使用 DeepSeek 官方地址：

```python
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
```

API Key 不应写入源码，应通过环境变量或 `.env` 文件配置。

## 8. Config 配置源文件

**用户：**

> api_key=Config.DEEPSEEK_API_KEY,这里config的源文件在哪

**助手：**

说明配置文件位置为：

```text
C:\agent\universal_agent\backend\config.py
```

其中 API Key 通过：

```python
os.getenv("DEEPSEEK_API_KEY", "")
```

读取环境变量。

## 9. 模型名检查

**用户：**

> 模型名有误吗

**助手：**

说明 DeepSeek 官方 API 应使用：

```python
MODEL = "deepseek-chat"
```

并指出当时配置中的 `DeepSeek-V4-Flash` 不是 DeepSeek 官方 API 的标准模型标识。

还发现 API Key 出现在 `.env` 内容中，已建议用户在 DeepSeek 控制台轮换该密钥，且本文档不记录该密钥。

## 10. 自动读取 backend/.env

**用户：**

> 现在可以读取出apikey吗

**助手：**

说明原始代码只读取进程环境变量，不能自动读取 `.env`。

**用户：**

> 做出自动读取 backend/.env

**助手：**

为项目接入 `python-dotenv`：

```python
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
```

在 `requirements.txt` 中新增：

```text
python-dotenv==1.0.1
```

验证结果：后端可从 `backend/.env` 读取 `DEEPSEEK_API_KEY`，但不输出其实际值；系统环境变量仍优先于 `.env` 中同名变量。

推荐 `.env` 格式：

```env
DEEPSEEK_API_KEY=你的实际密钥
# 可选：覆盖默认模型
DEEPSEEK_MODEL=deepseek-chat
```

## 11. AI 对话无回复问题

**用户：**

> 与ai对话后没有回复

**助手：**

定位到两个原因：

1. 模型配置使用了不正确的 `DeepSeek-V4-Flash`。
2. DeepSeek 请求异常时，后端 SSE 流会中断，前端没有收到最终 `answer` 事件，因此页面会一直显示“分析中”。

完成以下修复：

### 修复模型配置

```python
MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
```

### 修复后端错误处理

在 `agent/core.py` 的模型调用外加入异常捕获。若模型调用失败，改为返回：

```json
{
  "type": "answer",
  "content": "调用 DeepSeek 失败：具体错误信息"
}
```

前端因此可以展示错误而不是无限加载。

### 修复前端错误展示

前端对 `/chat` 响应增加状态检查，并将请求失败原因展示到对话区。

### 最终验证

实际发送“你好”到 `/chat` 接口，成功收到 DeepSeek 的 SSE 回复和会话历史事件，确认对话链路可用。

## 当前启动方式

### 启动后端

```powershell
cd C:\agent\universal_agent\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 启动前端

```powershell
cd C:\agent\universal_agent\frontend
npm run dev
```

然后访问：

```text
http://localhost:3000
```

## 推荐测试问题

```text
查询各城市的订单总金额，画一个饼图
```

```text
查询销售额最高的 5 个商品，并生成柱状图
```

```text
查询各商品分类的平均订单金额
```
