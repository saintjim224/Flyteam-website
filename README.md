# Flyteam Website / RAG 官网框架

这是一个基于 **FastAPI + 静态前端 + JSON 存储 + RAG 问答** 的团队官网框架。

仓库只保留框架代码，不提交线上运行数据、上传图片、报名信息、管理员数据、向量库缓存或本地密钥。

## 功能模块

- 首页全屏照片墙/轮播
- 团队新闻
- 团队回顾/相册栏目
- 奖项荣誉分类展示
- Flyteamers / 前辈墙
- 招新报名
- 管理员后台
- PDF 知识库上传与 RAG 问答

## 本地运行

```bash
python -m venv .venv
```

Windows：

```bash
.\.venv\Scripts\activate
```

Linux/macOS：

```bash
source .venv/bin/activate
```

安装依赖：

```bash
pip install -r requirements.txt
```

复制环境变量模板：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

启动：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

浏览器访问：

```text
http://127.0.0.1:8000
```

## 环境变量

请在 `.env` 中自行填写真实配置，`.env` 不要提交到 Git。

```env
DASHSCOPE_API_KEY=your_dashscope_api_key_here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CHAT_MODEL=qwen-plus
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_BATCH_SIZE=10
RETRIEVAL_MIN_RELEVANCE=0.2
ADMIN_TOKEN=change_me_admin_token
ADMIN_PASSWORD=change_me_admin_password
ADMIN_COOKIE_SECURE=1
```

## 运行数据说明

以下目录/文件属于运行时数据，已被 `.gitignore` 排除，不应提交：

```text
.env
.venv/
storage/uploads/
storage/chroma/
storage/*.json
storage/*.log
*.pdf
```

如果需要初始化知识库，请部署后在后台上传 PDF 或点击后台的知识库重建功能。

## 常用检查命令

```bash
python -m py_compile app/main.py
node --check app/static/public.js
node --check app/static/news.js
node --check app/static/app.js
```

## 协作方式

采用：

```text
Fork 仓库 -> 新建功能分支 -> 提交 Pull Request -> 负责人审核合并
```

详细流程见：

```text
CONTRIBUTING.md
```
