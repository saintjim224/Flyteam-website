package main

import (
	"net/http"
	"strings"
)

// ReservedCommunityEndpoint documents API surfaces reserved for the planned
// CSDN-like blog/community expansion. These handlers intentionally return 501
// until the corresponding feature branch implements storage, authentication,
// permissions, and tests.
type ReservedCommunityEndpoint struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Module      string `json:"module"`
	Phase       string `json:"phase"`
	Auth        string `json:"auth"`
	Summary     string `json:"summary"`
	Implemented bool   `json:"implemented"`
}

var reservedCommunityEndpoints = []ReservedCommunityEndpoint{
	{Method: http.MethodPost, Path: "/api/users/register", Module: "user-auth", Phase: "phase-1", Auth: "guest", Summary: "普通用户注册：昵称、用户 ID、密码。"},
	{Method: http.MethodPost, Path: "/api/users/login", Module: "user-auth", Phase: "phase-1", Auth: "guest", Summary: "普通用户登录，签发用户会话。"},
	{Method: http.MethodPost, Path: "/api/users/logout", Module: "user-auth", Phase: "phase-1", Auth: "user", Summary: "普通用户退出登录，清理会话。"},
	{Method: http.MethodGet, Path: "/api/users/me", Module: "user-auth", Phase: "phase-1", Auth: "user", Summary: "获取当前普通用户资料、权限和统计。"},
	{Method: http.MethodGet, Path: "/api/users/{id}", Module: "user-profile", Phase: "phase-1", Auth: "guest", Summary: "公开用户主页资料。"},
	{Method: http.MethodPut, Path: "/api/users/{id}", Module: "user-profile", Phase: "phase-1", Auth: "owner/admin", Summary: "编辑用户资料，限制只能本人或管理员操作。"},

	{Method: http.MethodGet, Path: "/api/blog/articles", Module: "blog-core", Phase: "phase-2", Auth: "guest", Summary: "文章列表，支持分页、搜索、标签、排序、推荐。"},
	{Method: http.MethodPost, Path: "/api/blog/articles", Module: "blog-core", Phase: "phase-2", Auth: "user", Summary: "创建文章草稿/发布文章，支持标题、正文、语言、标签、封面。"},
	{Method: http.MethodGet, Path: "/api/blog/articles/{id}", Module: "blog-core", Phase: "phase-2", Auth: "guest", Summary: "文章详情；未登录只能阅读公开文章。"},
	{Method: http.MethodPut, Path: "/api/blog/articles/{id}", Module: "blog-core", Phase: "phase-2", Auth: "owner/admin", Summary: "编辑文章，保留历史版本。"},
	{Method: http.MethodDelete, Path: "/api/blog/articles/{id}", Module: "blog-core", Phase: "phase-2", Auth: "owner/admin", Summary: "删除/软删除文章。"},
	{Method: http.MethodPost, Path: "/api/blog/articles/{id}/publish", Module: "blog-core", Phase: "phase-2", Auth: "owner/admin", Summary: "草稿发布或重新发布。"},
	{Method: http.MethodPost, Path: "/api/blog/articles/{id}/view", Module: "blog-recommendation", Phase: "phase-2", Auth: "guest", Summary: "记录文章浏览，用于热度和推荐计算。"},
	{Method: http.MethodPost, Path: "/api/blog/articles/{id}/like", Module: "blog-interaction", Phase: "phase-2", Auth: "user", Summary: "点赞文章。"},
	{Method: http.MethodDelete, Path: "/api/blog/articles/{id}/like", Module: "blog-interaction", Phase: "phase-2", Auth: "user", Summary: "取消点赞文章。"},
	{Method: http.MethodPost, Path: "/api/blog/articles/{id}/favorite", Module: "blog-interaction", Phase: "phase-2", Auth: "user", Summary: "收藏文章。"},
	{Method: http.MethodDelete, Path: "/api/blog/articles/{id}/favorite", Module: "blog-interaction", Phase: "phase-2", Auth: "user", Summary: "取消收藏文章。"},
	{Method: http.MethodGet, Path: "/api/blog/articles/{id}/comments", Module: "blog-comment", Phase: "phase-2", Auth: "guest", Summary: "查看文章评论。"},
	{Method: http.MethodPost, Path: "/api/blog/articles/{id}/comments", Module: "blog-comment", Phase: "phase-2", Auth: "user", Summary: "发表评论；未登录不能评论。"},
	{Method: http.MethodPut, Path: "/api/blog/comments/{id}", Module: "blog-comment", Phase: "phase-2", Auth: "owner/admin", Summary: "编辑评论。"},
	{Method: http.MethodDelete, Path: "/api/blog/comments/{id}", Module: "blog-comment", Phase: "phase-2", Auth: "owner/admin", Summary: "删除评论。"},
	{Method: http.MethodGet, Path: "/api/blog/recommendations", Module: "blog-recommendation", Phase: "phase-2", Auth: "guest", Summary: "推荐文章：按浏览量、点赞、收藏、时间衰减综合排序。"},
	{Method: http.MethodPost, Path: "/api/upload/blog/images", Module: "blog-editor", Phase: "phase-2", Auth: "user", Summary: "博客正文图片上传；需要复用现有上传安全检查。"},

	{Method: http.MethodPost, Path: "/api/social/follows/{id}", Module: "social-follow", Phase: "phase-3", Auth: "user", Summary: "关注用户。"},
	{Method: http.MethodDelete, Path: "/api/social/follows/{id}", Module: "social-follow", Phase: "phase-3", Auth: "user", Summary: "取消关注用户。"},
	{Method: http.MethodGet, Path: "/api/social/following/{id}", Module: "social-follow", Phase: "phase-3", Auth: "guest", Summary: "查看某用户关注列表。"},
	{Method: http.MethodGet, Path: "/api/social/followers/{id}", Module: "social-follow", Phase: "phase-3", Auth: "guest", Summary: "查看某用户粉丝列表。"},

	{Method: http.MethodGet, Path: "/api/messages/conversations", Module: "private-message", Phase: "phase-3", Auth: "user", Summary: "私信会话列表。"},
	{Method: http.MethodPost, Path: "/api/messages/conversations", Module: "private-message", Phase: "phase-3", Auth: "user", Summary: "创建或打开私信会话。"},
	{Method: http.MethodGet, Path: "/api/messages/conversations/{id}", Module: "private-message", Phase: "phase-3", Auth: "participant", Summary: "私信会话详情。"},
	{Method: http.MethodGet, Path: "/api/messages/conversations/{id}/messages", Module: "private-message", Phase: "phase-3", Auth: "participant", Summary: "私信消息列表，支持游标分页。"},
	{Method: http.MethodPost, Path: "/api/messages/conversations/{id}/messages", Module: "private-message", Phase: "phase-3", Auth: "participant", Summary: "发送私信消息。"},

	{Method: http.MethodGet, Path: "/api/groups", Module: "group-chat", Phase: "phase-4", Auth: "guest", Summary: "群聊/社区列表。"},
	{Method: http.MethodPost, Path: "/api/groups", Module: "group-chat", Phase: "phase-4", Auth: "user", Summary: "创建群聊。"},
	{Method: http.MethodGet, Path: "/api/groups/{id}", Module: "group-chat", Phase: "phase-4", Auth: "guest", Summary: "群聊公开信息。"},
	{Method: http.MethodPut, Path: "/api/groups/{id}", Module: "group-chat", Phase: "phase-4", Auth: "owner/admin", Summary: "编辑群聊资料。"},
	{Method: http.MethodDelete, Path: "/api/groups/{id}", Module: "group-chat", Phase: "phase-4", Auth: "owner/admin", Summary: "解散群聊。"},
	{Method: http.MethodGet, Path: "/api/groups/{id}/members", Module: "group-chat", Phase: "phase-4", Auth: "member", Summary: "群成员列表。"},
	{Method: http.MethodPost, Path: "/api/groups/{id}/members", Module: "group-chat", Phase: "phase-4", Auth: "member/admin", Summary: "邀请/申请加入群聊。"},
	{Method: http.MethodDelete, Path: "/api/groups/{id}/members/{user_id}", Module: "group-chat", Phase: "phase-4", Auth: "owner/admin", Summary: "移除群成员。"},
	{Method: http.MethodGet, Path: "/api/groups/{id}/messages", Module: "group-chat", Phase: "phase-4", Auth: "member", Summary: "群消息列表。"},
	{Method: http.MethodPost, Path: "/api/groups/{id}/messages", Module: "group-chat", Phase: "phase-4", Auth: "member", Summary: "发送群消息。"},

	{Method: http.MethodGet, Path: "/api/notifications", Module: "notification", Phase: "phase-5", Auth: "user", Summary: "站内通知列表。"},
	{Method: http.MethodPost, Path: "/api/notifications/{id}/read", Module: "notification", Phase: "phase-5", Auth: "user", Summary: "标记通知已读。"},
	{Method: http.MethodGet, Path: "/api/search", Module: "search", Phase: "phase-5", Auth: "guest", Summary: "全站搜索：文章、用户、标签。"},
}

func (s *Server) routeCommunityAPI(w http.ResponseWriter, r *http.Request, path string) bool {
	if path == "/api/community/status" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed.")
			return true
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"implemented": false,
			"docs":        "BLOG_COMMUNITY_ROADMAP.md",
			"endpoints":   reservedCommunityEndpoints,
		})
		return true
	}

	matchedMethod := false
	for _, ep := range reservedCommunityEndpoints {
		if !apiPatternMatch(ep.Path, path) {
			continue
		}
		if ep.Method != r.Method {
			matchedMethod = true
			continue
		}
		writeJSON(w, http.StatusNotImplemented, map[string]any{
			"detail":      "This community/blog API is reserved but not implemented yet.",
			"implemented": false,
			"docs":        "BLOG_COMMUNITY_ROADMAP.md",
			"endpoint":    ep,
		})
		return true
	}
	if matchedMethod {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed.")
		return true
	}
	return false
}

func apiPatternMatch(pattern, path string) bool {
	pp := strings.Split(strings.Trim(pattern, "/"), "/")
	pa := strings.Split(strings.Trim(path, "/"), "/")
	if len(pp) != len(pa) {
		return false
	}
	for i := range pp {
		if strings.HasPrefix(pp[i], "{") && strings.HasSuffix(pp[i], "}") {
			if strings.TrimSpace(pa[i]) == "" {
				return false
			}
			continue
		}
		if pp[i] != pa[i] {
			return false
		}
	}
	return true
}
