from pathlib import Path
import os
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", encoding="utf-8-sig")

STORAGE_DIR = BASE_DIR / "storage"
UPLOAD_DIR = STORAGE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "app" / "static"
IMAGE_UPLOAD_DIR = UPLOAD_DIR / "images"
AWARD_UPLOAD_DIR = UPLOAD_DIR / "awards"
SENIOR_UPLOAD_DIR = UPLOAD_DIR / "seniors"
REVIEW_UPLOAD_DIR = UPLOAD_DIR / "review"
NEWS_UPLOAD_DIR = UPLOAD_DIR / "news"
CHROMA_DIR = STORAGE_DIR / "chroma"
TEAM_CONTENT_FILE = STORAGE_DIR / "team_content.json"
RECRUIT_CONTENT_FILE = STORAGE_DIR / "recruit_applications.json"
INGEST_INDEX_FILE = STORAGE_DIR / "ingest_index.json"
ADMIN_USERS_FILE = STORAGE_DIR / "admin_users.json"

DEFAULT_DATA_FILES = [
    UPLOAD_DIR / "flyteam_knowledge.pdf",
]

# Aliyun Bailian (DashScope) OpenAI-compatible defaults.
# Prefer DASHSCOPE_API_KEY; keep OPENAI_API_KEY as fallback for compatibility.
OPENAI_API_KEY = os.getenv("DASHSCOPE_API_KEY") or os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv(
    "OPENAI_BASE_URL",
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-v4")
CHAT_MODEL = os.getenv("CHAT_MODEL", "qwen-plus")
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "10"))
RETRIEVAL_MIN_RELEVANCE = float(os.getenv("RETRIEVAL_MIN_RELEVANCE", "0.12"))
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_SESSION_HOURS = int(os.getenv("ADMIN_SESSION_HOURS", "8"))

ADMIN_COOKIE_SECURE = os.getenv("ADMIN_COOKIE_SECURE", "0").strip().lower() in {"1", "true", "yes", "on"}
MAX_UPLOAD_FILES = int(os.getenv("MAX_UPLOAD_FILES", "20"))
MAX_IMAGE_UPLOAD_MB = int(os.getenv("MAX_IMAGE_UPLOAD_MB", "8"))
MAX_PDF_UPLOAD_MB = int(os.getenv("MAX_PDF_UPLOAD_MB", "25"))
