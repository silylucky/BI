import sqlite3
from plugins.base import BasePlugin
from config import Config


class SqlQueryPlugin(BasePlugin):
    """SQL 查询插件 - 让 Agent 能够查询业务数据库"""

    # 数据库 schema 描述，帮助 LLM 生成正确的 SQL
    SCHEMA_DESC = """
可用表结构：
1. orders (订单表)
   - id: 订单ID
   - user_id: 用户ID
   - product_id: 商品ID
   - amount: 订单金额
   - status: 订单状态 (completed/pending/cancelled)
   - created_at: 创建时间

2. users (用户表)
   - id: 用户ID
   - name: 用户名
   - city: 所在城市
   - register_date: 注册日期

3. products (商品表)
   - id: 商品ID
   - name: 商品名称
   - category: 商品分类
   - price: 商品单价
""".strip()

    @property
    def name(self) -> str:
        return "query_database"

    @property
    def description(self) -> str:
        return f"查询业务数据库，返回查询结果。仅支持 SELECT 语句。\n{self.SCHEMA_DESC}"

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "要执行的 SQL 查询语句，仅支持 SELECT"
                }
            },
            "required": ["sql"]
        }

    def execute(self, sql: str) -> dict:
        sql_stripped = sql.strip().upper()
        if not sql_stripped.startswith("SELECT"):
            return {"error": "仅支持 SELECT 查询"}

        # 禁止危险操作
        forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE"]
        for kw in forbidden:
            if kw in sql_stripped:
                return {"error": f"SQL 中包含禁止的关键字: {kw}"}

        conn = sqlite3.connect(Config.DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(sql)
            columns = [desc[0] for desc in cursor.description]
            rows = [dict(row) for row in cursor.fetchall()]
            return {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
            }
        except Exception as e:
            return {"error": f"SQL 执行失败: {str(e)}"}
        finally:
            conn.close()
