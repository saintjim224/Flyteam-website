from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal
import hashlib
import hmac
import json
import re
import secrets
import shutil
import time
from uuid import uuid4

from fastapi import Cookie, Depends, FastAPI, File, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import (
    ADMIN_COOKIE_SECURE,
    ADMIN_PASSWORD,
    ADMIN_SESSION_HOURS,
    ADMIN_TOKEN,
    ADMIN_USERS_FILE,
    AWARD_UPLOAD_DIR,
    BASE_DIR,
    DEFAULT_DATA_FILES,
    IMAGE_UPLOAD_DIR,
    MAX_IMAGE_UPLOAD_MB,
    MAX_PDF_UPLOAD_MB,
    MAX_UPLOAD_FILES,
    NEWS_UPLOAD_DIR,
    RECRUIT_CONTENT_FILE,
    REVIEW_UPLOAD_DIR,
    SENIOR_UPLOAD_DIR,
    STATIC_DIR,
    TEAM_CONTENT_FILE,
    UPLOAD_DIR,
)
from .rag_service import RagService


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=800)
    top_k: int = Field(default=8, ge=1, le=20)


class IngestLocalRequest(BaseModel):
    paths: List[str]


class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=40)
    password: str = Field(..., min_length=1, max_length=128)


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=6, max_length=128)
    display_name: str = Field(default="", max_length=60)
    role: Literal["admin", "superadmin"] = "admin"


class AdminPasswordUpdateRequest(BaseModel):
    password: str = Field(..., min_length=6, max_length=128)


class AdminRoleUpdateRequest(BaseModel):
    role: Literal["admin", "superadmin"]


class AwardCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    award_type: Literal["team", "personal"] = "team"
    year: str = Field(default="")
    level: str = Field(default="")
    organizer: str = Field(default="")
    description: str = Field(default="")
    image_url: str = Field(default="")
    pinned: bool = False


class AwardUpdateRequest(AwardCreateRequest):
    pass


class GalleryDeleteRequest(BaseModel):
    url: str = Field(..., min_length=1)


class RecruitCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=30)
    student_id: str = Field(..., min_length=1, max_length=30)
    college: str = Field(default="", max_length=60)
    grade: str = Field(default="", max_length=20)
    phone: str = Field(default="", max_length=30)
    wechat: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=80)
    hall: Literal["binary", "web", "dev", "management"]
    direction_detail: str = Field(default="", max_length=120)
    experience: str = Field(default="", max_length=800)
    weekly_hours: str = Field(default="", max_length=30)
    note: str = Field(default="", max_length=300)
    captcha_token: str = Field(default="", max_length=120)
    captcha_answer: str = Field(default="", max_length=20)


class RecruitUpdateRequest(RecruitCreateRequest):
    pinned: bool = False


class SeniorCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    grade: str = Field(default="", max_length=20)
    hall: Literal["binary", "web", "dev", "management"]
    direction: str = Field(default="", max_length=120)
    intro: str = Field(default="", max_length=500)
    achievements: str = Field(default="", max_length=600)
    advice: str = Field(default="", max_length=500)
    photo_url: str = Field(default="")
    pinned: bool = False
    responsible: bool = False


class NewsCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    date: str = Field(default="", max_length=30)
    summary: str = Field(default="", max_length=500)
    source: str = Field(default="", max_length=120)
    content: str = Field(default="", max_length=30000)
    cover_url: str = Field(default="", max_length=500)
    image_urls: list[str] = Field(default_factory=list)
    pinned: bool = False


class NewsUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    date: str = Field(default="", max_length=30)
    summary: str = Field(default="", max_length=500)
    source: str = Field(default="", max_length=120)
    content: str = Field(default="", max_length=30000)
    cover_url: str = Field(default="", max_length=500)
    image_urls: list[str] = Field(default_factory=list)
    pinned: bool = False


class TeamIntroUpdateRequest(BaseModel):
    intro: str = Field(default="", max_length=8000)


class TeamOverviewUpdateRequest(BaseModel):
    overview: str = Field(default="", max_length=2000)


class SeniorUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    grade: str = Field(default="", max_length=20)
    hall: Literal["binary", "web", "dev", "management"]
    direction: str = Field(default="", max_length=120)
    intro: str = Field(default="", max_length=500)
    achievements: str = Field(default="", max_length=600)
    advice: str = Field(default="", max_length=500)
    photo_url: str = Field(default="")
    pinned: bool = False
    responsible: bool = False


class ReviewCreateRequest(BaseModel):
    image_url: str = Field(..., min_length=1, max_length=500)
    title: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=300)
    pinned: bool = False


class ReviewUpdateRequest(BaseModel):
    title: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=300)
    pinned: bool = False


class ReviewAlbumCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    date: str = Field(default="", max_length=30)
    category: str = Field(default="", max_length=60)
    summary: str = Field(default="", max_length=600)
    content: str = Field(default="", max_length=8000)
    cover_url: str = Field(default="", max_length=500)
    image_urls: list[str] = Field(default_factory=list)
    pinned: bool = False


class ReviewAlbumUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    date: str = Field(default="", max_length=30)
    category: str = Field(default="", max_length=60)
    summary: str = Field(default="", max_length=600)
    content: str = Field(default="", max_length=8000)
    cover_url: str = Field(default="", max_length=500)
    image_urls: list[str] = Field(default_factory=list)
    pinned: bool = False


app = FastAPI(title="Flyteam RAG QA", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Admin-Token", "X-CSRF-Token"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
IMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
AWARD_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SENIOR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
REVIEW_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
NEWS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

rag_service: RagService | None = None
rag_init_error: str | None = None
try:
    rag_service = RagService()
except Exception as ex:
    rag_init_error = str(ex)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
    )


@app.middleware("http")
async def security_headers_and_admin_asset_guard(request: Request, call_next):
    path = request.url.path
    method = request.method.upper()

    admin_asset_paths = {"/static/admin.html", "/static/app.js"}
    if path in admin_asset_paths:
        token = request.cookies.get("admin_session")
        if _admin_from_token(token) is None:
            if path.endswith(".html"):
                return RedirectResponse("/login", status_code=302)
            return JSONResponse(status_code=401, content={"detail": "Admin login required."})

    client_ip = _client_ip(request)
    if method == "POST" and path == "/api/chat" and not _check_rate_limit(f"chat:{client_ip}", 30, 60):
        return JSONResponse(status_code=429, content={"detail": "Too many chat requests. Please try again later."})
    if method == "POST" and path == "/api/recruit/apply":
        # Public???????????????????????????
        if _admin_from_token(request.cookies.get("admin_session")) is None and not _check_rate_limit(f"recruit:{client_ip}", 10, 3600):
            return JSONResponse(status_code=429, content={"detail": "Too many recruit submissions. Please try again later."})

    if method in {"POST", "PUT", "PATCH", "DELETE"} and _requires_admin_csrf(path):
        cookie_token = request.cookies.get("admin_session")
        header_token = request.headers.get("x-admin-token")
        cookie_admin = _admin_from_token(cookie_token)
        if cookie_admin is not None and not header_token:
            csrf_token = request.headers.get("x-csrf-token", "")
            expected = str(cookie_admin.get("csrf_token", ""))
            if not expected or not hmac.compare_digest(csrf_token, expected):
                return JSONResponse(status_code=403, content={"detail": "Invalid or missing CSRF token."})

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "script-src 'self' https://unpkg.com 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'",
    )
    if path.startswith("/uploads/"):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox"
        if not re.search(r"\.(?:jpe?g|png|gif|webp)$", path, re.IGNORECASE):
            response.headers.setdefault("Content-Disposition", "attachment")
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").lower() == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if path in admin_asset_paths or path.startswith("/admin") or path.startswith("/login") or path.startswith("/api/admin"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


ADMIN_SESSIONS: dict[str, dict] = {}
RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}
RECRUIT_CAPTCHA_STORE: dict[str, dict] = {}
RECRUIT_CAPTCHA_TTL_SECONDS = 180
RECRUIT_CAPTCHA_MAX_ATTEMPTS = 1
PASSWORD_ITERATIONS = 260_000
MAX_IMAGE_UPLOAD_BYTES = max(1, MAX_IMAGE_UPLOAD_MB) * 1024 * 1024
MAX_PDF_UPLOAD_BYTES = max(1, MAX_PDF_UPLOAD_MB) * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024
IMAGE_UPLOAD_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PDF_UPLOAD_SUFFIXES = {".pdf"}
IMAGE_SUFFIX_BY_FORMAT = {
    "jpeg": {".jpg", ".jpeg"},
    "png": {".png"},
    "gif": {".gif"},
    "webp": {".webp"},
}
DANGEROUS_UPLOAD_SIGNATURES = (
    b"<?php",
    b"<?=",
    b"<%@",
    b"<%=",
    b"<script",
    b"</script",
    b"<html",
    b"<!doctype html",
    b"<jsp:",
    b"#!/bin/",
    b"#!/usr/bin/",
)
DANGEROUS_PDF_SIGNATURES = (
    b"/javascript",
    b"/js",
    b"/openaction",
    b"/aa",
    b"/launch",
    b"/embeddedfile",
    b"/richmedia",
    b"/xfa",
)
ADMIN_CSRF_PATH_PREFIXES = (
    "/api/admin",
    "/api/awards",
    "/api/seniors",
    "/api/news",
    "/api/review",
    "/api/content",
    "/api/ingest",
    "/api/upload",
)


def _client_ip(request: Request) -> str:
    """Return a stable client IP for captcha/rate-limit checks.

    When the app is behind local Nginx, trust X-Forwarded-For only from the
    loopback proxy. Do not trust spoofable forwarding headers from direct
    external requests.
    """
    peer = request.client.host if request.client else "unknown"
    if peer in {"127.0.0.1", "::1", "localhost"}:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            first = forwarded.split(",", 1)[0].strip()
            if re.fullmatch(r"[0-9A-Fa-f:.]{3,45}", first):
                return first
    return peer


def _check_rate_limit(key: str, limit: int, window_seconds: int, consume: bool = True) -> bool:
    now = time.time()
    bucket = RATE_LIMIT_BUCKETS.setdefault(key, [])
    cutoff = now - window_seconds
    bucket[:] = [ts for ts in bucket if ts >= cutoff]
    if len(bucket) >= limit:
        return False
    if consume:
        bucket.append(now)
    return True


def _clear_rate_limit(key: str) -> None:
    RATE_LIMIT_BUCKETS.pop(key, None)


def _requires_admin_csrf(path: str) -> bool:
    if path == "/api/admin/login":
        return False
    if path.startswith("/api/recruit/") and path != "/api/recruit/apply":
        return True
    return any(path.startswith(prefix) for prefix in ADMIN_CSRF_PATH_PREFIXES)


def _detect_image_format(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _is_image_magic(data: bytes) -> bool:
    return _detect_image_format(data) is not None


def _is_pdf_magic(data: bytes) -> bool:
    return data.startswith(b"%PDF-")


def _dangerous_signature_present(data: bytes, signatures: tuple[bytes, ...]) -> bool:
    lowered = data.lower()
    return any(sig in lowered for sig in signatures)


def _has_dangerous_upload_signature(data: bytes, kind: str) -> bool:
    # For binary photos, scanning the whole compressed stream causes false
    # positives because random image bytes may contain text-like sequences.
    # Check the file head and tail where polyglot/script payloads are normally
    # placed. PDFs remain text-like, so scan more of the document for active
    # content markers.
    if kind == "image":
        probe = data[:4096] + data[-4096:]
    else:
        probe = data[: min(len(data), 1024 * 1024)]
    if _dangerous_signature_present(probe, DANGEROUS_UPLOAD_SIGNATURES):
        return True
    if kind == "pdf" and _dangerous_signature_present(probe, DANGEROUS_PDF_SIGNATURES):
        return True
    return False


def _validate_image_trailer(data: bytes, fmt: str) -> None:
    stripped = data.rstrip(b"\x00\r\n\t ")
    trailing = b""
    if fmt == "jpeg":
        marker = stripped.rfind(b"\xff\xd9")
        if marker < 0:
            raise HTTPException(status_code=400, detail="Invalid JPEG structure.")
        trailing = stripped[marker + 2:]
    elif fmt == "png":
        marker = data.rfind(b"\x00\x00\x00\x00IEND\xaeB`\x82")
        if marker < 0:
            raise HTTPException(status_code=400, detail="Invalid PNG structure.")
        trailing = data[marker + 12:].strip(b"\x00\r\n\t ")
    elif fmt == "gif":
        marker = stripped.rfind(b";")
        if marker < 0:
            raise HTTPException(status_code=400, detail="Invalid GIF structure.")
        trailing = stripped[marker + 1:]
    elif fmt == "webp":
        if len(data) < 12:
            raise HTTPException(status_code=400, detail="Invalid WEBP structure.")
        riff_size = int.from_bytes(data[4:8], "little") + 8
        if riff_size != len(data):
            raise HTTPException(status_code=400, detail="Invalid WEBP structure.")
        trailing = b""

    if trailing and _dangerous_signature_present(trailing, DANGEROUS_UPLOAD_SIGNATURES):
        raise HTTPException(status_code=400, detail="Image contains blocked script-like content.")


def _validate_image_payload(data: bytes, suffix: str) -> None:
    fmt = _detect_image_format(data)
    if not fmt or suffix not in IMAGE_SUFFIX_BY_FORMAT.get(fmt, set()):
        raise HTTPException(status_code=400, detail="Invalid image file type or extension mismatch.")
    if _has_dangerous_upload_signature(data, "image"):
        raise HTTPException(status_code=400, detail="Image contains blocked script-like content.")
    _validate_image_trailer(data, fmt)


def _validate_pdf_payload(data: bytes) -> None:
    if not _is_pdf_magic(data):
        raise HTTPException(status_code=400, detail="Invalid PDF file content.")
    if _has_dangerous_upload_signature(data, "pdf"):
        raise HTTPException(status_code=400, detail="PDF contains blocked active content.")
    tail = data[-2048:].rstrip(b"\x00\r\n\t ")
    if b"%%EOF" not in tail:
        raise HTTPException(status_code=400, detail="Invalid PDF structure.")


def _validate_upload_payload(data: bytes, suffix: str, kind: str) -> None:
    if not data:
        raise HTTPException(status_code=400, detail=f"Invalid {kind} file content.")
    if kind == "image":
        _validate_image_payload(data, suffix)
    elif kind == "pdf":
        if suffix != ".pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
        _validate_pdf_payload(data)
    else:
        raise HTTPException(status_code=400, detail="Unsupported upload type.")


def _copy_upload_limited(upload: UploadFile, target_path: Path, max_bytes: int, kind: str, suffix: str) -> None:
    total = 0
    chunks: list[bytes] = []
    try:
        while True:
            chunk = upload.file.read(UPLOAD_CHUNK_SIZE)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(status_code=413, detail=f"Uploaded {kind} file is too large.")
            chunks.append(chunk)
        data = b"".join(chunks)
        _validate_upload_payload(data, suffix, kind)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with target_path.open("wb") as out:
            out.write(data)
        try:
            target_path.chmod(0o644)
        except Exception:
            pass
    except Exception:
        try:
            if target_path.exists():
                target_path.unlink()
        finally:
            raise

def _ensure_upload_count(files: List[UploadFile]) -> None:
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=413, detail=f"Too many files. Maximum is {MAX_UPLOAD_FILES} per request.")

def _safe_ingest_path(raw_path: str) -> Path:
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = BASE_DIR / candidate
    resolved = candidate.resolve()
    root = BASE_DIR.resolve()
    try:
        resolved.relative_to(root)
    except Exception:
        raise HTTPException(status_code=400, detail="Local ingest path must stay inside the project directory.")
    if resolved.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files can be ingested from local paths.")
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="Local ingest file not found.")
    return resolved

def verify_admin(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
    admin_session: str | None = Cookie(default=None, alias="admin_session"),
) -> dict:
    admin = _admin_from_token(x_admin_token) or _admin_from_token(admin_session)
    if admin is None:
        raise HTTPException(status_code=401, detail="Unauthorized admin action.")
    return admin


def require_superadmin(admin: dict = Depends(verify_admin)) -> dict:
    if str(admin.get("role", "admin")) != "superadmin":
        raise HTTPException(status_code=403, detail="Super administrator permission required.")
    return admin


def _write_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.{uuid4().hex}.tmp")
    try:
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp_path.replace(path)
    finally:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except Exception:
            pass


def _safe_upload_name(filename: str | None, allowed_suffixes: set[str]) -> str | None:
    original = Path(filename or "").name
    if not original or any(ord(ch) < 32 for ch in original):
        return None
    suffix = Path(original).suffix.lower()
    if suffix not in allowed_suffixes:
        return None
    # Never reuse user-controlled names. This prevents double-extension tricks,
    # path confusion, hidden dotfiles, and sensitive original filename exposure.
    return f"{uuid4().hex}{suffix}"



def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_password(password: str, salt: str | None = None) -> dict[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PASSWORD_ITERATIONS,
    ).hex()
    return {"salt": salt, "password_hash": digest}


def _verify_password(password: str, salt: str, password_hash: str) -> bool:
    try:
        expected = _hash_password(password, salt)["password_hash"]
    except Exception:
        return False
    return hmac.compare_digest(expected, password_hash)


def _public_admin_user(user: dict) -> dict:
    return {
        "id": str(user.get("id", "")),
        "username": str(user.get("username", "")),
        "display_name": str(user.get("display_name", "")),
        "role": str(user.get("role", "admin")),
        "created_at": str(user.get("created_at", "")),
        "last_login_at": str(user.get("last_login_at", "")),
    }


def _normalize_admin_store(data) -> dict:
    users = data.get("users", []) if isinstance(data, dict) else []
    if not isinstance(users, list):
        users = []
    normalized = []
    for item in users:
        if not isinstance(item, dict):
            continue
        username = str(item.get("username", "")).strip()
        salt = str(item.get("salt", "")).strip()
        password_hash = str(item.get("password_hash", "")).strip()
        if not username or not salt or not password_hash:
            continue
        role = str(item.get("role", "admin")).strip().lower()
        if role not in {"admin", "superadmin"}:
            role = "admin"
        normalized.append({
            "id": str(item.get("id", uuid4().hex[:12])),
            "username": username,
            "display_name": str(item.get("display_name", "")).strip(),
            "role": role,
            "salt": salt,
            "password_hash": password_hash,
            "created_at": str(item.get("created_at", _utc_now().isoformat())),
            "last_login_at": str(item.get("last_login_at", "")),
        })
    return {"users": normalized}


def _seed_default_admin() -> dict:
    password = ADMIN_PASSWORD or ADMIN_TOKEN or "admin123456"
    hashed = _hash_password(password)
    return {
        "users": [
            {
                "id": uuid4().hex[:12],
                "username": "admin",
                "display_name": "System Admin",
                "role": "admin",
                "salt": hashed["salt"],
                "password_hash": hashed["password_hash"],
                "created_at": _utc_now().isoformat(),
                "last_login_at": "",
            }
        ]
    }


def _load_admin_users() -> dict:
    data = None
    if ADMIN_USERS_FILE.exists():
        try:
            with ADMIN_USERS_FILE.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = None
    store = _normalize_admin_store(data or {})
    if not store["users"]:
        store = _seed_default_admin()
        _save_admin_users(store)
    return store


def _save_admin_users(store: dict) -> None:
    _write_json_atomic(ADMIN_USERS_FILE, _normalize_admin_store(store))


def _find_admin_user(store: dict, username: str) -> dict | None:
    needle = username.strip().lower()
    for user in store.get("users", []):
        if str(user.get("username", "")).strip().lower() == needle:
            return user
    return None


def _admin_from_token(token: str | None) -> dict | None:
    if not token:
        return None
    token = token.strip()
    # Backward-compatible emergency token: existing ADMIN_TOKEN still works.
    if ADMIN_TOKEN and hmac.compare_digest(token, ADMIN_TOKEN):
        return {"id": "legacy-token", "username": "legacy-admin", "role": "superadmin", "display_name": "Token Super Admin"}

    session = ADMIN_SESSIONS.get(token)
    if not session:
        return None
    try:
        expires_at = datetime.fromisoformat(str(session.get("expires_at")))
    except Exception:
        ADMIN_SESSIONS.pop(token, None)
        return None
    if _utc_now() > expires_at:
        ADMIN_SESSIONS.pop(token, None)
        return None
    return {
        "id": str(session.get("id", "")),
        "username": str(session.get("username", "")),
        "display_name": str(session.get("display_name", "")),
        "role": str(session.get("role", "admin")),
        "csrf_token": str(session.get("csrf_token", "")),
    }


def _issue_admin_session(user: dict) -> dict:
    token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    expires_at = _utc_now() + timedelta(hours=max(1, ADMIN_SESSION_HOURS))
    ADMIN_SESSIONS[token] = {
        "id": str(user.get("id", "")),
        "username": str(user.get("username", "")),
        "display_name": str(user.get("display_name", "")),
        "role": str(user.get("role", "admin")),
        "csrf_token": csrf_token,
        "expires_at": expires_at.isoformat(),
    }
    return {"token": token, "expires_at": expires_at.isoformat(), "csrf_token": csrf_token}


def _validate_new_username(username: str) -> str:
    clean = username.strip()
    if not re.fullmatch(r"[0-9A-Za-z_@.\-]{3,40}", clean):
        raise HTTPException(status_code=400, detail="Username must be 3-40 chars: letters, numbers, _, ., -, @.")
    return clean


def _boolish(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on", "置顶"}

def _normalize_award_type(value) -> str:
    raw = str(value or "").strip().lower()
    personal_aliases = {"personal", "individual", "solo", "person", "个人", "个人赛", "个人奖"}
    team_aliases = {"team", "group", "collective", "团队", "团队赛", "团体", "团体赛"}
    if raw in personal_aliases or "个人" in raw or "individual" in raw:
        return "personal"
    if raw in team_aliases or "团队" in raw or "团体" in raw:
        return "team"
    return "team"


def _normalize_award_level(value) -> str:
    raw_text = str(value or "").strip()
    raw = raw_text.lower()
    national_aliases = {"national", "country", "国家", "国家级", "全国", "全国赛", "国赛"}
    provincial_aliases = {"provincial", "province", "省", "省级", "省赛", "省部级"}
    if raw in national_aliases or "国家" in raw_text or "全国" in raw_text or raw == "national":
        return "国家级"
    if raw in provincial_aliases or "省" in raw_text or "prov" in raw:
        return "省级"
    return "省级"


def _award_level_rank(item: dict) -> int:
    return 1 if _normalize_award_level(item.get("level")) == "国家级" else 0


def _award_sort_key(item: dict) -> tuple[int, int, float, str]:
    return (
        1 if _boolish(item.get("pinned", False)) else 0,
        _award_level_rank(item),
        _record_sort_value(item, ("date", "year", "created_at")),
        _record_sort_text(item, ("date", "year", "created_at")),
    )


def _load_team_content() -> dict:
    empty = {
        "awards": [],
        "gallery": [],
        "seniors": [],
        "news": [],
        "review_images": [],
        "review_albums": [],
        "team_intro": "",
        "team_overview": "",
    }
    if not TEAM_CONTENT_FILE.exists():
        return dict(empty)
    try:
        with TEAM_CONTENT_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return dict(empty)
    if not isinstance(data, dict):
        data = dict(empty)

    for key, default in empty.items():
        if key not in data or not isinstance(data[key], type(default)):
            data[key] = default.copy() if isinstance(default, list) else default

    normalized_awards: list[dict] = []
    for item in data["awards"]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        image_url = str(item.get("image_url", "")).strip()
        if not title and not image_url:
            continue
        normalized_awards.append(
            {
                "id": str(item.get("id", uuid4().hex[:10])),
                "title": title,
                "award_type": _normalize_award_type(
                    item.get("award_type", item.get("category", item.get("type", "")))
                ),
                "year": str(item.get("year", "")).strip(),
                "level": _normalize_award_level(item.get("level", "")),
                "organizer": str(item.get("organizer", "")).strip(),
                "description": str(item.get("description", "")).strip(),
                "image_url": image_url,
                "pinned": _boolish(item.get("pinned", False)),
                "created_at": str(item.get("created_at", item.get("year", ""))).strip(),
                "updated_at": str(item.get("updated_at", "")).strip(),
            }
        )
    normalized_awards.sort(key=_award_sort_key, reverse=True)
    data["awards"] = normalized_awards

    normalized_seniors: list[dict] = []
    for item in data["seniors"]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        photo_url = str(item.get("photo_url", "")).strip()
        if not name and not photo_url:
            continue
        normalized_seniors.append(
            {
                "id": str(item.get("id", uuid4().hex[:10])),
                "name": name,
                "grade": str(item.get("grade", "")).strip(),
                "hall": str(item.get("hall", "binary")).strip() or "binary",
                "direction": str(item.get("direction", "")).strip(),
                "intro": str(item.get("intro", "")).strip(),
                "achievements": str(item.get("achievements", "")).strip(),
                "advice": str(item.get("advice", "")).strip(),
                "photo_url": photo_url,
                "pinned": _boolish(item.get("pinned", False)),
                "responsible": _boolish(
                    item.get(
                        "responsible",
                        item.get("is_responsible", item.get("is_manager", False)),
                    )
                ),
                "created_at": str(item.get("created_at", item.get("grade", ""))).strip(),
                "updated_at": str(item.get("updated_at", "")).strip(),
            }
        )
    normalized_seniors.sort(key=_record_sort_key, reverse=True)
    data["seniors"] = normalized_seniors

    normalized_review: list[dict] = []
    for item in data["review_images"]:
        if isinstance(item, str):
            url = item.strip()
            if not url:
                continue
            normalized_review.append(
                {
                    "id": url,
                    "url": url,
                    "title": Path(url).stem,
                    "description": "",
                    "pinned": False,
                    "created_at": "",
                    "updated_at": "",
                }
            )
            continue
        if not isinstance(item, dict):
            continue
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        normalized_review.append(
            {
                "id": str(item.get("id", url)),
                "url": url,
                "title": str(item.get("title", "")).strip(),
                "description": str(item.get("description", "")).strip(),
                "pinned": _boolish(item.get("pinned", False)),
                "created_at": str(item.get("created_at", "")).strip(),
                "updated_at": str(item.get("updated_at", "")).strip(),
            }
        )
    normalized_review.sort(key=_record_sort_key, reverse=True)
    data["review_images"] = normalized_review

    normalized_review_albums: list[dict] = []
    for item in data["review_albums"]:
        if not isinstance(item, dict):
            continue
        image_urls = [
            str(url).strip()
            for url in (item.get("image_urls", []) if isinstance(item.get("image_urls", []), list) else [])
            if isinstance(url, str) and str(url).strip()
        ]
        single_url = str(item.get("url", "")).strip()
        if single_url and single_url not in image_urls:
            image_urls.insert(0, single_url)
        title = str(item.get("title", "")).strip()
        if not title and not image_urls:
            continue
        cover_url = str(item.get("cover_url", "")).strip()
        if cover_url and cover_url not in image_urls:
            image_urls.insert(0, cover_url)
        if not cover_url and image_urls:
            cover_url = image_urls[0]
        normalized_review_albums.append(
            {
                "id": str(item.get("id", uuid4().hex[:10])),
                "title": title or "团队回顾",
                "date": str(item.get("date", "")).strip(),
                "category": str(item.get("category", "")).strip(),
                "summary": str(item.get("summary", item.get("description", ""))).strip(),
                "content": str(item.get("content", "")).strip(),
                "cover_url": cover_url,
                "image_urls": image_urls,
                "pinned": _boolish(item.get("pinned", False)),
                "created_at": str(item.get("created_at", item.get("date", ""))).strip(),
                "updated_at": str(item.get("updated_at", "")).strip(),
            }
        )

    if not normalized_review_albums and normalized_review:
        legacy_urls = [str(x.get("url", "")).strip() for x in normalized_review if str(x.get("url", "")).strip()]
        if legacy_urls:
            normalized_review_albums.append(
                {
                    "id": "legacy-review",
                    "title": "团队回顾照片",
                    "date": "",
                    "category": "历史回顾",
                    "summary": "历史团队回顾照片合集。",
                    "content": "",
                    "cover_url": legacy_urls[0],
                    "image_urls": legacy_urls,
                    "pinned": False,
                    "created_at": "",
                    "updated_at": "",
                }
            )
    normalized_review_albums.sort(key=_record_sort_key, reverse=True)
    data["review_albums"] = normalized_review_albums

    normalized_news: list[dict] = []
    for item in data["news"]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        normalized_news.append(
            {
                "id": str(item.get("id", uuid4().hex[:10])),
                "title": title,
                "date": str(item.get("date", "")).strip(),
                "summary": str(item.get("summary", "")).strip(),
                "source": str(item.get("source", "")).strip(),
                "content": str(item.get("content", "")).strip(),
                "cover_url": str(item.get("cover_url", "")).strip(),
                "image_urls": [
                    str(url).strip()
                    for url in (item.get("image_urls", []) if isinstance(item.get("image_urls", []), list) else [])
                    if isinstance(url, str) and str(url).strip()
                ],
                "pinned": _boolish(item.get("pinned", False)),
                "created_at": str(item.get("created_at", item.get("date", ""))).strip(),
                "updated_at": str(item.get("updated_at", "")).strip(),
            }
        )
    normalized_news.sort(key=_news_sort_key, reverse=True)
    data["news"] = normalized_news
    return data

def _save_team_content(data: dict) -> None:
    _write_json_atomic(TEAM_CONTENT_FILE, data)


def _save_uploaded_images(files: List[UploadFile], target_dir: Path, url_prefix: str) -> list[str]:
    _ensure_upload_count(files)
    allowed = IMAGE_UPLOAD_SUFFIXES
    target_dir.mkdir(parents=True, exist_ok=True)
    saved_urls: list[str] = []

    for f in files:
        safe_name = _safe_upload_name(f.filename, allowed)
        if safe_name is None:
            continue
        target_path = target_dir / safe_name
        _copy_upload_limited(f, target_path, MAX_IMAGE_UPLOAD_BYTES, "image", Path(safe_name).suffix.lower())
        saved_urls.append(f"{url_prefix}/{safe_name}")
    return saved_urls


def _delete_uploaded_image(url: str, target_dir: Path, expected_prefix: str) -> None:
    if not url.startswith(expected_prefix):
        return
    file_name = Path(url).name
    file_path = (target_dir / file_name).resolve()
    root = target_dir.resolve()
    try:
        file_path.relative_to(root)
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass


def _clean_image_url_list(urls: list[str]) -> list[str]:
    cleaned: list[str] = []
    for url in urls or []:
        if not isinstance(url, str):
            continue
        clean = url.strip()
        if clean and clean not in cleaned:
            cleaned.append(clean)
    return cleaned


def _find_review_album(data: dict, album_id: str) -> dict | None:
    return next((x for x in data.get("review_albums", []) if str(x.get("id")) == album_id), None)


def _parse_sort_timestamp(value) -> float:
    text = str(value or "").strip()
    if not text:
        return 0.0
    normalized = (
        text.replace("年", "-")
        .replace("月", "-")
        .replace("日", "")
        .replace("/", "-")
        .replace(".", "-")
    )

    # Common display date: 2025-11-8 / 2025.11.08 / 2025年11月8日.
    match = re.search(r"(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})", normalized)
    if match:
        try:
            dt = datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)), tzinfo=timezone.utc)
            return dt.timestamp()
        except Exception:
            return 0.0

    # ISO backend time, e.g. 2026-05-09T08:00:00+00:00.
    try:
        iso = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except Exception:
        pass

    # Year-only fallback for awards or old records.
    match = re.search(r"(20\d{2}|19\d{2})", text)
    if match:
        try:
            return datetime(int(match.group(1)), 1, 1, tzinfo=timezone.utc).timestamp()
        except Exception:
            return 0.0
    return 0.0


def _record_sort_text(item: dict, fields=("created_at", "date", "year", "grade")) -> str:
    for field in fields:
        value = str(item.get(field) or "").strip()
        if value:
            return value
    return ""


def _record_sort_value(item: dict, fields=("created_at", "date", "year", "grade")) -> float:
    for field in fields:
        ts = _parse_sort_timestamp(item.get(field))
        if ts:
            return ts
    return 0.0


def _record_sort_time(item: dict) -> str:
    # Prefer backend registration time; fall back to manually-entered date/year/grade for old records.
    return _record_sort_text(item)


def _record_sort_key(item: dict) -> tuple[int, float, str]:
    return (
        1 if _boolish(item.get("pinned", False)) else 0,
        _record_sort_value(item),
        _record_sort_text(item),
    )


def _news_sort_key(item: dict) -> tuple[int, float, str]:
    # News cards should follow the visible news date first. This fixes dates like
    # "2025-11-8" vs "2025-11-11", which sort incorrectly as plain strings.
    return (
        1 if _boolish(item.get("pinned", False)) else 0,
        _record_sort_value(item, ("date", "created_at")),
        _record_sort_text(item, ("date", "created_at")),
    )


def _cleanup_recruit_captchas() -> None:
    now = time.time()
    expired = [token for token, item in RECRUIT_CAPTCHA_STORE.items() if float(item.get("expires_at", 0)) < now]
    for token in expired:
        RECRUIT_CAPTCHA_STORE.pop(token, None)
    if len(RECRUIT_CAPTCHA_STORE) > 1000:
        ordered = sorted(RECRUIT_CAPTCHA_STORE.items(), key=lambda kv: float(kv[1].get("expires_at", 0)))
        for token, _ in ordered[: max(1, len(RECRUIT_CAPTCHA_STORE) - 800)]:
            RECRUIT_CAPTCHA_STORE.pop(token, None)


def _captcha_hash(token: str, answer: str) -> str:
    secret = ADMIN_TOKEN or ADMIN_PASSWORD or "flyteam-captcha"
    raw = f"{token}:{str(answer).strip().lower()}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()


def _generate_c_code_captcha() -> tuple[str, int]:
    """Generate a unique small C output question for recruit captcha."""
    kind = secrets.randbelow(6)
    nonce = secrets.token_hex(3)

    if kind == 0:
        n = secrets.randbelow(4) + 3  # 3..6
        start_value = secrets.randbelow(3) + 1
        step = secrets.randbelow(3) + 1
        answer = sum(start_value + i * step for i in range(1, n + 1))
        code = f"""#include <stdio.h>
int main(void) {{
    int s = 0;
    for (int i = 1; i <= {n}; i++) {{
        s += {start_value} + i * {step};
    }}
    printf("%d", s);
    return 0;
}}"""
    elif kind == 1:
        n = secrets.randbelow(5) + 5  # 5..9
        mod = secrets.choice([2, 3])
        add = secrets.randbelow(4) + 3
        sub = secrets.randbelow(2) + 1
        base = secrets.randbelow(6) + 12
        answer = base + sum(add if i % mod == 0 else -sub for i in range(1, n + 1))
        code = f"""#include <stdio.h>
int main(void) {{
    int x = {base};
    for (int i = 1; i <= {n}; i++) {{
        if (i % {mod} == 0) {{
            x += {add};
        }} else {{
            x -= {sub};
        }}
    }}
    printf("%d", x);
    return 0;
}}"""
    elif kind == 2:
        x = secrets.randbelow(8) + 3
        y = secrets.randbelow(6) + 2
        if x > y:
            answer = x * 2 + y
        else:
            answer = y * 2 - x
        code = f"""#include <stdio.h>
int main(void) {{
    int x = {x};
    int y = {y};
    if (x > y) {{
        x = x * 2 + y;
    }} else {{
        x = y * 2 - x;
    }}
    printf("%d", x);
    return 0;
}}"""
    elif kind == 3:
        n = secrets.randbelow(4) + 3  # 3..6
        a = secrets.randbelow(3) + 1
        answer = a
        for i in range(n):
            answer += i
        code = f"""#include <stdio.h>
int main(void) {{
    int a = {a};
    int i = 0;
    while (i < {n}) {{
        a += i;
        i++;
    }}
    printf("%d", a);
    return 0;
}}"""
    elif kind == 4:
        n = secrets.randbelow(4) + 4  # 4..7
        answer = 1
        for i in range(1, n + 1):
            if i % 2 == 0:
                answer += i
            else:
                answer *= 2
        code = f"""#include <stdio.h>
int main(void) {{
    int ans = 1;
    for (int i = 1; i <= {n}; i++) {{
        if (i % 2 == 0) {{
            ans += i;
        }} else {{
            ans *= 2;
        }}
    }}
    printf("%d", ans);
    return 0;
}}"""
    else:
        a = secrets.randbelow(5) + 2
        b = secrets.randbelow(5) + 2
        c = secrets.randbelow(6) + 1
        answer = (a + b) * c
        code = f"""#include <stdio.h>
int main(void) {{
    int a = {a};
    int b = {b};
    int c = {c};
    if ((a + b) > c) {{
        c = (a + b) * c;
    }} else {{
        c = a + b + c;
    }}
    printf("%d", c);
    return 0;
}}"""

    # The nonce comment makes every displayed challenge unique even if a random
    # template happens to choose the same variables.
    code = f"/* Flyteam captcha: {nonce} */\n" + code
    title = "\u4e0b\u9762 C \u8bed\u8a00\u4ee3\u7801\u7684 printf \u8f93\u51fa\u7ed3\u679c\u662f\u591a\u5c11\uff1f"
    return title + "\n\n" + code, answer


def _generate_recruit_captcha(client_ip: str) -> dict:
    _cleanup_recruit_captchas()
    challenge, answer = _generate_c_code_captcha()
    token = secrets.token_urlsafe(24)
    RECRUIT_CAPTCHA_STORE[token] = {
        "answer_hash": _captcha_hash(token, str(answer)),
        "expires_at": time.time() + RECRUIT_CAPTCHA_TTL_SECONDS,
        "ip": client_ip,
        "attempts": 0,
    }
    return {
        "token": token,
        "challenge": challenge,
        "expires_in": RECRUIT_CAPTCHA_TTL_SECONDS,
        "captcha_type": "c_output",
    }


def _verify_recruit_captcha(token: str, answer: str, client_ip: str) -> bool:
    _cleanup_recruit_captchas()
    token = str(token or "").strip()
    answer = str(answer or "").strip()
    if not token or not answer:
        return False
    item = RECRUIT_CAPTCHA_STORE.get(token)
    if not item:
        return False
    if float(item.get("expires_at", 0)) < time.time():
        RECRUIT_CAPTCHA_STORE.pop(token, None)
        return False
    if str(item.get("ip", "")) != client_ip:
        RECRUIT_CAPTCHA_STORE.pop(token, None)
        return False
    item["attempts"] = int(item.get("attempts", 0)) + 1
    expected = str(item.get("answer_hash", ""))
    ok = bool(expected) and hmac.compare_digest(expected, _captcha_hash(token, answer))
    if ok or int(item.get("attempts", 0)) >= RECRUIT_CAPTCHA_MAX_ATTEMPTS:
        RECRUIT_CAPTCHA_STORE.pop(token, None)
    return ok


def _load_recruit_content() -> list[dict]:
    if not RECRUIT_CONTENT_FILE.exists():
        return []
    try:
        with RECRUIT_CONTENT_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return []
    raw_items = data if isinstance(data, list) else []
    normalized: list[dict] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "id": str(item.get("id", uuid4().hex[:12])),
                "name": str(item.get("name", "")).strip(),
                "student_id": str(item.get("student_id", "")).strip(),
                "college": str(item.get("college", "")).strip(),
                "grade": str(item.get("grade", "")).strip(),
                "phone": str(item.get("phone", "")).strip(),
                "wechat": str(item.get("wechat", "")).strip(),
                "email": str(item.get("email", "")).strip(),
                "hall": str(item.get("hall", "binary")).strip() if str(item.get("hall", "")).strip() in {"binary", "web", "dev", "management"} else "binary",
                "direction_detail": str(item.get("direction_detail", "")).strip(),
                "experience": str(item.get("experience", "")).strip(),
                "weekly_hours": str(item.get("weekly_hours", "")).strip(),
                "note": str(item.get("note", "")).strip(),
                "pinned": _boolish(item.get("pinned", False)),
                "created_at": str(item.get("created_at", "")).strip(),
                "updated_at": str(item.get("updated_at", "")).strip(),
            }
        )
    normalized.sort(key=_record_sort_key, reverse=True)
    return normalized

def _save_recruit_content(items: list[dict]) -> None:
    _write_json_atomic(RECRUIT_CONTENT_FILE, items)


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/login")
def login_page(admin_session: str | None = Cookie(default=None, alias="admin_session")):
    if _admin_from_token(admin_session) is not None:
        return RedirectResponse("/admin", status_code=302)
    return FileResponse(STATIC_DIR / "login.html", headers={"Cache-Control": "no-store"})


@app.get("/admin")
def admin_page(admin_session: str | None = Cookie(default=None, alias="admin_session")):
    if _admin_from_token(admin_session) is None:
        return RedirectResponse("/login", status_code=302)
    return FileResponse(STATIC_DIR / "admin.html", headers={"Cache-Control": "no-store"})


@app.get("/flyteamers")
def flyteamers_page():
    return FileResponse(STATIC_DIR / "flyteamers.html", headers={"Cache-Control": "no-store"})


@app.get("/recruit")
def recruit_page():
    return FileResponse(STATIC_DIR / "recruit.html", headers={"Cache-Control": "no-store"})


@app.get("/news")
def news_page():
    return FileResponse(STATIC_DIR / "news.html", headers={"Cache-Control": "no-store"})


@app.get("/awards")
def awards_page():
    return FileResponse(STATIC_DIR / "awards.html", headers={"Cache-Control": "no-store"})


@app.get("/review")
def review_page():
    return FileResponse(STATIC_DIR / "review.html", headers={"Cache-Control": "no-store"})


@app.get("/review/{album_id}")
def review_detail_page(album_id: str):
    return FileResponse(STATIC_DIR / "review_detail.html", headers={"Cache-Control": "no-store"})


@app.get("/intro")
def intro_page():
    return FileResponse(STATIC_DIR / "intro.html", headers={"Cache-Control": "no-store"})


@app.get("/api/status")
def status():
    if rag_service is None:
        return {"chunks": 0, "ready": False, "error": rag_init_error}
    return {"chunks": rag_service.count_chunks(), "ready": True}


@app.get("/api/content")
def get_content():
    return _load_team_content()


@app.get("/api/news/{news_id}")
def get_news_item(news_id: str):
    data = _load_team_content()
    item = next((x for x in data["news"] if str(x.get("id")) == news_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="News not found.")
    return {"news": item}


@app.post("/api/admin/login")
def admin_login(payload: AdminLoginRequest, request: Request, response: Response):
    login_key = f"login:{_client_ip(request)}:{payload.username.strip().lower()}"
    if not _check_rate_limit(login_key, 8, 15 * 60, consume=False):
        raise HTTPException(status_code=429, detail="Too many failed login attempts. Please try again later.")

    store = _load_admin_users()
    user = _find_admin_user(store, payload.username)
    if user is None or not _verify_password(payload.password, str(user.get("salt", "")), str(user.get("password_hash", ""))):
        _check_rate_limit(login_key, 8, 15 * 60, consume=True)
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    _clear_rate_limit(login_key)
    user["last_login_at"] = _utc_now().isoformat()
    _save_admin_users(store)
    session = _issue_admin_session(user)
    response.set_cookie(
        "admin_session",
        session["token"],
        max_age=max(1, ADMIN_SESSION_HOURS) * 3600,
        httponly=True,
        secure=ADMIN_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return {**session, "user": _public_admin_user(user)}


@app.post("/api/admin/logout")
def admin_logout(
    response: Response,
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
    admin_session: str | None = Cookie(default=None, alias="admin_session"),
):
    for token in [x_admin_token, admin_session]:
        if token:
            ADMIN_SESSIONS.pop(token, None)
    response.delete_cookie("admin_session", path="/")
    return {"ok": True}


@app.get("/api/admin/ping")
def admin_ping(admin: dict = Depends(verify_admin)):
    user = {k: v for k, v in admin.items() if k != "csrf_token"}
    return {"ok": True, "user": user, "csrf_token": admin.get("csrf_token", "")}


@app.get("/api/admin/users")
def list_admin_users(_: dict = Depends(require_superadmin)):
    store = _load_admin_users()
    return {"users": [_public_admin_user(user) for user in store.get("users", [])]}


@app.post("/api/admin/users")
def add_admin_user(payload: AdminUserCreateRequest, _: dict = Depends(require_superadmin)):
    store = _load_admin_users()
    username = _validate_new_username(payload.username)
    if _find_admin_user(store, username) is not None:
        raise HTTPException(status_code=409, detail="Admin username already exists.")
    hashed = _hash_password(payload.password)
    user = {
        "id": uuid4().hex[:12],
        "username": username,
        "display_name": payload.display_name.strip(),
        "role": payload.role,
        "salt": hashed["salt"],
        "password_hash": hashed["password_hash"],
        "created_at": _utc_now().isoformat(),
        "last_login_at": "",
    }
    store.setdefault("users", []).append(user)
    _save_admin_users(store)
    return {"user": _public_admin_user(user)}


@app.put("/api/admin/users/{user_id}/password")
def update_admin_user_password(user_id: str, payload: AdminPasswordUpdateRequest, _: dict = Depends(require_superadmin)):
    store = _load_admin_users()
    target = next((u for u in store.get("users", []) if str(u.get("id")) == user_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Admin user not found.")
    hashed = _hash_password(payload.password)
    target["salt"] = hashed["salt"]
    target["password_hash"] = hashed["password_hash"]
    _save_admin_users(store)
    username = str(target.get("username", ""))
    for token, session in list(ADMIN_SESSIONS.items()):
        if str(session.get("username", "")) == username:
            ADMIN_SESSIONS.pop(token, None)
    return {"updated": user_id}


@app.put("/api/admin/users/{user_id}/role")
def update_admin_user_role(user_id: str, payload: AdminRoleUpdateRequest, admin: dict = Depends(require_superadmin)):
    store = _load_admin_users()
    target = next((u for u in store.get("users", []) if str(u.get("id")) == user_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Admin user not found.")
    old_role = str(target.get("role", "admin"))
    if old_role == "superadmin" and payload.role != "superadmin":
        super_count = sum(1 for u in store.get("users", []) if str(u.get("role", "admin")) == "superadmin")
        if super_count <= 1:
            raise HTTPException(status_code=400, detail="At least one super administrator must remain.")
        if str(admin.get("id")) == user_id:
            raise HTTPException(status_code=400, detail="You cannot downgrade your current super administrator account.")
    target["role"] = payload.role
    _save_admin_users(store)
    username = str(target.get("username", ""))
    for token, session in list(ADMIN_SESSIONS.items()):
        if str(session.get("username", "")) == username:
            ADMIN_SESSIONS.pop(token, None)
    return {"user": _public_admin_user(target)}


@app.delete("/api/admin/users/{user_id}")
def delete_admin_user(user_id: str, admin: dict = Depends(require_superadmin)):
    store = _load_admin_users()
    users = store.get("users", [])
    target = next((u for u in users if str(u.get("id")) == user_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Admin user not found.")
    if len(users) <= 1:
        raise HTTPException(status_code=400, detail="At least one admin user must remain.")
    if str(target.get("role", "admin")) == "superadmin":
        super_count = sum(1 for u in users if str(u.get("role", "admin")) == "superadmin")
        if super_count <= 1:
            raise HTTPException(status_code=400, detail="At least one super administrator must remain.")
    if str(admin.get("id")) == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete the current admin account.")
    store["users"] = [u for u in users if str(u.get("id")) != user_id]
    _save_admin_users(store)
    username = str(target.get("username", ""))
    for token, session in list(ADMIN_SESSIONS.items()):
        if str(session.get("username", "")) == username:
            ADMIN_SESSIONS.pop(token, None)
    return {"deleted": user_id}


@app.post("/api/awards")
def add_award(payload: AwardCreateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    item = {
        "id": uuid4().hex[:10],
        "title": payload.title.strip(),
        "award_type": _normalize_award_type(payload.award_type),
        "year": payload.year.strip(),
        "level": _normalize_award_level(payload.level),
        "organizer": payload.organizer.strip(),
        "description": payload.description.strip(),
        "image_url": payload.image_url.strip(),
        "pinned": payload.pinned,
        "created_at": _utc_now().isoformat(),
        "updated_at": "",
    }
    data["awards"].append(item)
    _save_team_content(data)
    return {"award": item}


@app.put("/api/awards/{award_id}")
def update_award(award_id: str, payload: AwardUpdateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((a for a in data["awards"] if str(a.get("id")) == award_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Award not found.")
    old_image = str(target.get("image_url", "")).strip()
    target.update(
        {
            "title": payload.title.strip(),
            "award_type": _normalize_award_type(payload.award_type),
            "year": payload.year.strip(),
            "level": _normalize_award_level(payload.level),
            "organizer": payload.organizer.strip(),
            "description": payload.description.strip(),
            "image_url": payload.image_url.strip(),
            "pinned": payload.pinned,
            "created_at": str(target.get("created_at") or target.get("year") or ""),
            "updated_at": _utc_now().isoformat(),
        }
    )
    if old_image and old_image != target["image_url"]:
        _delete_uploaded_image(old_image, AWARD_UPLOAD_DIR, "/uploads/awards")
    _save_team_content(data)
    return {"award": target}


@app.delete("/api/awards/{award_id}")
def delete_award(award_id: str, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((a for a in data["awards"] if str(a.get("id")) == award_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Award not found.")
    data["awards"] = [a for a in data["awards"] if str(a.get("id")) != award_id]
    _delete_uploaded_image(str(target.get("image_url", "")), AWARD_UPLOAD_DIR, "/uploads/awards")
    _save_team_content(data)
    return {"deleted": award_id}


@app.post("/api/seniors")
def add_senior(payload: SeniorCreateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    item = {
        "id": uuid4().hex[:10],
        "name": payload.name.strip(),
        "grade": payload.grade.strip(),
        "hall": payload.hall,
        "direction": payload.direction.strip(),
        "intro": payload.intro.strip(),
        "achievements": payload.achievements.strip(),
        "advice": payload.advice.strip(),
        "photo_url": payload.photo_url.strip(),
        "pinned": payload.pinned,
        "responsible": payload.responsible,
        "created_at": _utc_now().isoformat(),
        "updated_at": "",
    }
    data["seniors"].append(item)
    _save_team_content(data)
    return {"senior": item}


@app.put("/api/seniors/{senior_id}")
def update_senior(senior_id: str, payload: SeniorUpdateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((x for x in data["seniors"] if str(x.get("id")) == senior_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Senior not found.")

    old_photo = str(target.get("photo_url", "")).strip()
    target.update(
        {
            "name": payload.name.strip(),
            "grade": payload.grade.strip(),
            "hall": payload.hall,
            "direction": payload.direction.strip(),
            "intro": payload.intro.strip(),
            "achievements": payload.achievements.strip(),
            "advice": payload.advice.strip(),
            "photo_url": payload.photo_url.strip(),
            "pinned": payload.pinned,
            "responsible": payload.responsible,
            "created_at": str(target.get("created_at") or target.get("grade") or ""),
            "updated_at": _utc_now().isoformat(),
        }
    )

    if old_photo and old_photo != target["photo_url"]:
        _delete_uploaded_image(old_photo, SENIOR_UPLOAD_DIR, "/uploads/seniors")

    _save_team_content(data)
    return {"senior": target}


@app.delete("/api/seniors/{senior_id}")
def delete_senior(senior_id: str, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((x for x in data["seniors"] if str(x.get("id")) == senior_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Senior not found.")
    data["seniors"] = [x for x in data["seniors"] if str(x.get("id")) != senior_id]
    _delete_uploaded_image(str(target.get("photo_url", "")), SENIOR_UPLOAD_DIR, "/uploads/seniors")
    _save_team_content(data)
    return {"deleted": senior_id}


@app.post("/api/news")
def add_news(payload: NewsCreateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    image_urls = [
        str(url).strip()
        for url in payload.image_urls
        if isinstance(url, str) and str(url).strip()
    ]
    item = {
        "id": uuid4().hex[:10],
        "title": payload.title.strip(),
        "date": payload.date.strip(),
        "summary": payload.summary.strip(),
        "source": payload.source.strip(),
        "content": payload.content.strip(),
        "cover_url": payload.cover_url.strip(),
        "image_urls": image_urls,
        "pinned": payload.pinned,
        "created_at": _utc_now().isoformat(),
        "updated_at": "",
    }
    data["news"].append(item)
    _save_team_content(data)
    return {"news": item}


@app.put("/api/news/{news_id}")
def update_news(news_id: str, payload: NewsUpdateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((x for x in data["news"] if str(x.get("id")) == news_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="News not found.")
    image_urls = _clean_image_url_list(payload.image_urls)
    target.update(
        {
            "title": payload.title.strip(),
            "date": payload.date.strip(),
            "summary": payload.summary.strip(),
            "source": payload.source.strip(),
            "content": payload.content.strip(),
            "cover_url": payload.cover_url.strip(),
            "image_urls": image_urls,
            "pinned": payload.pinned,
            "created_at": str(target.get("created_at") or target.get("date") or ""),
            "updated_at": _utc_now().isoformat(),
        }
    )
    _save_team_content(data)
    return {"news": target}


@app.delete("/api/news/{news_id}")
def delete_news(news_id: str, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((x for x in data["news"] if str(x.get("id")) == news_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="News not found.")
    data["news"] = [x for x in data["news"] if str(x.get("id")) != news_id]
    _delete_uploaded_image(str(target.get("cover_url", "")), NEWS_UPLOAD_DIR, "/uploads/news")
    for url in target.get("image_urls", []) or []:
        _delete_uploaded_image(str(url), NEWS_UPLOAD_DIR, "/uploads/news")
    _save_team_content(data)
    return {"deleted": news_id}


@app.post("/api/content/intro")
def save_team_intro(payload: TeamIntroUpdateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    data["team_intro"] = payload.intro.strip()
    _save_team_content(data)
    return {"saved": True}


@app.post("/api/content/overview")
def save_team_overview(payload: TeamOverviewUpdateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    data["team_overview"] = payload.overview.strip()
    _save_team_content(data)
    return {"saved": True}


@app.get("/api/review/albums/{album_id}")
def get_review_album(album_id: str):
    data = _load_team_content()
    target = _find_review_album(data, album_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Review album not found.")
    return {"album": target}


@app.post("/api/review/albums")
def add_review_album(payload: ReviewAlbumCreateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    image_urls = _clean_image_url_list(payload.image_urls)
    cover_url = payload.cover_url.strip()
    if cover_url and cover_url not in image_urls:
        image_urls.insert(0, cover_url)
    if not cover_url and image_urls:
        cover_url = image_urls[0]
    item = {
        "id": uuid4().hex[:10],
        "title": payload.title.strip(),
        "date": payload.date.strip(),
        "category": payload.category.strip(),
        "summary": payload.summary.strip(),
        "content": payload.content.strip(),
        "cover_url": cover_url,
        "image_urls": image_urls,
        "pinned": payload.pinned,
        "created_at": _utc_now().isoformat(),
        "updated_at": "",
    }
    data.setdefault("review_albums", []).append(item)
    _save_team_content(data)
    return {"album": item}


@app.put("/api/review/albums/{album_id}")
def update_review_album(album_id: str, payload: ReviewAlbumUpdateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = _find_review_album(data, album_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Review album not found.")
    image_urls = _clean_image_url_list(payload.image_urls)
    cover_url = payload.cover_url.strip()
    if cover_url and cover_url not in image_urls:
        image_urls.insert(0, cover_url)
    if not cover_url and image_urls:
        cover_url = image_urls[0]
    target.update(
        {
            "title": payload.title.strip(),
            "date": payload.date.strip(),
            "category": payload.category.strip(),
            "summary": payload.summary.strip(),
            "content": payload.content.strip(),
            "cover_url": cover_url,
            "image_urls": image_urls,
            "pinned": payload.pinned,
            "created_at": str(target.get("created_at") or target.get("date") or ""),
            "updated_at": _utc_now().isoformat(),
        }
    )
    _save_team_content(data)
    return {"album": target}


@app.post("/api/review/albums/{album_id}/image/delete")
def delete_review_album_image(album_id: str, payload: GalleryDeleteRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = _find_review_album(data, album_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Review album not found.")
    url = payload.url.strip()
    image_urls = [u for u in target.get("image_urls", []) if str(u).strip()]
    if url not in image_urls and url != str(target.get("cover_url", "")).strip():
        raise HTTPException(status_code=404, detail="Image not found in review album.")
    target["image_urls"] = [u for u in image_urls if u != url]
    if str(target.get("cover_url", "")).strip() == url:
        target["cover_url"] = target["image_urls"][0] if target["image_urls"] else ""
    _delete_uploaded_image(url, REVIEW_UPLOAD_DIR, "/uploads/review")
    _save_team_content(data)
    return {"album": target, "deleted": url}


@app.delete("/api/review/albums/{album_id}")
def delete_review_album(album_id: str, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = _find_review_album(data, album_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Review album not found.")
    urls = set(str(u).strip() for u in target.get("image_urls", []) if str(u).strip())
    cover_url = str(target.get("cover_url", "")).strip()
    if cover_url:
        urls.add(cover_url)
    data["review_albums"] = [x for x in data.get("review_albums", []) if str(x.get("id")) != album_id]
    for url in urls:
        _delete_uploaded_image(url, REVIEW_UPLOAD_DIR, "/uploads/review")
    _save_team_content(data)
    return {"deleted": album_id}


@app.post("/api/review")
def add_review_item(payload: ReviewCreateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    item = {
        "id": uuid4().hex[:10],
        "url": payload.image_url.strip(),
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "pinned": payload.pinned,
        "created_at": _utc_now().isoformat(),
        "updated_at": "",
    }
    data["review_images"].append(item)
    _save_team_content(data)
    return {"review": item}


@app.put("/api/review/{review_id}")
def update_review_item(review_id: str, payload: ReviewUpdateRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((x for x in data["review_images"] if str(x.get("id")) == review_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Review item not found.")
    target["title"] = payload.title.strip()
    target["description"] = payload.description.strip()
    target["pinned"] = payload.pinned
    target["updated_at"] = _utc_now().isoformat()
    _save_team_content(data)
    return {"review": target}


@app.delete("/api/review/{review_id}")
def delete_review_item(review_id: str, _: None = Depends(verify_admin)):
    data = _load_team_content()
    target = next((x for x in data["review_images"] if str(x.get("id")) == review_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Review item not found.")
    data["review_images"] = [x for x in data["review_images"] if str(x.get("id")) != review_id]
    _delete_uploaded_image(str(target.get("url", "")), REVIEW_UPLOAD_DIR, "/uploads/review")
    _save_team_content(data)
    return {"deleted": review_id}


@app.post("/api/content/gallery/delete")
def delete_gallery_image(payload: GalleryDeleteRequest, _: None = Depends(verify_admin)):
    data = _load_team_content()
    url = payload.url.strip()
    before = len(data["gallery"])
    data["gallery"] = [u for u in data["gallery"] if u != url]
    if len(data["gallery"]) == before:
        raise HTTPException(status_code=404, detail="Image not found in gallery.")

    _delete_uploaded_image(url, IMAGE_UPLOAD_DIR, "/uploads/images")

    _save_team_content(data)
    return {"deleted": url}


@app.post("/api/content/review/delete")
def delete_review_image(payload: GalleryDeleteRequest, _: None = Depends(verify_admin)):
    # Backward-compatible endpoint: delete by url.
    data = _load_team_content()
    url = payload.url.strip()
    target = next((x for x in data["review_images"] if str(x.get("url", "")).strip() == url), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Image not found in review.")
    data["review_images"] = [x for x in data["review_images"] if str(x.get("id")) != str(target.get("id"))]
    _delete_uploaded_image(url, REVIEW_UPLOAD_DIR, "/uploads/review")
    _save_team_content(data)
    return {"deleted": url}


@app.get("/api/recruit/captcha")
def recruit_captcha(request: Request):
    client_ip = _client_ip(request)
    if not _check_rate_limit(f"recruit-captcha:{client_ip}", 40, 300):
        raise HTTPException(status_code=429, detail="验证码刷新过于频繁，请稍后再试。")
    return _generate_recruit_captcha(client_ip)


@app.get("/api/recruit/halls")
def recruit_halls():
    return {
        "binary": "二进制（RE / PWN）",
        "web": "Web（含 Misc / 密码）",
        "dev": "开发",
        "management": "团队管理",
    }


@app.get("/api/recruit/list")
def recruit_list(_: None = Depends(verify_admin)):
    return {"items": _load_recruit_content()}


@app.get("/api/recruit/stats")
def recruit_stats():
    items = _load_recruit_content()
    stats = {"binary": 0, "web": 0, "dev": 0, "management": 0}
    for item in items:
        hall = str(item.get("hall", "")).strip()
        if hall in stats:
            stats[hall] += 1
    return {"stats": stats, "total": len(items)}


@app.post("/api/recruit/apply")
def recruit_apply(payload: RecruitCreateRequest, request: Request):
    admin = _admin_from_token(request.cookies.get("admin_session"))
    if admin is None:
        client_ip = _client_ip(request)
        if not _verify_recruit_captcha(payload.captcha_token, payload.captcha_answer, client_ip):
            raise HTTPException(status_code=400, detail="验证码错误或已过期，请刷新后重试。")
    items = _load_recruit_content()
    item = {
        "id": uuid4().hex[:12],
        "name": payload.name.strip(),
        "student_id": payload.student_id.strip(),
        "college": payload.college.strip(),
        "grade": payload.grade.strip(),
        "phone": payload.phone.strip(),
        "wechat": payload.wechat.strip(),
        "email": payload.email.strip(),
        "hall": payload.hall,
        "direction_detail": payload.direction_detail.strip(),
        "experience": payload.experience.strip(),
        "weekly_hours": payload.weekly_hours.strip(),
        "note": payload.note.strip(),
        "pinned": False,
        "created_at": _utc_now().isoformat(),
        "updated_at": "",
    }
    items.append(item)
    _save_recruit_content(items)
    return {"item": item}


@app.put("/api/recruit/{item_id}")
def recruit_update(item_id: str, payload: RecruitUpdateRequest, _: None = Depends(verify_admin)):
    items = _load_recruit_content()
    target = next((x for x in items if str(x.get("id")) == item_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Recruit application not found.")
    target.update(
        {
            "name": payload.name.strip(),
            "student_id": payload.student_id.strip(),
            "college": payload.college.strip(),
            "grade": payload.grade.strip(),
            "phone": payload.phone.strip(),
            "wechat": payload.wechat.strip(),
            "email": payload.email.strip(),
            "hall": payload.hall,
            "direction_detail": payload.direction_detail.strip(),
            "experience": payload.experience.strip(),
            "weekly_hours": payload.weekly_hours.strip(),
            "note": payload.note.strip(),
            "pinned": payload.pinned,
            "created_at": str(target.get("created_at", "")),
            "updated_at": _utc_now().isoformat(),
        }
    )
    _save_recruit_content(items)
    return {"item": target}


@app.delete("/api/recruit/{item_id}")
def recruit_delete(item_id: str, _: None = Depends(verify_admin)):
    items = _load_recruit_content()
    filtered = [x for x in items if str(x.get("id")) != item_id]
    if len(filtered) == len(items):
        raise HTTPException(status_code=404, detail="Recruit application not found.")
    _save_recruit_content(filtered)
    return {"deleted": item_id}


@app.post("/api/ingest/default")
def ingest_default(_: None = Depends(verify_admin)):
    if rag_service is None:
        raise HTTPException(status_code=500, detail=f"RAG service unavailable: {rag_init_error}")
    added = rag_service.ingest_files(DEFAULT_DATA_FILES)
    return {"added_chunks": added}


@app.post("/api/ingest/rebuild/default")
def rebuild_default(_: None = Depends(verify_admin)):
    if rag_service is None:
        raise HTTPException(status_code=500, detail=f"RAG service unavailable: {rag_init_error}")
    added = rag_service.rebuild_knowledge_base(DEFAULT_DATA_FILES)
    return {"added_chunks": added}


@app.post("/api/ingest/local")
def ingest_local(payload: IngestLocalRequest, _: None = Depends(verify_admin)):
    if rag_service is None:
        raise HTTPException(status_code=500, detail=f"RAG service unavailable: {rag_init_error}")
    file_paths = [_safe_ingest_path(p) for p in payload.paths]
    added = rag_service.ingest_files(file_paths)
    return {"added_chunks": added}


@app.post("/api/upload")
def upload_and_ingest(files: List[UploadFile] = File(...), _: None = Depends(verify_admin)):
    if rag_service is None:
        raise HTTPException(status_code=500, detail=f"RAG service unavailable: {rag_init_error}")

    _ensure_upload_count(files)
    saved_paths: list[Path] = []
    for f in files:
        safe_name = _safe_upload_name(f.filename, PDF_UPLOAD_SUFFIXES)
        if safe_name is None:
            continue
        target_path = UPLOAD_DIR / safe_name
        _copy_upload_limited(f, target_path, MAX_PDF_UPLOAD_BYTES, "pdf", Path(safe_name).suffix.lower())
        saved_paths.append(target_path)

    if not saved_paths:
        raise HTTPException(status_code=400, detail="No valid PDF files uploaded.")

    added = rag_service.ingest_files(saved_paths)
    return {
        "saved_files": [p.name for p in saved_paths],
        "added_chunks": added,
    }


@app.post("/api/upload/images")
def upload_images(files: List[UploadFile] = File(...), _: None = Depends(verify_admin)):
    saved_urls = _save_uploaded_images(files, IMAGE_UPLOAD_DIR, "/uploads/images")
    data = _load_team_content()

    if not saved_urls:
        raise HTTPException(status_code=400, detail="No valid image files uploaded.")

    for url in saved_urls:
        if url not in data["gallery"]:
            data["gallery"].append(url)
    _save_team_content(data)
    return {"saved_images": saved_urls}


@app.post("/api/upload/awards/images")
def upload_award_images(files: List[UploadFile] = File(...), _: None = Depends(verify_admin)):
    saved_urls = _save_uploaded_images(files, AWARD_UPLOAD_DIR, "/uploads/awards")
    if not saved_urls:
        raise HTTPException(status_code=400, detail="No valid image files uploaded.")
    return {"saved_images": saved_urls}


@app.post("/api/upload/seniors/images")
def upload_senior_images(files: List[UploadFile] = File(...), _: None = Depends(verify_admin)):
    saved_urls = _save_uploaded_images(files, SENIOR_UPLOAD_DIR, "/uploads/seniors")
    if not saved_urls:
        raise HTTPException(status_code=400, detail="No valid image files uploaded.")
    return {"saved_images": saved_urls}


@app.post("/api/upload/review/images")
def upload_review_images(files: List[UploadFile] = File(...), _: None = Depends(verify_admin)):
    saved_urls = _save_uploaded_images(files, REVIEW_UPLOAD_DIR, "/uploads/review")
    if not saved_urls:
        raise HTTPException(status_code=400, detail="No valid image files uploaded.")
    return {"saved_images": saved_urls}


@app.post("/api/upload/news/images")
def upload_news_images(files: List[UploadFile] = File(...), _: None = Depends(verify_admin)):
    saved_urls = _save_uploaded_images(files, NEWS_UPLOAD_DIR, "/uploads/news")
    if not saved_urls:
        raise HTTPException(status_code=400, detail="No valid image files uploaded.")
    return {"saved_images": saved_urls}


@app.post("/api/chat")
def chat(payload: AskRequest):
    if rag_service is None:
        raise HTTPException(status_code=500, detail=f"RAG service unavailable: {rag_init_error}")
    result = rag_service.ask(payload.question, top_k=payload.top_k)
    return {
        "answer": result.answer,
        "sources": result.sources,
    }

