package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Config struct {
	BaseDir               string
	StorageDir            string
	UploadDir             string
	StaticDir             string
	ImageUploadDir        string
	AwardUploadDir        string
	SeniorUploadDir       string
	ReviewUploadDir       string
	NewsUploadDir         string
	RagIndexFile          string
	TeamContentFile       string
	RecruitContentFile    string
	IngestIndexFile       string
	AdminUsersFile        string
	DefaultDataFiles      []string
	OpenAIAPIKey          string
	OpenAIBaseURL         string
	EmbeddingModel        string
	ChatModel             string
	EmbeddingBatchSize    int
	RetrievalMinRelevance float64
	AdminToken            string
	AdminPassword         string
	AdminSessionHours     int
	AdminCookieSecure     bool
	MaxUploadFiles        int
	MaxImageUploadBytes   int64
	MaxPDFUploadBytes     int64
	ListenAddr            string
}

type Server struct {
	cfg       Config
	rag       *RagService
	sessions  map[string]AdminSession
	sessMu    sync.Mutex
	rate      map[string][]time.Time
	rateMu    sync.Mutex
	captchas  map[string]CaptchaEntry
	captchaMu sync.Mutex
}

func main() {
	cfg, err := LoadConfig()
	if err != nil {
		log.Fatal(err)
	}
	for _, dir := range []string{cfg.StorageDir, cfg.UploadDir, cfg.ImageUploadDir, cfg.AwardUploadDir, cfg.SeniorUploadDir, cfg.ReviewUploadDir, cfg.NewsUploadDir, filepath.Dir(cfg.RagIndexFile)} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("mkdir %s: %v", dir, err)
		}
	}
	rag := NewRagService(cfg)
	s := &Server{
		cfg:      cfg,
		rag:      rag,
		sessions: map[string]AdminSession{},
		rate:     map[string][]time.Time{},
		captchas: map[string]CaptchaEntry{},
	}
	log.Printf("Flyteam Go server listening on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, s); err != nil {
		log.Fatal(err)
	}
}

func LoadConfig() (Config, error) {
	base, err := os.Getwd()
	if err != nil {
		return Config{}, err
	}
	loadDotEnv(filepath.Join(base, ".env"))
	atoi := func(key string, def int) int {
		v := strings.TrimSpace(os.Getenv(key))
		if v == "" {
			return def
		}
		n, err := strconv.Atoi(v)
		if err != nil {
			return def
		}
		return n
	}
	atof := func(key string, def float64) float64 {
		v := strings.TrimSpace(os.Getenv(key))
		if v == "" {
			return def
		}
		n, err := strconv.ParseFloat(v, 64)
		if err != nil {
			return def
		}
		return n
	}
	truthy := func(key string) bool {
		v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
		return v == "1" || v == "true" || v == "yes" || v == "on"
	}
	storage := filepath.Join(base, "storage")
	upload := filepath.Join(storage, "uploads")
	apiKey := os.Getenv("DASHSCOPE_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}
	maxImgMB := atoi("MAX_IMAGE_UPLOAD_MB", 8)
	maxPDFMB := atoi("MAX_PDF_UPLOAD_MB", 25)
	return Config{
		BaseDir:               base,
		StorageDir:            storage,
		UploadDir:             upload,
		StaticDir:             filepath.Join(base, "app", "static"),
		ImageUploadDir:        filepath.Join(upload, "images"),
		AwardUploadDir:        filepath.Join(upload, "awards"),
		SeniorUploadDir:       filepath.Join(upload, "seniors"),
		ReviewUploadDir:       filepath.Join(upload, "review"),
		NewsUploadDir:         filepath.Join(upload, "news"),
		RagIndexFile:          filepath.Join(storage, "rag_index_go.json"),
		TeamContentFile:       filepath.Join(storage, "team_content.json"),
		RecruitContentFile:    filepath.Join(storage, "recruit_applications.json"),
		IngestIndexFile:       filepath.Join(storage, "ingest_index.json"),
		AdminUsersFile:        filepath.Join(storage, "admin_users.json"),
		DefaultDataFiles:      []string{filepath.Join(upload, "flyteam_knowledge.pdf")},
		OpenAIAPIKey:          apiKey,
		OpenAIBaseURL:         getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
		EmbeddingModel:        getenv("EMBEDDING_MODEL", "text-embedding-v4"),
		ChatModel:             getenv("CHAT_MODEL", "qwen-plus"),
		EmbeddingBatchSize:    atoi("EMBEDDING_BATCH_SIZE", 10),
		RetrievalMinRelevance: atof("RETRIEVAL_MIN_RELEVANCE", 0.08),
		AdminToken:            os.Getenv("ADMIN_TOKEN"),
		AdminPassword:         os.Getenv("ADMIN_PASSWORD"),
		AdminSessionHours:     atoi("ADMIN_SESSION_HOURS", 8),
		AdminCookieSecure:     truthy("ADMIN_COOKIE_SECURE"),
		MaxUploadFiles:        atoi("MAX_UPLOAD_FILES", 20),
		MaxImageUploadBytes:   int64(max(1, maxImgMB)) * 1024 * 1024,
		MaxPDFUploadBytes:     int64(max(1, maxPDFMB)) * 1024 * 1024,
		ListenAddr:            ":" + getenv("PORT", "8000"),
	}, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func loadDotEnv(path string) {
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	text := strings.TrimPrefix(string(b), "\ufeff")
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		val = strings.Trim(val, "\"'")
		if key != "" {
			_ = os.Setenv(key, val)
		}
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("panic: %v", rec)
			writeError(w, http.StatusInternalServerError, "Internal server error.")
		}
	}()
	s.setSecurityHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	path := cleanPath(r.URL.Path)
	if path == "/static/admin.html" || path == "/static/app.js" {
		if _, ok := s.adminFromRequest(r); !ok {
			if wantsJSON(r) {
				writeError(w, http.StatusUnauthorized, "Admin login required.")
			} else {
				http.Redirect(w, r, "/login", http.StatusFound)
			}
			return
		}
	}
	if isMutating(r.Method) && s.requiresAdminCSRF(path) {
		if err := s.checkCSRF(r); err != nil {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
	}

	s.route(w, r, path)
}

func (s *Server) route(w http.ResponseWriter, r *http.Request, path string) {
	if strings.HasPrefix(path, "/static/") {
		s.serveFileRoot(w, r, s.cfg.StaticDir, strings.TrimPrefix(path, "/static/"))
		return
	}
	if strings.HasPrefix(path, "/uploads/") {
		s.serveFileRoot(w, r, s.cfg.UploadDir, strings.TrimPrefix(path, "/uploads/"))
		return
	}
	if path == "/" && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "index.html")
		return
	}
	if path == "/login" && r.Method == http.MethodGet {
		s.handleLoginPage(w, r)
		return
	}
	if path == "/admin" && r.Method == http.MethodGet {
		s.handleAdminPage(w, r)
		return
	}
	if path == "/flyteamers" && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "flyteamers.html")
		return
	}
	if path == "/recruit" && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "recruit.html")
		return
	}
	if path == "/news" && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "news.html")
		return
	}
	if path == "/awards" && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "awards.html")
		return
	}
	if path == "/review" && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "review.html")
		return
	}
	if strings.HasPrefix(path, "/review/") && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "review_detail.html")
		return
	}
	if path == "/intro" && r.Method == http.MethodGet {
		s.serveStaticHTML(w, r, "intro.html")
		return
	}

	if !strings.HasPrefix(path, "/api/") {
		http.NotFound(w, r)
		return
	}
	s.routeAPI(w, r, path)
}

func (s *Server) routeAPI(w http.ResponseWriter, r *http.Request, path string) {
	switch {
	case path == "/api/status" && r.Method == http.MethodGet:
		s.handleStatus(w, r)
	case path == "/api/content" && r.Method == http.MethodGet:
		s.handleGetContent(w, r)
	case strings.HasPrefix(path, "/api/news/") && r.Method == http.MethodGet:
		s.handleGetNews(w, r, pathValue(path, "/api/news/"))
	case path == "/api/admin/login" && r.Method == http.MethodPost:
		s.handleAdminLogin(w, r)
	case path == "/api/admin/logout" && r.Method == http.MethodPost:
		s.handleAdminLogout(w, r)
	case path == "/api/admin/ping" && r.Method == http.MethodGet:
		s.handleAdminPing(w, r)
	case path == "/api/admin/users" && r.Method == http.MethodGet:
		s.handleAdminUsers(w, r)
	case path == "/api/admin/users" && r.Method == http.MethodPost:
		s.handleAddAdminUser(w, r)
	case strings.HasPrefix(path, "/api/admin/users/") && strings.HasSuffix(path, "/password") && r.Method == http.MethodPut:
		s.handleUpdateAdminPassword(w, r, strings.TrimSuffix(pathValue(path, "/api/admin/users/"), "/password"))
	case strings.HasPrefix(path, "/api/admin/users/") && strings.HasSuffix(path, "/role") && r.Method == http.MethodPut:
		s.handleUpdateAdminRole(w, r, strings.TrimSuffix(pathValue(path, "/api/admin/users/"), "/role"))
	case strings.HasPrefix(path, "/api/admin/users/") && r.Method == http.MethodDelete:
		s.handleDeleteAdminUser(w, r, pathValue(path, "/api/admin/users/"))
	case path == "/api/awards" && r.Method == http.MethodPost:
		s.handleAddAward(w, r)
	case strings.HasPrefix(path, "/api/awards/") && r.Method == http.MethodPut:
		s.handleUpdateAward(w, r, pathValue(path, "/api/awards/"))
	case strings.HasPrefix(path, "/api/awards/") && r.Method == http.MethodDelete:
		s.handleDeleteAward(w, r, pathValue(path, "/api/awards/"))
	case path == "/api/seniors" && r.Method == http.MethodPost:
		s.handleAddSenior(w, r)
	case strings.HasPrefix(path, "/api/seniors/") && r.Method == http.MethodPut:
		s.handleUpdateSenior(w, r, pathValue(path, "/api/seniors/"))
	case strings.HasPrefix(path, "/api/seniors/") && r.Method == http.MethodDelete:
		s.handleDeleteSenior(w, r, pathValue(path, "/api/seniors/"))
	case path == "/api/news" && r.Method == http.MethodPost:
		s.handleAddNews(w, r)
	case strings.HasPrefix(path, "/api/news/") && r.Method == http.MethodPut:
		s.handleUpdateNews(w, r, pathValue(path, "/api/news/"))
	case strings.HasPrefix(path, "/api/news/") && r.Method == http.MethodDelete:
		s.handleDeleteNews(w, r, pathValue(path, "/api/news/"))
	case path == "/api/content/intro" && r.Method == http.MethodPost:
		s.handleSaveIntro(w, r)
	case path == "/api/content/overview" && r.Method == http.MethodPost:
		s.handleSaveOverview(w, r)
	case strings.HasPrefix(path, "/api/review/albums/") && strings.HasSuffix(path, "/image/delete") && r.Method == http.MethodPost:
		s.handleDeleteReviewAlbumImage(w, r, strings.TrimSuffix(pathValue(path, "/api/review/albums/"), "/image/delete"))
	case strings.HasPrefix(path, "/api/review/albums/") && r.Method == http.MethodGet:
		s.handleGetReviewAlbum(w, r, pathValue(path, "/api/review/albums/"))
	case path == "/api/review/albums" && r.Method == http.MethodPost:
		s.handleAddReviewAlbum(w, r)
	case strings.HasPrefix(path, "/api/review/albums/") && r.Method == http.MethodPut:
		s.handleUpdateReviewAlbum(w, r, pathValue(path, "/api/review/albums/"))
	case strings.HasPrefix(path, "/api/review/albums/") && r.Method == http.MethodDelete:
		s.handleDeleteReviewAlbum(w, r, pathValue(path, "/api/review/albums/"))
	case path == "/api/review" && r.Method == http.MethodPost:
		s.handleAddReview(w, r)
	case strings.HasPrefix(path, "/api/review/") && r.Method == http.MethodPut:
		s.handleUpdateReview(w, r, pathValue(path, "/api/review/"))
	case strings.HasPrefix(path, "/api/review/") && r.Method == http.MethodDelete:
		s.handleDeleteReview(w, r, pathValue(path, "/api/review/"))
	case path == "/api/content/gallery/delete" && r.Method == http.MethodPost:
		s.handleDeleteGallery(w, r)
	case path == "/api/content/review/delete" && r.Method == http.MethodPost:
		s.handleDeleteReviewByURL(w, r)
	case path == "/api/recruit/captcha" && r.Method == http.MethodGet:
		s.handleRecruitCaptcha(w, r)
	case path == "/api/recruit/halls" && r.Method == http.MethodGet:
		s.handleRecruitHalls(w, r)
	case path == "/api/recruit/list" && r.Method == http.MethodGet:
		s.handleRecruitList(w, r)
	case path == "/api/recruit/stats" && r.Method == http.MethodGet:
		s.handleRecruitStats(w, r)
	case path == "/api/recruit/apply" && r.Method == http.MethodPost:
		s.handleRecruitApply(w, r)
	case strings.HasPrefix(path, "/api/recruit/") && r.Method == http.MethodPut:
		s.handleRecruitUpdate(w, r, pathValue(path, "/api/recruit/"))
	case strings.HasPrefix(path, "/api/recruit/") && r.Method == http.MethodDelete:
		s.handleRecruitDelete(w, r, pathValue(path, "/api/recruit/"))
	case path == "/api/ingest/default" && r.Method == http.MethodPost:
		s.handleIngestDefault(w, r)
	case path == "/api/ingest/rebuild/default" && r.Method == http.MethodPost:
		s.handleRebuildDefault(w, r)
	case path == "/api/ingest/local" && r.Method == http.MethodPost:
		s.handleIngestLocal(w, r)
	case path == "/api/upload" && r.Method == http.MethodPost:
		s.handleUploadPDF(w, r)
	case path == "/api/upload/images" && r.Method == http.MethodPost:
		s.handleUploadImages(w, r, s.cfg.ImageUploadDir, "/uploads/images", true)
	case path == "/api/upload/awards/images" && r.Method == http.MethodPost:
		s.handleUploadImages(w, r, s.cfg.AwardUploadDir, "/uploads/awards", false)
	case path == "/api/upload/seniors/images" && r.Method == http.MethodPost:
		s.handleUploadImages(w, r, s.cfg.SeniorUploadDir, "/uploads/seniors", false)
	case path == "/api/upload/review/images" && r.Method == http.MethodPost:
		s.handleUploadImages(w, r, s.cfg.ReviewUploadDir, "/uploads/review", false)
	case path == "/api/upload/news/images" && r.Method == http.MethodPost:
		s.handleUploadImages(w, r, s.cfg.NewsUploadDir, "/uploads/news", false)
	case path == "/api/chat" && r.Method == http.MethodPost:
		s.handleChat(w, r)
	default:
		writeError(w, http.StatusNotFound, "Not found.")
	}
}

func (s *Server) setSecurityHeaders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "SAMEORIGIN")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token, X-CSRF-Token")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
}

func (s *Server) serveStaticHTML(w http.ResponseWriter, r *http.Request, name string) {
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, filepath.Join(s.cfg.StaticDir, name))
}

func (s *Server) serveFileRoot(w http.ResponseWriter, r *http.Request, root, rel string) {
	rel = filepath.Clean(strings.TrimPrefix(rel, "/"))
	if rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		http.NotFound(w, r)
		return
	}
	full := filepath.Join(root, rel)
	if !pathInside(root, full) {
		http.NotFound(w, r)
		return
	}
	if st, err := os.Stat(full); err != nil || st.IsDir() {
		http.NotFound(w, r)
		return
	}
	if ct := mime.TypeByExtension(filepath.Ext(full)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeFile(w, r, full)
}

func (s *Server) handleLoginPage(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.adminFromRequest(r); ok {
		http.Redirect(w, r, "/admin", http.StatusFound)
		return
	}
	s.serveStaticHTML(w, r, "login.html")
}

func (s *Server) handleAdminPage(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.adminFromRequest(r); !ok {
		http.Redirect(w, r, "/login", http.StatusFound)
		return
	}
	s.serveStaticHTML(w, r, "admin.html")
}

func cleanPath(p string) string {
	if p == "" {
		return "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return p
}

func pathValue(path, prefix string) string {
	return strings.Trim(strings.TrimPrefix(path, prefix), "/")
}

func isMutating(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

func wantsJSON(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept"), "application/json") || strings.HasPrefix(r.URL.Path, "/api/")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, map[string]any{"detail": detail})
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	return dec.Decode(dst)
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func randomToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return strings.TrimRight(strings.NewReplacer("+", "-", "/", "_").Replace(hex.EncodeToString(b)), "=")
}

func nowISO() string { return time.Now().UTC().Format(time.RFC3339Nano) }

func writeJSONAtomic(path string, data any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if host == "127.0.0.1" || host == "::1" || host == "localhost" {
		if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
			first := strings.TrimSpace(strings.Split(xf, ",")[0])
			if len(first) >= 3 && len(first) <= 45 {
				return first
			}
		}
	}
	if host == "" {
		return "unknown"
	}
	return host
}

func (s *Server) checkRateLimit(key string, limit int, window time.Duration, consume bool) bool {
	s.rateMu.Lock()
	defer s.rateMu.Unlock()
	now := time.Now()
	cut := now.Add(-window)
	bucket := s.rate[key]
	out := bucket[:0]
	for _, t := range bucket {
		if t.After(cut) {
			out = append(out, t)
		}
	}
	bucket = out
	if len(bucket) >= limit {
		s.rate[key] = bucket
		return false
	}
	if consume {
		bucket = append(bucket, now)
	}
	s.rate[key] = bucket
	return true
}

func (s *Server) clearRateLimit(key string) {
	s.rateMu.Lock()
	defer s.rateMu.Unlock()
	delete(s.rate, key)
}

func (s *Server) requiresAdminCSRF(path string) bool {
	if path == "/api/admin/login" {
		return false
	}
	if strings.HasPrefix(path, "/api/recruit/") && path != "/api/recruit/apply" {
		return true
	}
	for _, p := range []string{"/api/admin", "/api/awards", "/api/seniors", "/api/news", "/api/review", "/api/content", "/api/ingest", "/api/upload"} {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

func (s *Server) checkCSRF(r *http.Request) error {
	cookie, err := r.Cookie("admin_session")
	if err != nil || cookie.Value == "" || r.Header.Get("X-Admin-Token") != "" {
		return nil
	}
	admin, ok := s.adminFromToken(cookie.Value)
	if !ok {
		return nil
	}
	if admin.CSRFToken == "" || r.Header.Get("X-CSRF-Token") != admin.CSRFToken {
		return errors.New("CSRF token missing or invalid.")
	}
	return nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func pathInside(root, target string) bool {
	rootAbs, err1 := filepath.Abs(root)
	targetAbs, err2 := filepath.Abs(target)
	if err1 != nil || err2 != nil {
		return false
	}
	rel, err := filepath.Rel(rootAbs, targetAbs)
	if err != nil {
		return false
	}
	return rel == "." || (rel != "" && !strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel))
}

func validHall(h string) string {
	switch h {
	case "binary", "web", "dev", "management":
		return h
	}
	return "binary"
}

func requireFields(ok bool, msg string) error {
	if !ok {
		return errors.New(msg)
	}
	return nil
}

func fatalIf(err error) {
	if err != nil {
		panic(fmt.Sprintf("%v", err))
	}
}
