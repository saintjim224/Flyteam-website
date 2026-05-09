# Flyteam Website 三人协作分配文档

> 项目成员代号：`z3`、`grand`、`dl`  
> 项目目标：在保留当前 Flyteam 官网全部功能的基础上，扩展普通用户注册、博客文章、评论互动、关注私信、群聊、通知、搜索、推荐等社区能力。  
> 重要原则：任何人都不能删除或破坏现有官网功能、现有上传缓存、VPS 运行数据和 RAG 能力。

---

## 1. 总体分工

| 成员 | 角色定位 | 主要职责 |
|---|---|---|
| `z3` | 项目负责人 / 架构负责人 / 最终合并人 | 负责总体架构、数据库方案、原有功能兼容、VPS 数据迁移、PR 审核、最终合并、部署检查、安全兜底 |
| `grand` | 用户与博客核心负责人 | 负责普通用户注册登录、用户主页、博客文章核心、文章编辑器、图片上传和文章展示闭环 |
| `dl` | 社区互动与沟通负责人 | 负责评论、点赞、收藏、关注、私信、群聊、通知、搜索、推荐等社区互动功能 |

---

## 2. 不允许破坏的原有功能

所有成员开发前必须确认：**不能删除、不能重命名、不能破坏以下已有功能。**

- 首页照片墙 / 随机背景 / 图片轮播
- 团队新闻
- 团队回顾
- 奖项荣誉
- Flyteamers / 前辈墙
- 帮主 / 负责人 / 团队管理等已有分类
- 招新报名
- 动态 C 语言验证码
- 管理员后台 `/admin`
- 超级管理员权限
- 管理员账号管理
- 文件上传限制
- 图片双击放大
- RAG 问答
- 知识库上传 / 重建
- 当前静态页面路由
- VPS 上已有上传图片、缓存、报名数据、知识库文件

任何涉及以下目录的改动必须先问 z3：

```text
storage/uploads/
storage/*.json
storage/chroma/
storage/rag_index_go.json
storage/admin_users.json
storage/team_content.json
storage/recruit_applications.json
```

---

## 3. Git 协作规范

### 3.1 禁止直接改 main

除 z3 最终合并外，所有人必须从 `main` 拉新分支开发：

```bash
git checkout main
git pull origin main
git checkout -b feature/成员代号-功能名
```

示例：

```bash
git checkout -b feature/grand-user-auth
git checkout -b feature/grand-blog-core
git checkout -b feature/dl-comments-interactions
git checkout -b feature/dl-private-message
git checkout -b feature/z3-db-migration
```

### 3.2 PR 规则

每个 PR 只能做一个模块，不允许一个 PR 同时塞入多个大功能。

PR 标题建议：

```text
[grand][auth] 实现普通用户注册登录
[grand][blog] 实现文章发布与列表
[dl][comment] 实现文章评论和点赞收藏
[dl][message] 实现私信基础接口
[z3][db] 接入 SQLite 存储基础结构
```

### 3.3 PR 合并流程

```text
成员开发分支
    ↓
提交 PR
    ↓
z3 Review
    ↓
发现问题则评论要求修改
    ↓
测试通过后 z3 合并
    ↓
z3 统一做集成测试
```

---

## 4. z3 工作分配

> z3 的工作最重，主要负责架构、集成、审批、迁移和最终质量兜底。

### 4.1 z3 必做模块

#### A. 总体架构和数据库方案

分支：

```text
feature/z3-db-foundation
```

负责内容：

- 确定数据库方案，建议 SQLite：`storage/flyteam.db`
- 设计数据库初始化逻辑
- 保证数据库文件不提交到 Git
- 设计旧数据迁移方案
- 规划后续从 SQLite 到 PostgreSQL/MySQL 的可迁移性

必须覆盖的数据：

```text
管理员账号
普通用户账号
用户会话
文章
标签
文章历史版本
评论
点赞
收藏
关注关系
私信
群聊
通知
报名信息
官网内容快照
RAG 索引快照
```

注意：上传图片/PDF 仍然存在 `storage/uploads/`，数据库只存 URL 和元信息。

#### B. 原有功能兼容层

分支：

```text
feature/z3-legacy-compat
```

负责内容：

- 保证原有 API 不变
- 保证原有前端页面不报错
- 保证旧 JSON 数据可以迁移到数据库
- 保证旧图片 URL 继续可访问
- 保证管理员后台不被普通用户系统影响

重点兼容：

```text
/api/content
/api/news
/api/review/albums
/api/awards
/api/seniors
/api/recruit/*
/api/upload/*
/api/chat
/api/admin/*
```

#### C. 安全审查和权限模型

分支：

```text
feature/z3-security-review
```

负责内容：

- 用户密码哈希存储
- 普通用户和管理员账号隔离
- CSRF 方案
- 登录限速
- 上传文件安全检查
- Markdown / 富文本 XSS 防护
- 私信/群聊反滥用策略
- 管理员审核能力

#### D. 社区审核后台

分支：

```text
feature/z3-community-moderation
```

负责内容：

- 管理员查看普通用户列表
- 封禁 / 解封用户
- 禁言用户
- 隐藏文章
- 删除违规评论
- 查看举报记录

#### E. PR 审核和最终合并

z3 需要检查每个 PR：

- 是否破坏原官网功能
- 是否有权限校验
- 是否有安全问题
- 是否提交了不该提交的文件
- 是否能本地构建
- 是否和其他人的代码冲突
- 是否需要迁移脚本

### 4.2 z3 验收标准

z3 合并任何 PR 前必须确认：

```bash
gofmt -w cmd/flyteam-server
go test ./...
go vet ./...
go build ./cmd/flyteam-server
node --check app/static/public.js
node --check app/static/news.js
node --check app/static/app.js
```

如果新增了 JS 页面，也要检查对应 JS。

---

## 5. grand 工作分配

> grand 主要负责“普通用户 + 博客文章 + 创作中心”的主流程。

### 5.1 grand 模块一：普通用户注册登录

分支：

```text
feature/grand-user-auth
```

负责接口：

```text
POST /api/users/register
POST /api/users/login
POST /api/users/logout
GET  /api/users/me
```

负责页面：

```text
app/static/user_login.html
app/static/user_login.js
app/static/user_register.html
app/static/user_register.js
```

功能要求：

- 普通用户可以注册
- 注册字段：昵称、用户 ID、密码
- 用户 ID 唯一
- 密码不能明文存储
- 登录成功后有普通用户会话
- 退出登录后会话失效
- 未登录不能访问需要登录的接口

验收标准：

```text
注册成功
重复 user_id 注册失败
弱密码注册失败
登录成功
错误密码登录失败
退出后 /api/users/me 返回未登录
管理员登录不受影响
```

---

### 5.2 grand 模块二：用户主页和资料

分支：

```text
feature/grand-user-profile
```

负责接口：

```text
GET /api/users/{id}
PUT /api/users/{id}
```

负责页面：

```text
app/static/space.html
app/static/space.js
```

功能要求：

- 公开用户主页
- 显示昵称、用户 ID、头像、简介
- 显示文章数、粉丝数、关注数
- 用户可以编辑自己的资料
- 不能编辑别人的资料

验收标准：

```text
未登录可以看公开主页
登录用户可以编辑自己资料
普通用户不能编辑别人资料
管理员审核权限后续由 z3 接入
```

---

### 5.3 grand 模块三：博客文章核心

分支：

```text
feature/grand-blog-core
```

负责接口：

```text
GET    /api/blog/articles
POST   /api/blog/articles
GET    /api/blog/articles/{id}
PUT    /api/blog/articles/{id}
DELETE /api/blog/articles/{id}
POST   /api/blog/articles/{id}/publish
POST   /api/blog/articles/{id}/view
```

负责页面：

```text
app/static/blog.html
app/static/blog.js
app/static/article.html
app/static/article.js
```

功能要求：

- 文章列表
- 文章详情
- 创建文章
- 编辑文章
- 删除文章
- 草稿
- 发布
- 浏览量统计
- 标签
- 分类
- 封面图

验收标准：

```text
未登录可以看公开文章
未登录不能发文章
登录用户可以发文章
作者可以编辑自己的文章
普通用户不能编辑别人的文章
草稿不公开
发布后公开可见
浏览量能增加
```

---

### 5.4 grand 模块四：文章编辑器

分支：

```text
feature/grand-blog-editor
```

负责接口：

```text
POST /api/upload/blog/images
```

负责页面：

```text
app/static/editor.html
app/static/editor.js
app/static/community.css
```

功能要求：

- Markdown 编辑器
- 实时预览
- 支持代码块
- 支持任意语言代码块
- 支持插入图片
- 支持封面图
- 保存草稿
- 发布文章

验收标准：

```text
能写标题
能写 Markdown 正文
能插入代码块
能上传图片
图片能插入正文
草稿能保存
文章能发布
不能执行 script 标签
```

---

## 6. dl 工作分配

> dl 主要负责“社区互动 + 私信 + 群聊 + 通知搜索推荐”。

### 6.1 dl 模块一：评论、点赞、收藏

分支：

```text
feature/dl-comments-interactions
```

负责接口：

```text
GET    /api/blog/articles/{id}/comments
POST   /api/blog/articles/{id}/comments
PUT    /api/blog/comments/{id}
DELETE /api/blog/comments/{id}

POST   /api/blog/articles/{id}/like
DELETE /api/blog/articles/{id}/like

POST   /api/blog/articles/{id}/favorite
DELETE /api/blog/articles/{id}/favorite
```

负责页面：

```text
app/static/article.js
```

功能要求：

- 文章评论列表
- 发表评论
- 删除评论
- 点赞 / 取消点赞
- 收藏 / 取消收藏
- 评论数、点赞数、收藏数统计

验收标准：

```text
未登录不能评论
未登录不能点赞收藏
登录用户可以评论
不能重复点赞
不能重复收藏
用户只能删除自己的评论
文章统计数量正确
```

---

### 6.2 dl 模块二：关注系统

分支：

```text
feature/dl-follow-system
```

负责接口：

```text
POST   /api/social/follows/{id}
DELETE /api/social/follows/{id}
GET    /api/social/following/{id}
GET    /api/social/followers/{id}
```

负责页面：

```text
app/static/space.js
app/static/article.js
```

功能要求：

- 关注用户
- 取消关注
- 粉丝列表
- 关注列表
- 用户主页显示关注状态
- 文章详情页显示关注作者按钮

验收标准：

```text
不能关注自己
重复关注不会产生重复数据
取消关注后状态正确
粉丝数正确
关注数正确
```

---

### 6.3 dl 模块三：私信系统

分支：

```text
feature/dl-private-message
```

负责接口：

```text
GET  /api/messages/conversations
POST /api/messages/conversations
GET  /api/messages/conversations/{id}
GET  /api/messages/conversations/{id}/messages
POST /api/messages/conversations/{id}/messages
```

负责页面：

```text
app/static/messages.html
app/static/messages.js
```

功能要求：

- 会话列表
- 创建私信会话
- 发送私信
- 查看私信记录
- 未读数量

验收标准：

```text
未登录不能发私信
只能查看自己的会话
用户 A/B 的会话不能被用户 C 读取
消息要保存到数据库
未读数正确
```

---

### 6.4 dl 模块四：群聊系统

分支：

```text
feature/dl-group-chat
```

负责接口：

```text
GET    /api/groups
POST   /api/groups
GET    /api/groups/{id}
PUT    /api/groups/{id}
DELETE /api/groups/{id}

GET    /api/groups/{id}/members
POST   /api/groups/{id}/members
DELETE /api/groups/{id}/members/{user_id}

GET    /api/groups/{id}/messages
POST   /api/groups/{id}/messages
```

负责页面：

```text
app/static/groups.html
app/static/groups.js
```

功能要求：

- 创建群
- 查看群列表
- 查看群资料
- 加入群
- 查看群成员
- 发送群消息
- 群主踢人
- 群主解散群

验收标准：

```text
未登录不能创建群
未加入群不能发言
群主可以踢人
普通成员不能踢人
被踢成员不能继续发言
群消息能保存到数据库
```

---

### 6.5 dl 模块五：通知、搜索、推荐

分支：

```text
feature/dl-notification-search-recommend
```

负责接口：

```text
GET  /api/notifications
POST /api/notifications/{id}/read
GET  /api/search
GET  /api/blog/recommendations
```

负责页面：

```text
app/static/blog.js
app/static/messages.js
app/static/space.js
```

功能要求：

- 评论通知
- 关注通知
- 私信通知
- 群聊通知
- 标记已读
- 搜索文章
- 搜索用户
- 热门文章推荐

推荐算法第一版：

```text
score = 浏览量 + 点赞数 * 5 + 收藏数 * 8 + 评论数 * 3
```

验收标准：

```text
有人评论文章后作者收到通知
有人关注后被关注者收到通知
有人私信后接收者有未读提醒
搜索能查文章标题、标签、作者
推荐榜按热度排序
```

---

## 7. 三人开发顺序

### 第一阶段：基础能力

| 顺序 | 成员 | 分支 | 内容 |
|---|---|---|---|
| 1 | z3 | `feature/z3-db-foundation` | 数据库基础、迁移设计、权限模型 |
| 2 | grand | `feature/grand-user-auth` | 普通用户注册登录 |
| 3 | grand | `feature/grand-user-profile` | 用户主页和资料 |

### 第二阶段：文章闭环

| 顺序 | 成员 | 分支 | 内容 |
|---|---|---|---|
| 4 | grand | `feature/grand-blog-core` | 文章列表、详情、发布、编辑 |
| 5 | grand | `feature/grand-blog-editor` | Markdown 编辑器、图片上传 |
| 6 | z3 | `feature/z3-legacy-compat` | 检查旧功能兼容 |

### 第三阶段：互动能力

| 顺序 | 成员 | 分支 | 内容 |
|---|---|---|---|
| 7 | dl | `feature/dl-comments-interactions` | 评论、点赞、收藏 |
| 8 | dl | `feature/dl-follow-system` | 关注、粉丝 |
| 9 | dl | `feature/dl-notification-search-recommend` | 通知、搜索、推荐 |

### 第四阶段：沟通能力

| 顺序 | 成员 | 分支 | 内容 |
|---|---|---|---|
| 10 | dl | `feature/dl-private-message` | 私信 |
| 11 | dl | `feature/dl-group-chat` | 群聊 |
| 12 | z3 | `feature/z3-security-review` | 安全检查 |

### 第五阶段：上线前整合

| 顺序 | 成员 | 内容 |
|---|---|---|
| 13 | z3 | 合并所有 PR |
| 14 | z3 | 结合 VPS 缓存做数据迁移测试 |
| 15 | z3 | 全功能回归测试 |
| 16 | z3 | 部署方案确认 |

---

## 8. 每个人不能碰的区域

### grand 不建议直接改

```text
/api/admin/*
/api/recruit/*
/api/chat
RAG 相关逻辑
VPS 迁移脚本
```

除非提前和 z3 确认。

### dl 不建议直接改

```text
/api/admin/*
/api/recruit/*
/api/chat
文章核心表结构
用户密码逻辑
VPS 迁移脚本
```

除非提前和 z3 确认。

### z3 负责最终整合

z3 可以改所有模块，但应尽量避免在别人正在开发的分支中直接改同一文件，防止冲突。

---

## 9. 数据库表由谁负责

| 表/数据 | 负责人 |
|---|---|
| `admin_users` | z3 |
| `community_users` | grand |
| `community_sessions` | grand |
| `blog_articles` | grand |
| `blog_article_tags` | grand |
| `blog_article_versions` | grand |
| `blog_comments` | dl |
| `blog_likes` | dl |
| `blog_favorites` | dl |
| `social_follows` | dl |
| `private_conversations` | dl |
| `private_messages` | dl |
| `chat_groups` | dl |
| `chat_group_members` | dl |
| `chat_group_messages` | dl |
| `notifications` | dl |
| 旧 JSON 迁移 | z3 |
| RAG 索引迁移 | z3 |

---

## 10. PR 自检清单

每个成员提交 PR 前必须确认：

```text
[ ] 没有提交 .env
[ ] 没有提交数据库文件
[ ] 没有提交 storage/uploads
[ ] 没有提交密码、密钥、Token
[ ] 没有破坏原官网页面
[ ] 没有破坏管理员后台
[ ] 新增接口有权限校验
[ ] 新增上传接口有安全检查
[ ] 新增 JS 已通过 node --check
[ ] Go 代码已 gofmt
[ ] go test ./... 通过
[ ] go build ./cmd/flyteam-server 通过
```

---

## 11. z3 合并前最终检查

z3 每次合并 PR 前执行：

```bash
git checkout main
git pull origin main
git checkout 待审核分支

gofmt -w cmd/flyteam-server
go test ./...
go vet ./...
go build ./cmd/flyteam-server
node --check app/static/public.js
node --check app/static/news.js
node --check app/static/app.js
```

如果新增了页面：

```bash
node --check app/static/blog.js
node --check app/static/article.js
node --check app/static/creator.js
node --check app/static/editor.js
node --check app/static/space.js
node --check app/static/messages.js
node --check app/static/groups.js
```

还要人工测试：

```text
首页是否正常
管理员是否能登录
新闻是否能增删改
回顾是否能增删改
奖项是否能增删改
前辈墙是否能增删改
报名是否能提交
RAG 是否还能问答
普通用户是否能注册登录
文章是否能发布阅读
评论点赞关注是否正常
私信群聊是否权限正确
```

---

## 12. 当前建议

建议先按这个顺序开工：

```text
z3：feature/z3-db-foundation
grand：feature/grand-user-auth
dl：先看 BLOG_COMMUNITY_ROADMAP.md，等 user/auth 基础稳定后开始 feature/dl-comments-interactions
```

原因：

```text
用户系统是文章、评论、关注、私信、群聊的前置依赖。
数据库结构是所有功能的基础。
评论和互动需要等文章接口稳定后再接入。
```