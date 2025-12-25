// V1: just make the pages show something.
// Later we will connect to Supabase.

function $(id){ return document.getElementById(id); }

function formatCountdown(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return `${days} gün ${hours} saat ${mins} dk`;
}

function setDonut(el, percent){
  const p = Math.max(0, Math.min(100, percent));
  const deg = Math.round(p * 3.6);
  el.style.background = `conic-gradient(#111 ${deg}deg, #eee ${deg}deg)`;
  const span = el.querySelector("span");
  if (span) span.textContent = `%${p}`;
}

// Countdown (YKS default date: 20 June 2026)
(function initCountdown(){
  const cd = $("countdown");
  if (!cd) return;
  const target = new Date("2026-06-20T09:00:00+03:00"); // Istanbul time assumption
  const tick = () => {
    cd.textContent = formatCountdown(target.getTime() - Date.now());
  };
  tick();
  setInterval(tick, 1000);
})();

// Fake dashboard numbers for now
(function initDashboard(){
  if (!$("tytCourses")) return;

  const tyt = [
    ["TYT Türkçe", 0, 0],
    ["TYT Matematik", 0, 0],
    ["TYT Geometri", 0, 0],
    ["TYT Tarih", 0, 0],
    ["TYT Coğrafya", 0, 0],
    ["TYT Felsefe", 0, 0],
    ["TYT Fizik", 0, 0],
    ["TYT Kimya", 0, 0],
    ["TYT Biyoloji", 0, 0],
  ];
  const ayt = [
    ["AYT Matematik", 0, 0],
    ["AYT Geometri", 0, 0],
    ["AYT Edebiyat", 0, 0],
    ["AYT Tarih-1", 0, 0],
    ["AYT Coğrafya-1", 0, 0],
  ];

  const renderList = (el, rows) => {
    el.innerHTML = "";
    rows.forEach(([name, done, total]) => {
      const percent = total ? Math.round((done/total)*100) : 0;
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<b>${name}</b><span>%${percent} (${done}/${total})</span>`;
      el.appendChild(div);
    });
  };

  renderList($("tytCourses"), tyt);
  renderList($("aytCourses"), ayt);

  $("tytOverall").textContent = "%0";
  $("aytOverall").textContent = "%0";
  $("tytOverallMeta").textContent = "0 / 0 konu";
  $("aytOverallMeta").textContent = "0 / 0 konu";

  setDonut($("donutToday"), 0);
  setDonut($("donutWeek"), 0);
  $("todayMeta").textContent = "0 / 0 görev";
  $("weekMeta").textContent = "0 / 0 görev";
})();

// Weekly placeholder
(function initWeekly(){
  const board = $("weeklyBoard");
  if (!board) return;

  const days = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
  board.innerHTML = "";
  days.forEach(d => {
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<h3>${d}</h3><div class="muted">Henüz görev yok.</div>`;
    board.appendChild(box);
  });
})();

// Admin placeholder login (local only)
(function initAdmin(){
  const btn = $("btnAdminLogin");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const pin = $("adminPin").value.trim();
    if (pin === "1234") { // temporary; later we use Supabase Auth
      $("adminArea").classList.remove("hidden");
    } else {
      alert("Erişim reddedildi.");
    }
  });
})();
