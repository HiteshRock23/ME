import psycopg2
from decouple import Config, RepositoryEnv

env_path = r"c:\Users\DEll\Desktop\Startup\ME\.env"
config = Config(RepositoryEnv(env_path))

db_name = config("DB_NAME")
db_user = config("DB_USER")
db_password = config("DB_PASSWORD")
db_host = config("DB_HOST", default="localhost")
db_port = config("DB_PORT", default="5432")

print(f"Connecting to default postgres database at {db_host}:{db_port}...")
conn = psycopg2.connect(
    dbname="postgres",
    user=db_user,
    password=db_password,
    host=db_host,
    port=db_port
)
conn.autocommit = True

with conn.cursor() as cur:
    print(f"Checking if database '{db_name}' exists...")
    cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{db_name}'")
    exists = cur.fetchone()
    
    if not exists:
        print(f"Database '{db_name}' does not exist. Creating...")
        cur.execute(f"CREATE DATABASE {db_name}")
        print(f"Database '{db_name}' created successfully!")
    else:
        print(f"Database '{db_name}' already exists.")

conn.close()
