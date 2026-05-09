const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");

if (form && msg) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    msg.textContent = "登录中...";
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "登录失败");
      localStorage.removeItem("flyteam_admin_token");
      sessionStorage.setItem("flyteam_admin_csrf", data.csrf_token || "");
      localStorage.setItem("flyteam_admin_last_active_at", String(Date.now()));
      window.location.href = "/admin";
    } catch (err) {
      msg.textContent = err.message || "登录失败";
    }
  });
}
