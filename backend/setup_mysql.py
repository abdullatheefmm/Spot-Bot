import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

password = os.getenv("DB_PASSWORD", "")

try:
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"),
        password=password
    )
    cursor = conn.cursor()
    cursor.execute("CREATE DATABASE IF NOT EXISTS spotbot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    conn.commit()
    print("✅ SUCCESS! Database 'spotbot' created!")
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print("\n👉 Please open backend/.env and set your MySQL password:")
    print("   DB_PASSWORD=your_password_here")
    print("   Then run: python setup_mysql.py")
