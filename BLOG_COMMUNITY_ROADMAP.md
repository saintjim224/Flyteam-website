# Flyteam Website 博客社区化改造大纲

> 目标：在不破坏当前官网、管理员后台、RAG、报名、新闻、回顾、奖项、前辈墙等已有功能的前提下，把项目逐步扩展为一个“简易版 CSDN / 团队技术社区”：普通用户可注册、登录、写文章、评论、关注、私信、群聊，未登录用户只能阅读公开内容。

## 0. 当前状态与改造原则

### 0.1 当前项目现状

当前项目已经迁移为：

- 后端：Go 标准库 HTTP 服务。
- 前端：`app/static/` 下的静态 HTML/CSS/JS。
- 当前数据：`storage/*.json` 运行时 JSON 文件。
- RAG：纯 Go 调用 DashScope/OpenAI-compatible API，索引为 `storage/rag_index_go.json`。
- 已有后台：管理员后台 `/admin`，用于团队官网信息维护。

### 0.2 本次大方向

新增一套“普通用户社区系统”，不要直接混入原管理员后台：

- `/admin`：仍然只给管理员/超级管理员维护官网内容。
- 普通用户后台建议叫：创作中心 / 个人空间，例如后续页面：
  - `/creator`：个人创作后台。
  - `/space/{id}`：用户公开主页。
  - `/blog`：文章广场。
  - `/blog/{id}`：文章详情。
  - `/messages`：私信。
  - `/groups`：群聊。

### 0.3 必须坚持的原则

1. **先接口和数据模型，后页面细节**：多人协作时先固定 API 合同，避免前后端反复冲突。
2. **管理员和普通用户账号隔离**：管理员表不要和普通用户表混用。
3. **未登录只读**：未登录用户能浏览公开文章、用户主页、公开评论，但不能评论、关注、私信、发文、点赞、收藏、加群。
4. **权限最小化**：用户只能修改自己的文章/评论/资料；管理员可审核和删除违规内容。
5. **兼容旧功能**：现有团队新闻、团队回顾、奖项荣誉、前辈墙、招新报名、RAG 问答不能被影响。
6. **安全优先**：文章富文本必须做 XSS 过滤；上传文件继续使用现有白名单和魔术头检查。
7. **阶段性交付**：每个阶段都要能独立测试、独立合并，不要一个 PR 一次性塞全部功能。

---

## 1. 总体功能蓝图

### 1.1 普通用户账号系统

用户注册字段：

- `nickname`：昵称，可重复但建议显示时配合用户 ID。
- `user_id`：用户自定义 ID / 登录名，唯一，例如 `z3ghxxx`、`fly_web_01`。
- `password`：密码，后端必须哈希存储。

后续可扩展：

- 头像 `avatar_url`
- 简介 `bio`
- 邮箱 `email`
- GitHub/博客链接 `links`
- 个人标签 `skills`
- 注册时间、最后登录时间
- 状态：正常、禁言、封禁、注销

核心能力：

- 注册
- 登录
- 退出
- 查看当前登录用户
- 编辑个人资料
- 查看公开主页
- 用户权限状态：是否禁言、是否允许发文、是否允许私信

### 1.2 博客文章系统

类似 CSDN 的简化版本：

- 登录用户可以进入创作中心发表文章。
- 未登录用户只能阅读公开文章。
- 文章支持：
  - 标题
  - 摘要
  - 封面图
  - 正文
  - Markdown 格式
  - 任意语言代码块，例如 `go`、`python`、`c`、`java`、`js`、`bash`
  - 图片插入
  - 标签
  - 分类
  - 草稿/已发布/隐藏/审核中
  - 浏览量、点赞数、收藏数、评论数
  - 置顶/推荐权重

强烈建议正文格式：

- 存储原始 Markdown：`content_markdown`
- 前端渲染 HTML 时必须做 XSS 清洗
- 不建议允许用户提交任意 HTML，因为会导致 XSS
- 支持代码高亮可以后续用 `highlight.js` 或类似库

### 1.3 文章聚合与推荐

所有文章最终聚合到一个公开文章广场：

- 最新文章
- 热门文章
- 推荐文章
- 标签筛选
- 作者筛选
- 搜索
- 排序：
  - 最新发布
  - 浏览量高
  - 点赞多
  - 收藏多
  - 评论多
  - 综合推荐

推荐分数建议：

```text
score = 浏览量 * 1
      + 点赞数 * 5
      + 收藏数 * 8
      + 评论数 * 3
      + 作者粉丝数 * 0.5
      + 推荐权重 * 20
      - 时间衰减
```

第一版可以先简单实现：

```text
score = views + likes * 5 + favorites * 8 + comments * 3
```

### 1.4 评论系统

- 未登录用户只能看评论。
- 登录用户可以评论。
- 评论可以支持一级评论，后续再支持楼中楼。
- 用户可删除自己的评论。
- 管理员可删除任何违规评论。
- 评论需要记录 IP 摘要/风险信息，用于反垃圾。

### 1.5 关注系统

- 用户可以关注其他用户。
- 用户可以取消关注。
- 个人主页显示：关注数、粉丝数、文章数。
- 文章推荐可以利用关注关系。

### 1.6 私信系统

第一版建议做“站内信/私信”，不要一开始就强上 WebSocket：

- 会话列表
- 打开会话
- 发送消息
- 拉取消息
- 未读数量
- 屏蔽用户
- 举报消息

实时性阶段：

1. 第一版：HTTP 轮询。
2. 第二版：SSE 单向推送。
3. 第三版：WebSocket 双向实时聊天。

### 1.7 群聊系统

类似简化群组：

- 创建群
- 群资料
- 加入/退出群
- 群成员列表
- 群消息
- 群主/管理员
- 踢人/禁言
- 群公告

第一版可先实现：

- 群创建
- 群列表
- 加入群
- 发送群消息
- 查看历史消息

### 1.8 通知系统

需要统一通知：

- 有人关注我
- 有人评论我的文章
- 有人回复我的评论
- 有人给我发私信
- 群聊邀请
- 文章被管理员处理

---

## 2. 建议架构

### 2.1 后端目录建议

现有 Go 后端在：

```text
cmd/flyteam-server/
```

建议后续按模块拆分文件：

```text
cmd/flyteam-server/
  user_auth.go             普通用户注册、登录、会话
  user_profile.go          普通用户资料、主页
  blog_article.go          文章 CRUD、发布、阅读
  blog_comment.go          评论
  blog_interaction.go      点赞、收藏、浏览
  blog_recommendation.go   推荐排序
  social_follow.go         关注/粉丝
  message_private.go       私信
  group_chat.go            群聊
  notification.go          通知
  community_storage.go     社区数据存储接口
  community_models.go      社区数据结构
  community_reserved.go    当前已经预留的 API 占位
```

### 2.2 前端页面建议

```text
app/static/
  blog.html                文章广场
  blog.js
  article.html             文章详情
  article.js
  creator.html             创作中心
  creator.js
  editor.html              文章编辑器
  editor.js
  space.html               用户主页
  space.js
  messages.html            私信
  messages.js
  groups.html              群聊
  groups.js
  community.css            社区公共样式
```

也可以先不拆太细，第一版先用：

```text
blog.html
blog.js
creator.html
creator.js
space.html
space.js
```

### 2.3 数据存储建议

当前项目使用 JSON 存储，适合官网内容，但不适合大量文章、评论、私信、群聊。

推荐分阶段：

#### 阶段 A：SQLite

适合 2 核 2G VPS，部署简单：

```text
storage/community.db
```

优点：

- 单机部署简单
- 不需要额外数据库服务
- 查询文章、评论、消息比 JSON 稳定
- 方便备份

缺点：

- 多实例扩展能力弱
- 超大并发不适合

#### 阶段 B：PostgreSQL / MySQL

当用户和文章量变大后再迁移。

建议先在代码里定义 Repository 接口，避免后续从 SQLite 迁移到 PostgreSQL 时大改业务逻辑。

---

## 3. 数据模型草案

> 字段名可以后续微调，但 API 和数据库要保持一致。建议统一使用 `snake_case`。

### 3.1 `community_users`

```sql
id                  TEXT PRIMARY KEY
user_id             TEXT UNIQUE NOT NULL
nickname            TEXT NOT NULL
password_hash       TEXT NOT NULL
salt                TEXT NOT NULL
avatar_url          TEXT
bio                 TEXT
role                TEXT DEFAULT 'user'        -- user/moderator/admin
status              TEXT DEFAULT 'active'      -- active/muted/banned/deleted
created_at          TEXT NOT NULL
updated_at          TEXT
last_login_at       TEXT
```

### 3.2 `community_sessions`

```sql
session_token        TEXT PRIMARY KEY
user_id              TEXT NOT NULL
csrf_token           TEXT NOT NULL
expires_at           TEXT NOT NULL
created_at           TEXT NOT NULL
user_agent_hash      TEXT
ip_hash              TEXT
```

### 3.3 `blog_articles`

```sql
id                  TEXT PRIMARY KEY
author_id           TEXT NOT NULL
title               TEXT NOT NULL
slug                TEXT
summary             TEXT
cover_url           TEXT
content_markdown    TEXT NOT NULL
content_html        TEXT                 -- 可选：缓存渲染后的安全 HTML
status              TEXT DEFAULT 'draft' -- draft/published/hidden/review/deleted
visibility          TEXT DEFAULT 'public'-- public/private/followers
language            TEXT                 -- 主语言，例如 go/python/c/web/misc
category            TEXT
pinned              INTEGER DEFAULT 0
recommend_weight    INTEGER DEFAULT 0
views               INTEGER DEFAULT 0
likes               INTEGER DEFAULT 0
favorites           INTEGER DEFAULT 0
comments            INTEGER DEFAULT 0
published_at        TEXT
created_at          TEXT NOT NULL
updated_at          TEXT
```

### 3.4 `blog_article_tags`

```sql
article_id          TEXT NOT NULL
tag                 TEXT NOT NULL
PRIMARY KEY(article_id, tag)
```

### 3.5 `blog_article_versions`

```sql
id                  TEXT PRIMARY KEY
article_id          TEXT NOT NULL
title               TEXT
summary             TEXT
content_markdown    TEXT
created_at          TEXT NOT NULL
created_by          TEXT NOT NULL
```

用于文章历史版本，防止误删误改。

### 3.6 `blog_comments`

```sql
id                  TEXT PRIMARY KEY
article_id          TEXT NOT NULL
author_id           TEXT NOT NULL
parent_id           TEXT
content             TEXT NOT NULL
status              TEXT DEFAULT 'visible' -- visible/deleted/hidden
created_at          TEXT NOT NULL
updated_at          TEXT
```

### 3.7 `blog_likes`

```sql
article_id          TEXT NOT NULL
user_id             TEXT NOT NULL
created_at          TEXT NOT NULL
PRIMARY KEY(article_id, user_id)
```

### 3.8 `blog_favorites`

```sql
article_id          TEXT NOT NULL
user_id             TEXT NOT NULL
created_at          TEXT NOT NULL
PRIMARY KEY(article_id, user_id)
```

### 3.9 `social_follows`

```sql
follower_id         TEXT NOT NULL
following_id        TEXT NOT NULL
created_at          TEXT NOT NULL
PRIMARY KEY(follower_id, following_id)
```

### 3.10 `private_conversations`

```sql
id                  TEXT PRIMARY KEY
user_a              TEXT NOT NULL
user_b              TEXT NOT NULL
created_at          TEXT NOT NULL
updated_at          TEXT
last_message_at     TEXT
```

### 3.11 `private_messages`

```sql
id                  TEXT PRIMARY KEY
conversation_id     TEXT NOT NULL
sender_id           TEXT NOT NULL
content             TEXT NOT NULL
status              TEXT DEFAULT 'normal' -- normal/deleted/blocked
created_at          TEXT NOT NULL
read_at             TEXT
```

### 3.12 `chat_groups`

```sql
id                  TEXT PRIMARY KEY
owner_id            TEXT NOT NULL
name                TEXT NOT NULL
avatar_url          TEXT
intro               TEXT
visibility          TEXT DEFAULT 'public' -- public/private
created_at          TEXT NOT NULL
updated_at          TEXT
```

### 3.13 `chat_group_members`

```sql
group_id            TEXT NOT NULL
user_id             TEXT NOT NULL
role                TEXT DEFAULT 'member' -- owner/admin/member
status              TEXT DEFAULT 'active' -- active/muted/left/kicked
joined_at           TEXT NOT NULL
PRIMARY KEY(group_id, user_id)
```

### 3.14 `chat_group_messages`

```sql
id                  TEXT PRIMARY KEY
group_id            TEXT NOT NULL
sender_id           TEXT NOT NULL
content             TEXT NOT NULL
status              TEXT DEFAULT 'normal'
created_at          TEXT NOT NULL
```

### 3.15 `notifications`

```sql
id                  TEXT PRIMARY KEY
user_id             TEXT NOT NULL
type                TEXT NOT NULL
payload_json        TEXT
read_at             TEXT
created_at          TEXT NOT NULL
```

---

## 4. 已在代码中预留的 API

代码文件：

```text
cmd/flyteam-server/community_reserved.go
```

查询预留接口：

```http
GET /api/community/status
```

返回内容会列出所有预留接口、模块、阶段、权限要求。当前这些接口会返回 `501 Not Implemented`，用于告诉协作者：路由名已经占位，后续按模块实现。

### 4.1 用户系统

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/users/register` | guest | 普通用户注册 |
| POST | `/api/users/login` | guest | 普通用户登录 |
| POST | `/api/users/logout` | user | 普通用户退出 |
| GET | `/api/users/me` | user | 当前用户信息 |
| GET | `/api/users/{id}` | guest | 用户公开主页资料 |
| PUT | `/api/users/{id}` | owner/admin | 编辑用户资料 |

### 4.2 博客文章

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/blog/articles` | guest | 文章列表 |
| POST | `/api/blog/articles` | user | 新建文章 |
| GET | `/api/blog/articles/{id}` | guest | 文章详情 |
| PUT | `/api/blog/articles/{id}` | owner/admin | 编辑文章 |
| DELETE | `/api/blog/articles/{id}` | owner/admin | 删除文章 |
| POST | `/api/blog/articles/{id}/publish` | owner/admin | 发布文章 |
| POST | `/api/blog/articles/{id}/view` | guest | 记录浏览 |
| GET | `/api/blog/recommendations` | guest | 推荐文章 |
| POST | `/api/upload/blog/images` | user | 博客图片上传 |

### 4.3 互动与评论

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/blog/articles/{id}/like` | user | 点赞 |
| DELETE | `/api/blog/articles/{id}/like` | user | 取消点赞 |
| POST | `/api/blog/articles/{id}/favorite` | user | 收藏 |
| DELETE | `/api/blog/articles/{id}/favorite` | user | 取消收藏 |
| GET | `/api/blog/articles/{id}/comments` | guest | 评论列表 |
| POST | `/api/blog/articles/{id}/comments` | user | 发表评论 |
| PUT | `/api/blog/comments/{id}` | owner/admin | 编辑评论 |
| DELETE | `/api/blog/comments/{id}` | owner/admin | 删除评论 |

### 4.4 关注系统

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/social/follows/{id}` | user | 关注用户 |
| DELETE | `/api/social/follows/{id}` | user | 取消关注 |
| GET | `/api/social/following/{id}` | guest | 用户关注列表 |
| GET | `/api/social/followers/{id}` | guest | 用户粉丝列表 |

### 4.5 私信

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/messages/conversations` | user | 会话列表 |
| POST | `/api/messages/conversations` | user | 创建/打开会话 |
| GET | `/api/messages/conversations/{id}` | participant | 会话详情 |
| GET | `/api/messages/conversations/{id}/messages` | participant | 消息列表 |
| POST | `/api/messages/conversations/{id}/messages` | participant | 发送私信 |

### 4.6 群聊

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/groups` | guest | 群列表 |
| POST | `/api/groups` | user | 创建群 |
| GET | `/api/groups/{id}` | guest | 群资料 |
| PUT | `/api/groups/{id}` | owner/admin | 编辑群资料 |
| DELETE | `/api/groups/{id}` | owner/admin | 解散群 |
| GET | `/api/groups/{id}/members` | member | 群成员 |
| POST | `/api/groups/{id}/members` | member/admin | 加群/邀请 |
| DELETE | `/api/groups/{id}/members/{user_id}` | owner/admin | 移除成员 |
| GET | `/api/groups/{id}/messages` | member | 群消息 |
| POST | `/api/groups/{id}/messages` | member | 发送群消息 |

### 4.7 通知与搜索

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/notifications` | user | 通知列表 |
| POST | `/api/notifications/{id}/read` | user | 标记已读 |
| GET | `/api/search` | guest | 全站搜索 |

---

## 5. API 返回格式规范

### 5.1 成功返回

统一使用 JSON：

```json
{
  "item": {},
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 100
}
```

单个对象可以使用明确字段：

```json
{
  "article": {}
}
```

### 5.2 错误返回

沿用当前项目格式：

```json
{
  "detail": "错误说明"
}
```

### 5.3 分页规范

请求：

```text
?page=1&page_size=20
```

响应：

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0,
  "has_more": false
}
```

### 5.4 游标分页规范

消息类接口建议用游标：

```text
?cursor=2026-05-09T00:00:00Z&limit=30
```

响应：

```json
{
  "items": [],
  "next_cursor": "",
  "has_more": false
}
```

---

## 6. 权限设计

### 6.1 用户角色

| 角色 | 说明 |
|---|---|
| guest | 未登录用户 |
| user | 普通注册用户 |
| moderator | 社区审核员，可处理评论、文章、用户举报 |
| admin | 官网管理员，已有后台账号体系 |
| superadmin | 最高管理员，已有超级管理员体系 |

### 6.2 权限矩阵

| 功能 | guest | user | moderator | admin/superadmin |
|---|---:|---:|---:|---:|
| 阅读公开文章 | ✅ | ✅ | ✅ | ✅ |
| 注册/登录 | ✅ | ✅ | ✅ | ✅ |
| 发布文章 | ❌ | ✅ | ✅ | ✅ |
| 评论 | ❌ | ✅ | ✅ | ✅ |
| 点赞/收藏 | ❌ | ✅ | ✅ | ✅ |
| 关注 | ❌ | ✅ | ✅ | ✅ |
| 私信 | ❌ | ✅ | ✅ | ✅ |
| 群聊发言 | ❌ | ✅ | ✅ | ✅ |
| 删除自己文章 | ❌ | ✅ | ✅ | ✅ |
| 删除他人违规内容 | ❌ | ❌ | ✅ | ✅ |
| 封禁用户 | ❌ | ❌ | ⚠️ 可选 | ✅ |
| 管理官网内容 | ❌ | ❌ | ❌ | ✅ |

---

## 7. 前端页面详细拆分

### 7.1 文章广场 `/blog`

功能：

- 顶部导航：最新、热门、推荐、标签
- 搜索框
- 文章卡片：标题、摘要、作者、发布时间、浏览量、点赞数、评论数
- 右侧推荐榜：热门文章、活跃作者
- 未登录用户显示“登录后可评论/关注/收藏”提示

### 7.2 文章详情 `/blog/{id}`

功能：

- 标题、作者、发布时间、标签
- 正文 Markdown 渲染
- 代码高亮
- 图片双击放大可以复用现有逻辑
- 浏览量记录
- 点赞、收藏、评论
- 作者卡片：关注按钮、发私信按钮
- 相关文章推荐

### 7.3 创作中心 `/creator`

功能：

- 我的文章
- 草稿箱
- 已发布
- 被隐藏/审核中
- 新建文章
- 数据统计：文章数、总浏览、总点赞、粉丝数

### 7.4 编辑器 `/editor`

功能：

- 标题输入
- 摘要输入
- 封面上传
- 标签编辑
- 分类选择
- Markdown 编辑区
- 实时预览
- 图片上传并插入正文
- 代码块模板
- 保存草稿
- 发布

### 7.5 用户主页 `/space/{id}`

功能：

- 用户头像、昵称、用户 ID、简介
- 关注/私信按钮
- 文章列表
- 粉丝数、关注数、文章数
- 用户最近动态

### 7.6 私信 `/messages`

功能：

- 左侧会话列表
- 右侧聊天窗口
- 发送文字
- 后续支持图片/文件
- 未读提示

### 7.7 群聊 `/groups`

功能：

- 群列表
- 创建群
- 群资料
- 群成员
- 群消息窗口

---

## 8. Git 协作拆分建议

### 8.1 总体分支策略

所有人不要直接改 `main`。

每个功能单独开分支：

```bash
git checkout main
git pull upstream main
git checkout -b feature/community-user-auth
```

命名规范：

```text
feature/community-user-auth
feature/community-blog-core
feature/community-blog-editor
feature/community-comments
feature/community-follow
feature/community-private-message
feature/community-group-chat
feature/community-notification
feature/community-search
feature/community-admin-moderation
fix/community-upload-security
style/community-blog-ui
```

### 8.2 任务拆分与负责人建议

#### A 组：用户系统

分支：

```text
feature/community-user-auth
```

负责文件：

```text
cmd/flyteam-server/user_auth.go
cmd/flyteam-server/user_profile.go
cmd/flyteam-server/community_models.go
cmd/flyteam-server/community_storage.go
app/static/login.html      注意不要破坏管理员登录
app/static/user_login.html 可新建普通用户登录页
app/static/user_login.js
```

交付内容：

- 注册接口
- 登录接口
- 普通用户会话 Cookie
- `/api/users/me`
- 用户主页公开资料接口
- 用户资料编辑接口
- 基础前端登录/注册页面

验收：

- 普通用户注册成功
- 重复 `user_id` 不允许
- 密码不明文存储
- 未登录不能访问需要登录的接口
- 管理员登录不受影响

#### B 组：文章核心

分支：

```text
feature/community-blog-core
```

负责文件：

```text
cmd/flyteam-server/blog_article.go
cmd/flyteam-server/blog_recommendation.go
app/static/blog.html
app/static/blog.js
app/static/article.html
app/static/article.js
```

交付内容：

- 文章列表
- 文章详情
- 新建文章
- 编辑文章
- 删除/软删除文章
- 发布草稿
- 浏览量统计
- 最新/热门排序

验收：

- 未登录能看公开文章
- 未登录不能发文
- 作者能编辑自己的文章
- 其他普通用户不能编辑别人的文章
- 管理员可以隐藏违规文章

#### C 组：编辑器与上传

分支：

```text
feature/community-blog-editor
```

负责文件：

```text
cmd/flyteam-server/upload.go
cmd/flyteam-server/blog_article.go
app/static/editor.html
app/static/editor.js
app/static/community.css
```

交付内容：

- Markdown 编辑器
- 代码块插入
- 图片上传并插入正文
- 封面上传
- 实时预览
- XSS 清洗方案

验收：

- `.php`、脚本伪装图片不能上传
- 图片大小限制生效
- 文章正文不执行 `<script>`
- Markdown 代码块正常显示

#### D 组：评论、点赞、收藏

分支：

```text
feature/community-comments-interactions
```

负责文件：

```text
cmd/flyteam-server/blog_comment.go
cmd/flyteam-server/blog_interaction.go
app/static/article.js
```

交付内容：

- 评论列表
- 发表评论
- 删除评论
- 点赞/取消点赞
- 收藏/取消收藏
- 评论数、点赞数、收藏数统计

验收：

- 未登录不能评论、点赞、收藏
- 登录用户不能重复点赞
- 删除评论后统计正确

#### E 组：关注和用户主页

分支：

```text
feature/community-follow-space
```

负责文件：

```text
cmd/flyteam-server/social_follow.go
cmd/flyteam-server/user_profile.go
app/static/space.html
app/static/space.js
```

交付内容：

- 关注
- 取消关注
- 粉丝列表
- 关注列表
- 用户主页文章列表

验收：

- 不能关注自己
- 重复关注不会产生多条数据
- 粉丝数/关注数正确

#### F 组：私信

分支：

```text
feature/community-private-message
```

负责文件：

```text
cmd/flyteam-server/message_private.go
app/static/messages.html
app/static/messages.js
```

交付内容：

- 会话列表
- 创建会话
- 发送私信
- 拉取消息
- 未读数

验收：

- 未登录不能发私信
- 只能查看自己的会话
- 用户不能读取别人的私信

#### G 组：群聊

分支：

```text
feature/community-group-chat
```

负责文件：

```text
cmd/flyteam-server/group_chat.go
app/static/groups.html
app/static/groups.js
```

交付内容：

- 创建群
- 群列表
- 加入群
- 群成员
- 群消息
- 群主权限

验收：

- 未加入私密群不能看消息
- 群主可以踢人
- 被踢用户不能继续发言

#### H 组：通知、搜索、推荐

分支：

```text
feature/community-search-notification
```

负责文件：

```text
cmd/flyteam-server/notification.go
cmd/flyteam-server/blog_recommendation.go
app/static/blog.js
app/static/messages.js
```

交付内容：

- 通知列表
- 标记已读
- 全站搜索
- 推荐榜

验收：

- 评论/关注/私信能生成通知
- 搜索能查到文章标题、标签、作者
- 推荐榜按规则排序

#### I 组：管理审核

分支：

```text
feature/community-admin-moderation
```

负责文件：

```text
cmd/flyteam-server/admin_community.go
app/static/admin.html
app/static/app.js
```

交付内容：

- 管理员查看用户列表
- 封禁/解封用户
- 隐藏文章
- 删除违规评论
- 查看举报

验收：

- 普通管理员和超级管理员权限区分
- 不影响原官网内容管理

---

## 9. 推荐开发顺序

### 阶段 0：接口预留和文档

当前已完成：

- `community_reserved.go`
- `GET /api/community/status`
- 本文档

### 阶段 1：普通用户系统

必须最先完成，因为后面所有互动都依赖登录态。

完成后才能做：发文、评论、关注、私信、群聊。

### 阶段 2：文章系统 MVP

先完成最核心闭环：

```text
注册 -> 登录 -> 写文章 -> 发布 -> 公开阅读
```

### 阶段 3：互动系统

```text
评论 -> 点赞 -> 收藏 -> 关注
```

### 阶段 4：私信和群聊

```text
私信 -> 群 -> 通知
```

### 阶段 5：推荐、搜索、审核和优化

```text
搜索 -> 推荐 -> 管理审核 -> 性能优化
```

---

## 10. 安全要求

### 10.1 用户密码

- 不能明文存储。
- 可沿用当前管理员密码 PBKDF2-SHA256 逻辑，也可以引入更标准的 bcrypt/argon2。
- 登录失败要限速。

### 10.2 会话

- Cookie 必须 `HttpOnly`。
- HTTPS 上线后设置 `Secure`。
- 需要 CSRF Token。
- 普通用户 Session 和管理员 Session 分开，例如：
  - 管理员：`admin_session`
  - 普通用户：`user_session`

### 10.3 文章 XSS

禁止直接信任用户提交的 HTML。

建议：

- 存 Markdown。
- 后端或前端渲染时过滤 HTML。
- 禁止 `<script>`、`onerror`、`onclick`、`javascript:` URL。

### 10.4 上传安全

博客图片上传必须复用现有安全策略：

- 只允许 jpg/jpeg/png/webp/gif。
- 检查魔术头。
- 检查扩展名和真实格式是否一致。
- 禁止脚本内容。
- 限制大小。
- 随机文件名。

### 10.5 私信/群聊反滥用

- 发送频率限制。
- 新用户冷却期。
- 黑名单/屏蔽。
- 举报。
- 管理员审计。

---

## 11. 测试要求

每个 PR 至少跑：

```bash
gofmt -w cmd/flyteam-server
go test ./...
go vet ./...
go build ./cmd/flyteam-server
node --check app/static/public.js
node --check app/static/news.js
node --check app/static/app.js
```

新增前端 JS 时也要检查：

```bash
node --check app/static/blog.js
node --check app/static/article.js
node --check app/static/creator.js
node --check app/static/editor.js
node --check app/static/space.js
node --check app/static/messages.js
node --check app/static/groups.js
```

### 11.1 用户系统测试

- 注册成功
- 重复 user_id 注册失败
- 弱密码失败
- 登录成功
- 登录失败限速
- 退出后不能访问登录接口

### 11.2 文章系统测试

- 未登录只能看文章
- 登录用户能创建文章
- 作者能编辑文章
- 非作者不能编辑文章
- 草稿不公开
- 发布后公开
- 浏览量增加

### 11.3 评论互动测试

- 未登录不能评论
- 登录能评论
- 重复点赞不增加多次
- 删除评论权限正确

### 11.4 私信测试

- 用户 A 能给用户 B 发消息
- 用户 C 不能读取 A/B 会话
- 未读数正确

### 11.5 群聊测试

- 加群后可读写
- 退群后不可发言
- 群主能踢人
- 非群主不能踢人

---

## 12. PR 审核标准

每个 PR 必须说明：

- 修改了哪些模块
- 新增了哪些 API
- 是否修改数据结构
- 是否影响旧功能
- 测试截图或测试命令结果
- 是否涉及权限/安全

不要接受以下 PR：

- 把密钥、`.env`、上传图片、数据库提交到 Git
- 大量无关格式化导致难以 review
- 一个 PR 同时改 5 个模块
- 没有权限校验的写接口
- 没有上传安全检查的文件接口
- 文章正文直接插入未清洗 HTML

---

## 13. 里程碑建议

### Milestone 1：用户系统 MVP

目标：普通用户可注册登录。

包含：

- 注册
- 登录
- 退出
- 当前用户
- 用户主页基本资料

### Milestone 2：文章系统 MVP

目标：用户能写文章，公开可读。

包含：

- 文章列表
- 文章详情
- 创建文章
- 编辑文章
- 发布文章
- 草稿
- 图片上传

### Milestone 3：互动 MVP

目标：文章具备基础社区互动。

包含：

- 评论
- 点赞
- 收藏
- 浏览量
- 简单推荐榜

### Milestone 4：社交 MVP

目标：用户之间可建立关系。

包含：

- 关注
- 粉丝
- 用户主页文章列表
- 私信

### Milestone 5：群聊 MVP

目标：能创建群并聊天。

包含：

- 群列表
- 创建群
- 加入群
- 群消息
- 群权限

### Milestone 6：治理和搜索

目标：可运营、可审核、可搜索。

包含：

- 通知
- 搜索
- 管理员审核
- 封禁/禁言
- 举报
- 推荐算法优化

---

## 14. 第一批 GitHub Issue 建议标题

可以直接复制到 GitHub Issues：

1. `[community][auth] 实现普通用户注册接口 POST /api/users/register`
2. `[community][auth] 实现普通用户登录/退出/当前用户接口`
3. `[community][storage] 引入 community.db 或社区 Repository 存储层`
4. `[community][blog] 实现文章列表和详情接口`
5. `[community][blog] 实现创建、编辑、发布、删除文章接口`
6. `[community][editor] 实现 Markdown 编辑器页面`
7. `[community][upload] 实现博客图片上传接口 /api/upload/blog/images`
8. `[community][comment] 实现文章评论接口`
9. `[community][interaction] 实现点赞和收藏接口`
10. `[community][recommend] 实现热门/推荐文章接口`
11. `[community][follow] 实现关注/粉丝接口`
12. `[community][space] 实现用户主页页面`
13. `[community][message] 实现私信会话和消息接口`
14. `[community][group] 实现群聊基础接口`
15. `[community][notification] 实现站内通知接口`
16. `[community][search] 实现文章和用户搜索`
17. `[community][admin] 实现社区内容审核后台`
18. `[community][security] 文章 Markdown 渲染与 XSS 防护`
19. `[community][test] 增加社区接口回归测试脚本`
20. `[community][docs] 完善社区 API 文档和前端页面说明`

---

## 15. 最小可用版本 MVP 范围

如果想最快上线第一版，不要一开始做私信和群聊。

建议 MVP 只做：

1. 普通用户注册登录
2. 用户主页
3. 发文章
4. 文章列表
5. 文章详情
6. 评论
7. 点赞
8. 浏览量
9. 简单推荐榜
10. 管理员隐藏违规文章/评论

私信、群聊、通知作为第二阶段。

---

## 16. 给协作者的约定

1. 先看本文档，再看 `cmd/flyteam-server/community_reserved.go`。
2. 不要随意改已有官网 API。
3. 不要把普通用户登录塞进 `/api/admin/login`。
4. 不要直接提交数据库、上传图片、`.env`。
5. 每个 PR 控制在一个模块内。
6. 每个 PR 必须能本地启动。
7. 新接口必须有权限校验。
8. 新上传接口必须有安全限制。
9. 新页面要兼容移动端。
10. 有疑问先开 Issue 讨论，不要直接大改。