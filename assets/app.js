function $(id){ return document.getElementById(id); }

// 1) Supabase client (CDN provides global `supabase`)
const SUPABASE_URL = "https://bexcwoukvbwtrllspdmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJleGN3b3VrdmJ3dHJsbHNwZG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODAwNjIsImV4cCI6MjA4MjI1NjA2Mn0.yxCSboNQ2Y4tbe8RO4pt3HjM1-reC9TToOVzZ66LIms"; // <-- paste anon key here


const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Page helpers
function isLoginPage(){ return location.pathname.endsWith("giris.html"); }
function isAdminPage(){ return location.pathname.endsWith("admin.html"); }
function goLogin(){
  const next = encodeURIComponent(location.href);
  location.href = `giris.html?next=${next}`;
}
function getNextFromQuery(){
  const params = new URLSearchParams(location.search);
  return params.get("next");
}

// Navbar auth button (injected on all pages that have .nav)
function renderNavAuthButton(session){
  const nav = document.querySelector(".nav");
  if (!nav) return;

  // remove existing
  const old = document.getElementById("navAuthBtn");
  if (old) old.remove();

  const btn = document.createElement("button");
  btn.id = "navAuthBtn";
  btn.style.marginLeft = "auto";
  btn.style.padding = "10px 14px";
  btn.style.borderRadius = "12px";
  btn.style.cursor = "pointer";

  if (session){
    btn.textContent = "Çıkış Yap";
    btn.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.href = "index.html";
    });
  } else {
    btn.textContent = "Giriş Yap";
    btn.addEventListener("click", () => goLogin());
  }

  nav.appendChild(btn);
}

// Dates
function toISODate(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function getWeekRange(base = new Date()){
  const d = new Date(base);
  d.setHours(0,0,0,0);
  const mondayOffset = (d.getDay() + 6) % 7;
  const monday = new Date(d); monday.setDate(d.getDate() - mondayOffset);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}
const TR_DAYS = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
function fmtDayTitle(dateObj){
  const dd = String(dateObj.getDate()).padStart(2,"0");
  const mm = String(dateObj.getMonth()+1).padStart(2,"0");
  return `${TR_DAYS[dateObj.getDay()]} (${dd}.${mm})`;
}

// Donut
function setDonut(el, percent, label){
  if (!el) return;
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const deg = Math.round(p * 3.6);
  el.style.background = `conic-gradient(var(--accent) ${deg}deg, rgba(255,255,255,0.10) ${deg}deg)`;
  const span = el.querySelector("span");
  if (span) span.textContent = (label ?? `%${p}`);
}

// Countdown
function formatCountdown(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return `${days} gün ${hours} saat ${mins} dk`;
}
function initCountdown(){
  const cd = $("countdown");
  if (!cd) return;
  const target = new Date("2026-06-20T09:00:00+03:00");
  const tick = () => { cd.textContent = formatCountdown(target.getTime() - Date.now()); };
  tick();
  setInterval(tick, 1000);
}

// Settings: time slots
async function getTimeSlots(){
  const fallback = [
    "08:00-09:00","09:00-10:00","10:00-11:00","11:00-12:00",
    "13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00",
    "18:00-19:00","19:00-20:00","20:00-21:00","21:00-22:00",
  ];

  const { data, error } = await sb
    .from("app_settings")
    .select("value")
    .eq("key","time_slots")
    .single();

  if (error || !data || !data.value || !Array.isArray(data.value.slots)) return fallback;
  return data.value.slots;
}
function parseStartTime(slotLabel){
  const p = slotLabel.split("-")[0].trim();
  return p.length === 5 ? p : p.slice(0,5);
}
function buildWeekDates(monday){
  const dates = [];
  for (let i=0;i<7;i++){
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    dates.push({ iso: toISODate(d), obj: d });
  }
  return dates;
}

// Fetchers (public-readable now)
async function fetchTopics(exam){
  const { data, error } = await sb
    .from("topics")
    .select("id, exam, course, name, sort_order")
    .eq("exam", exam)
    .order("course", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function fetchWeeklyTasks(startISO, endISO){
  const { data, error } = await sb
    .from("weekly_tasks")
    .select("id, task_date, start_time, exam, course, topic, task_type, duration_min")
    .gte("task_date", startISO)
    .lte("task_date", endISO)
    .order("task_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Completion (requires login; only call when session exists)
async function fetchTopicCompletion(){
  const { data, error } = await sb.from("topic_completion").select("topic_id, done");
  if (error) throw error;
  const map = new Map();
  (data || []).forEach(r => map.set(r.topic_id, !!r.done));
  return map;
}
async function upsertTopicDone(userId, topicId, done){
  const { error } = await sb
    .from("topic_completion")
    .upsert({ user_id: userId, topic_id: topicId, done }, { onConflict: "user_id,topic_id" });
  if (error) throw error;
}
async function fetchTaskCompletion(){
  const { data, error } = await sb.from("task_completion").select("task_id, done");
  if (error) throw error;
  const map = new Map();
  (data || []).forEach(r => map.set(r.task_id, !!r.done));
  return map;
}
async function upsertTaskDone(userId, taskId, done){
  const { error } = await sb
    .from("task_completion")
    .upsert({ user_id: userId, task_id: taskId, done }, { onConflict: "user_id,task_id" });
  if (error) throw error;
}

// Topics render (guest sees list; signed-in can tick)
function groupByCourse(topics){
  const m = new Map();
  topics.forEach(t => {
    if (!m.has(t.course)) m.set(t.course, []);
    m.get(t.course).push(t);
  });
  return m;
}
function updateCourseSummary(detailsEl){
  const boxes = detailsEl.querySelectorAll('input[type="checkbox"]');
  const total = boxes.length;
  let done = 0;
  boxes.forEach(b => { if (b.checked) done++; });
  const percent = total ? Math.round((done/total)*100) : 0;
  const sum = detailsEl.querySelector("summary span");
  if (sum) sum.textContent = `%${percent} (${done}/${total})`;
}

async function renderTopicsPage(session, exam, containerId){
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = `<p class="muted">Yükleniyor...</p>`;
  const topics = await fetchTopics(exam);

  if (topics.length === 0){
    container.innerHTML = `<p class="muted">Henüz konu eklenmedi.</p>`;
    return;
  }

  const completionMap = session ? await fetchTopicCompletion() : new Map();
  const byCourse = groupByCourse(topics);

  container.innerHTML = "";
  for (const [courseName, list] of byCourse.entries()){
    const details = document.createElement("details");
    details.className = "course";
    details.open = false; // collapsed by default

    const summary = document.createElement("summary");
    summary.innerHTML = `<b>${courseName}</b> <span>%0 (0/0)</span>`;
    details.appendChild(summary);

    const topicsDiv = document.createElement("div");
    topicsDiv.className = "topics";

    list.forEach(t => {
      const done = session ? (completionMap.get(t.id) === true) : false;

      const label = document.createElement("label");
      label.className = "check" + (done ? " done" : "");
      label.innerHTML = `<span class="topicText">${t.name}</span><input type="checkbox" ${done ? "checked" : ""} />`;

      const cb = label.querySelector("input");

      if (!session){
        cb.disabled = true;
        label.addEventListener("click", () => goLogin());
      } else {
        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try {
            await upsertTopicDone(session.user.id, t.id, cb.checked);
            label.classList.toggle("done", cb.checked);
            updateCourseSummary(details);
          } catch (e) {
            alert("Kaydedilemedi: " + e.message);
            cb.checked = !cb.checked;
          } finally {
            cb.disabled = false;
          }
        });
      }

      topicsDiv.appendChild(label);
    });

    details.appendChild(topicsDiv);
    container.appendChild(details);
    if (session) updateCourseSummary(details);
    else summary.querySelector("span").textContent = `Toplam: ${list.length} konu`;
  }
}

// Weekly grid render (guest sees plan; signed-in can tick)
async function renderWeeklyGrid(session){
  const wrap = $("weeklyGrid");
  if (!wrap) return;

  const { monday, sunday } = getWeekRange(new Date());
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);

  wrap.innerHTML = `<p class="muted">Yükleniyor...</p>`;

  const [slotLabels, tasks] = await Promise.all([
    getTimeSlots(),
    fetchWeeklyTasks(startISO, endISO),
  ]);

  const doneMap = session ? await fetchTaskCompletion() : new Map();

  // map cell -> task
  const cellMap = new Map();
  tasks.forEach(t => {
    if (!t.start_time) return;
    const time = String(t.start_time).slice(0,5);
    cellMap.set(`${t.task_date}|${time}`, t);
  });

  const dates = buildWeekDates(monday);

  const table = document.createElement("table");
  table.className = "grid";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  hr.innerHTML = `<th class="timeCell">Saat</th>` + dates.map(d => `<th>${fmtDayTitle(d.obj)}</th>`).join("");
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  slotLabels.forEach(label => {
    const time = parseStartTime(label);
    const tr = document.createElement("tr");

    const tdTime = document.createElement("td");
    tdTime.className = "timeCell";
    tdTime.textContent = label;
    tr.appendChild(tdTime);

    dates.forEach(d => {
      const td = document.createElement("td");
      const task = cellMap.get(`${d.iso}|${time}`);

      if (!task){
        td.innerHTML = `<div class="small">—</div>`;
      } else {
        const done = session ? (doneMap.get(task.id) === true) : false;

        td.innerHTML = `
          <div class="slot ${done ? "done" : ""}">
            <input type="checkbox" ${done ? "checked" : ""} />
            <div class="txt">
              <div class="course">${task.course}</div>
              <div>${task.topic}</div>
              <div class="small">${task.task_type} · ${task.exam}</div>
            </div>
          </div>
        `;

        const cb = td.querySelector("input");
        const slotEl = td.querySelector(".slot");

        if (!session){
          cb.disabled = true;
          slotEl.addEventListener("click", () => goLogin());
        } else {
          cb.addEventListener("change", async () => {
            cb.disabled = true;
            try{
              await upsertTaskDone(session.user.id, task.id, cb.checked);
              slotEl.classList.toggle("done", cb.checked);
            }catch(e){
              alert("Kaydedilemedi: " + e.message);
              cb.checked = !cb.checked;
            }finally{
              cb.disabled = false;
            }
          });
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.innerHTML = "";
  wrap.appendChild(table);
}

// Dashboard (guest shows placeholders)
async function renderDashboard(session){
  if (!$("tytCourses")) return;

  const [tytTopics, aytTopics] = await Promise.all([fetchTopics("TYT"), fetchTopics("AYT")]);

  const byCourse = (topics) => {
    const m = new Map();
    topics.forEach(t => {
      if (!m.has(t.course)) m.set(t.course, 0);
      m.set(t.course, m.get(t.course) + 1);
    });
    return Array.from(m.entries()).sort((a,b)=>a[0].localeCompare(b[0],"tr"));
  };

  const tytList = $("tytCourses");
  const aytList = $("aytCourses");

  tytList.innerHTML = "";
  byCourse(tytTopics).forEach(([course,total]) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<b>${course}</b><span>${session ? "…" : `Toplam: ${total}`}</span>`;
    tytList.appendChild(div);
  });

  aytList.innerHTML = "";
  byCourse(aytTopics).forEach(([course,total]) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<b>${course}</b><span>${session ? "…" : `Toplam: ${total}`}</span>`;
    aytList.appendChild(div);
  });

  if (!session){
    $("tytOverall").textContent = "—";
    $("aytOverall").textContent = "—";
    $("tytOverallMeta").textContent = "Giriş yapınca ilerleme görünür";
    $("aytOverallMeta").textContent = "Giriş yapınca ilerleme görünür";

    setDonut($("donutToday"), 0, "—");
    setDonut($("donutWeek"), 0, "—");
    $("todayMeta").textContent = "Giriş yapınca görünür";
    $("weekMeta").textContent = "Giriş yapınca görünür";
  }
}

// Admin guard stays (requires login)
async function requireAdmin(user){
  const { data, error } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  if (!data || data.role !== "admin"){
    alert("Erişim reddedildi.");
    location.href = "index.html";
    return false;
  }
  return true;
}

// Login page
function initLoginPage(){
  const btn = $("btnLogin");
  const msg = $("msg");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    msg.textContent = "Giriş yapılıyor...";
    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { msg.textContent = "Giriş başarısız: " + error.message; return; }

    const next = getNextFromQuery();
    location.href = next ? next : "index.html";
  });
}

// MAIN
(async function main(){
  const { data: { session } } = await sb.auth.getSession();

  // Navbar button
  renderNavAuthButton(session);

  // Only admin page forces login
  if (isAdminPage() && !session){
    goLogin();
    return;
  }

  // Login page
  if (isLoginPage()){
    if (session){
      const next = getNextFromQuery();
      location.href = next ? next : "index.html";
      return;
    }
    initLoginPage();
    return;
  }

  initCountdown();

  // Public render always works (checkbox behavior depends on session)
  await Promise.all([
    renderDashboard(session),
    renderWeeklyGrid(session),
    renderTopicsPage(session, "TYT", "tytTopics"),
    renderTopicsPage(session, "AYT", "aytTopics"),
  ]);

  // Admin page: keep your existing admin editor as-is (we’ll touch it later)
  if (isAdminPage() && session){
    const ok = await requireAdmin(session.user);
    if (!ok) return;
    // (No further admin JS changes in Step 1)
  }
})();

