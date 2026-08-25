"""初始化示例数据库 - 创建表并插入测试数据"""
import sqlite3
import random
from datetime import datetime, timedelta
from config import Config
from pathlib import Path

DB_PATH = Config.DB_PATH
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 创建用户表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            city TEXT NOT NULL,
            register_date TEXT NOT NULL
        )
    """)

    # 创建商品表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL
        )
    """)

    # 创建订单表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """)

    # 清空旧数据（重新初始化时）
    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM users")
    cursor.execute("DELETE FROM products")

    # ===== 插入用户数据 =====
    cities = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉"]
    user_names = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十",
                  "郑十一", "王十二", "刘十三", "陈十四", "杨十五", "赵十六", "黄十七"]

    for i, name in enumerate(user_names, 1):
        city = random.choice(cities)
        reg_date = (datetime(2024, 1, 1) + timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d")
        cursor.execute("INSERT INTO users (name, city, register_date) VALUES (?, ?, ?)",
                       (name, city, reg_date))

    # ===== 插入商品数据 =====
    products_data = [
        ("iPhone 15", "手机数码", 5999),
        ("华为 Mate60", "手机数码", 4999),
        ("小米14", "手机数码", 3999),
        ("MacBook Pro", "电脑办公", 14999),
        ("联想 ThinkPad", "电脑办公", 8999),
        ("iPad Air", "电脑办公", 4799),
        ("AirPods Pro", "智能穿戴", 1999),
        ("Apple Watch", "智能穿戴", 2999),
        ("小米手环", "智能穿戴", 299),
        ("戴尔显示器", "电脑办公", 1599),
        ("罗技鼠标", "电脑配件", 199),
        ("机械键盘", "电脑配件", 399),
    ]

    for name, category, price in products_data:
        cursor.execute("INSERT INTO products (name, category, price) VALUES (?, ?, ?)",
                       (name, category, price))

    # ===== 插入订单数据 =====
    statuses = ["completed", "completed", "completed", "pending", "cancelled"]  # completed 占比更高

    for _ in range(500):
        user_id = random.randint(1, len(user_names))
        product_id = random.randint(1, len(products_data))
        product_price = products_data[product_id - 1][2]
        # 订单金额在商品价格附近浮动
        amount = round(product_price * random.uniform(0.8, 1.5), 2)
        status = random.choice(statuses)
        created_at = (datetime(2024, 1, 1) + timedelta(days=random.randint(0, 500))).strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute(
            "INSERT INTO orders (user_id, product_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, product_id, amount, status, created_at)
        )

    conn.commit()
    conn.close()
    print(f"数据库初始化完成: {DB_PATH}")
    print(f"  - 用户数: {len(user_names)}")
    print(f"  - 商品数: {len(products_data)}")
    print(f"  - 订单数: 500")


if __name__ == "__main__":
    init_db()
