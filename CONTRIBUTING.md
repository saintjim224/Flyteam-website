# 协作开发说明

本项目采用：**别人 Fork 仓库 -> 提 Pull Request -> 负责人审核 -> 合并**。

这样成员不会直接改坏主仓库，所有改动都需要经过负责人审核。

## 仓库地址

```bash
git@github.com:z3ghxxx/Flyteam-website.git
```

如果成员没有配置 SSH，也可以使用 HTTPS：

```bash
https://github.com/z3ghxxx/Flyteam-website.git
```

## 推荐协作流程

### 1. 成员先 Fork 仓库

打开：

```text
https://github.com/z3ghxxx/Flyteam-website
```

点击右上角 `Fork`，生成自己账号下的副本。

### 2. Clone 自己 Fork 后的仓库

```bash
git clone git@github.com:成员用户名/Flyteam-website.git
cd Flyteam-website
```

### 3. 添加原仓库为 upstream

```bash
git remote add upstream git@github.com:z3ghxxx/Flyteam-website.git
git fetch upstream
```

### 4. 每次开发前同步最新主仓库

```bash
git checkout main
git pull upstream main
git push origin main
```

### 5. 创建自己的功能分支

```bash
git checkout -b feature/功能名
```

示例：

```bash
git checkout -b feature/news-editor
git checkout -b fix/upload-image
git checkout -b docs/deploy-guide
```

### 6. 修改后提交到自己的 Fork

```bash
git add .
git commit -m "说明本次修改内容"
git push -u origin feature/功能名
```

### 7. 在 GitHub 上发起 Pull Request

PR 方向选择：

```text
base repository: z3ghxxx/Flyteam-website
base branch: main

compare repository: 成员用户名/Flyteam-website
compare branch: feature/功能名
```

### 8. 负责人审核

在 GitHub 的 Pull Requests 页面查看 `Files changed`，确认没问题后点击 `Merge pull request`。

如果有问题，直接在 PR 页面评论，让成员继续修改。

## 分支规则

- `main`：线上稳定分支，只接受审核后的 PR 合并。
- `feature/xxx`：新功能分支，例如 `feature/news-editor`。
- `fix/xxx`：问题修复分支，例如 `fix/upload-check`。
- `docs/xxx`：文档分支，例如 `docs/deploy-guide`。

## 博客社区化改造协作

如果参与“普通用户注册、博客文章、评论、关注、私信、群聊”等大型改造，请先阅读仓库根目录：

```text
BLOG_COMMUNITY_ROADMAP.md
TEAM_TASK_ALLOCATION.md
```

建议按模块开分支，避免多人同时改同一批文件：

```text
feature/community-user-auth
feature/community-blog-core
feature/community-blog-editor
feature/community-comments-interactions
feature/community-follow-space
feature/community-private-message
feature/community-group-chat
feature/community-search-notification
feature/community-admin-moderation
```

Go 后端已在 `cmd/flyteam-server/community_reserved.go` 预留 API，占位接口可通过 `GET /api/community/status` 查看。实际开发时，谁负责某个模块，就只实现对应模块的占位接口，并补齐权限校验和测试。

## 本地运行

本项目后端已整体迁移为 Go，前端仍然是 `app/static/` 下的静态页面。

```bash
go version
cp .env.example .env
go run ./cmd/flyteam-server
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
$env:PORT=8000
go run ./cmd/flyteam-server
```

浏览器访问：

```text
http://127.0.0.1:8000
```

## 提交前检查

修改后建议至少运行：

```bash
gofmt -w cmd/flyteam-server
go test ./...
go build ./cmd/flyteam-server
node --check app/static/public.js
node --check app/static/news.js
node --check app/static/app.js
```

如果只改了前端页面，也建议本地启动网站手动检查对应页面和管理员后台。

## RAG / 知识库说明

RAG 已改为纯 Go 实现：

- 后端直接调用 DashScope/OpenAI-compatible `/embeddings` 和 `/chat/completions`；
- 索引文件为运行时数据 `storage/rag_index_go.json`，不要提交；
- PDF 上传后由后台触发入库；
- VPS 上建议安装 `poppler-utils`，Go 后端会优先调用 `pdftotext` 提升中文 PDF 提取效果。

Ubuntu：

```bash
apt update
apt install -y poppler-utils
```

## 不要提交的内容

以下内容已经在 `.gitignore` 中排除：

- `.env` 密钥配置
- 本地虚拟环境 / 编辑器配置
- `storage/uploads` 上传图片缓存
- `storage/chroma` 旧版向量库缓存
- `storage/*.json` 运行数据、报名信息、管理员数据、Go RAG 索引
- 日志文件
- 本地 PDF 资料
- Go 编译产物 `flyteam-server` / `flyteam-server.exe`

如果确实需要提交示例数据，请先脱敏并单独说明。
