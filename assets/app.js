function $(id){ return document.getElementById(id); }

// 1) Supabase client (CDN provides global `supabase`)
const SUPABASE_URL = "https://bexcwoukvbwtrllspdmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJleGN3b3VrdmJ3dHJsbHNwZG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODAwNjIsImV4cCI6MjA4MjI1NjA2Mn0.yxCSboNQ2Y4tbe8RO4pt3HjM1-reC9TToOVzZ66LIms"; // <-- paste anon key here

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helpers
function isLoginPage(){
  return location.pathname.endsWith("/giris.html") || location.pathname.endsWith("giris.html");
}
function redirectToLogin(){
  const next = encodeURIComponent(location.href);
  location.href = `giris.html?next=${next}`;
}
function getNextFromQuery(){
  const params = new URLSearchParams(location.search);
  return params.get("next");
}

// 2) AUTH GUARD: require login for all pages except giris.html
(async function authGuard(){
  const { data: { session } } = await sb.auth.getSession();

  if (!session && !isLoginPage()) {
    redirectToLogin();
    return;
  }

  // If we are on login page and already logged in -> go to next/home
  if (session && isLoginPage()) {
    const next = getNextFromQuery();
    location.href = next ? next : "index.html";
    return;
  }

  // On admin page: later we’ll enforce admin role. For now just require login.
})();

// 3) LOGIN PAGE LOGIC
(function initLogin(){
  if (!isLoginPage()) return;

  const btn = $("btnLogin");
  const msg = $("msg");

  btn.addEventListener("click", async () => {
    msg.textContent = "Giriş yapılıyor...";

    const email = $("email").value.trim();
    const password = $("password").value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      msg.textContent = "Giriş başarısız: " + error.message;
      return;
    }

    const next = getNextFromQuery();
    location.href = next ? next : "index.html";
  });
})();

// 4) Keep your countdown on the dashboard (works after login)
function formatCountdown(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return `${days} gün ${hours} saat ${mins} dk`;
}

(function initCountdown(){
  const cd = $("countdown");
  if (!cd) return;
  const target = new Date("2026-06-20T09:00:00+03:00");
  const tick = () => { cd.textContent = formatCountdown(target.getTime() - Date.now()); };
  tick();
  setInterval(tick, 1000);
})();

