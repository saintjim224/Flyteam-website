# 协作开发说明

本项目采用：**别人 Fork 仓库 -> 提 Pull Request -> 负责人审核 -> 合并**。

这样成员不会直接改坏主仓库，所有改动都需要经过你审核。

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

让成员打开：

```text
https://github.com/z3ghxxx/Flyteam-website
```

点击右上角：

```text
Fork
```

这样他的账号下面会生成一个自己的副本。

### 2. 成员 Clone 自己 Fork 后的仓库

```bash
git clone git@github.com:成员用户名/Flyteam-website.git
cd Flyteam-website
```

### 3. 添加你的原仓库为 upstream

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

你在 GitHub 的 Pull Requests 页面查看：

```text
Files changed
```

确认没问题后点击：

```text
Merge pull request
```

如果有问题，直接在 PR 页面评论，让成员继续修改。

## 分支规则

- `main`：线上稳定分支，只接受审核后的 PR 合并。
- `feature/xxx`：新功能分支，例如 `feature/news-editor`。
- `fix/xxx`：问题修复分支，例如 `fix/upload-check`。
- `docs/xxx`：文档分支，例如 `docs/deploy-guide`。

## 提交前检查

修改后建议至少运行：

```bash
python -m py_compile app/main.py
node --check app/static/public.js
node --check app/static/news.js
node --check app/static/app.js
```

如果改了后端接口，建议本地启动测试：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

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

安装依赖并启动：

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 不要提交的内容

以下内容已经在 `.gitignore` 中排除：

- `.env` 密钥配置
- `.venv` 虚拟环境
- `storage/uploads` 上传图片缓存
- `storage/chroma` 向量库
- `storage/*.json` 运行数据、报名信息、管理员数据
- 日志文件
- 本地 PDF 资料

如果确实需要提交示例数据，请先脱敏并单独说明。
