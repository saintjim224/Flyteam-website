# Flyteam Website / RAG 官网框架（Go 后端）

这是一个基于 **Go 标准库 HTTP 服务 + 静态前端 + JSON 存储 + 纯 Go RAG 调用 OpenAI-compatible API** 的团队官网框架。

仓库只保留框架代码，不提交线上运行数据、上传图片、报名信息、管理员数据、向量库索引或本地密钥。

## 技术栈

- 后端：Go
- 前端：原静态 HTML / CSS / JS 页面保持不变
- 数据：`storage/*.json`
- 上传文件：`storage/uploads/`
- RAG：Go 后端直接调用 DashScope/OpenAI-compatible Embeddings + Chat API

## 功能模块

- 首页全屏照片墙/轮播
- 团队新闻
- 团队回顾/相册栏目
- 奖项荣誉分类展示
- Flyteamers / 前辈墙
- 招新报名 + C 语言动态验证码
- 管理员后台 / 超级管理员 / 管理员权限管理
- PDF 知识库上传、重建与 RAG 问答

## 本地运行

确认已安装 Go：

```bash
go version
```

复制环境变量模板：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

启动开发服务：

```bash
go run ./cmd/flyteam-server
```

浏览器访问：

```text
http://127.0.0.1:8000
```

指定端口：

```bash
PORT=8080 go run ./cmd/flyteam-server
```

Windows PowerShell：

```powershell
$env:PORT=8080; go run ./cmd/flyteam-server
```

## 生产编译

Linux：

```bash
go build -o flyteam-server ./cmd/flyteam-server
./flyteam-server
```

Windows：

```powershell
go build -o flyteam-server.exe ./cmd/flyteam-server
.\flyteam-server.exe
```

## 环境变量

请在 `.env` 中自行填写真实配置，`.env` 不要提交到 Git。

```env
DASHSCOPE_API_KEY=your_dashscope_api_key_here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CHAT_MODEL=qwen-plus
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_BATCH_SIZE=10
RETRIEVAL_MIN_RELEVANCE=0.08
ADMIN_TOKEN=change_me_admin_token
ADMIN_PASSWORD=change_me_admin_password
ADMIN_COOKIE_SECURE=0
PORT=8000
```

## PDF 文字提取说明

Go 后端内置基础 PDF 文本提取能力；为了让中文 PDF 的 RAG 效果更稳定，VPS 建议安装：

```bash
apt update
apt install -y poppler-utils
```

安装后 Go 后端会自动优先调用 `pdftotext`，不需要 Python。

## 运行数据说明

以下目录/文件属于运行时数据，已被 `.gitignore` 排除，不应提交：

```text
.env
storage/uploads/
storage/chroma/   # 旧版向量库缓存（如存在）
storage/*.json
storage/*.log
storage/rag_index_go.json
*.pdf
flyteam-server
flyteam-server.exe
```

如果需要初始化知识库，请部署后在后台上传 PDF 或点击后台的知识库重建功能。

## 常用检查命令

```bash
go test ./...
go build ./cmd/flyteam-server
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
