function $(id){ return document.getElementById(id); }

// 1) Supabase client (CDN provides global `supabase`)
const SUPABASE_URL = "https://bexcwoukvbwtrllspdmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJleGN3b3VrdmJ3dHJsbHNwZG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODAwNjIsImV4cCI6MjA4MjI1NjA2Mn0.yxCSboNQ2Y4tbe8RO4pt3HjM1-reC9TToOVzZ66LIms"; // <-- paste anon key here


const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

function toISODate(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekRange(today = new Date()){
  const d = new Date(today);
  d.setHours(0,0,0,0);
  // Monday as start
  const mondayOffset = (d.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

const TR_DAYS = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
function fmtDayTitle(dateObj){
  const d = dateObj.getDate();
  const m = dateObj.getMonth()+1;
  const dayName = TR_DAYS[dateObj.getDay()];
  return `${dayName} (${String(d).padStart(2,"0")}.${String(m).padStart(2,"0")})`;
}

// Donut helpers
function setDonut(el, percent){
  if (!el) return;
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const deg = Math.round(p * 3.6);
  el.style.background = `conic-gradient(#111 ${deg}deg, #eee ${deg}deg)`;
  const span = el.querySelector("span");
  if (span) span.textContent = `%${p}`;
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

// ---------- DATA LOADERS ----------
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

async function fetchTopicCompletion(){
  const { data, error } = await sb
    .from("topic_completion")
    .select("topic_id, done");
  if (error) throw error;
  const map = new Map();
  (data || []).forEach(r => map.set(r.topic_id, !!r.done));
  return map;
}

async function upsertTopicDone(userId, topicId, done){
  const { error } = await sb
    .from("topic_completion")
    .upsert(
      { user_id: userId, topic_id: topicId, done },
      { onConflict: "user_id,topic_id" }
    );
  if (error) throw error;
}

async function fetchWeeklyTasks(startISO, endISO){
  const { data, error } = await sb
    .from("weekly_tasks")
    .select("id, task_date, exam, course, topic, task_type, duration_min, sort_order")
    .gte("task_date", startISO)
    .lte("task_date", endISO)
    .order("task_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchTaskCompletion(){
  const { data, error } = await sb
    .from("task_completion")
    .select("task_id, done");
  if (error) throw error;
  const map = new Map();
  (data || []).forEach(r => map.set(r.task_id, !!r.done));
  return map;
}

async function upsertTaskDone(userId, taskId, done){
  const { error } = await sb
    .from("task_completion")
    .upsert(
      { user_id: userId, task_id: taskId, done },
      { onConflict: "user_id,task_id" }
    );
  if (error) throw error;
}

// ---------- RENDER: TOPICS PAGE ----------
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

async function renderTopicsPage(user, exam, containerId){
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = `<p class="muted">Yükleniyor...</p>`;

  const [topics, completionMap] = await Promise.all([
    fetchTopics(exam),
    fetchTopicCompletion()
  ]);

  if (topics.length === 0){
    container.innerHTML = `<p class="muted">Henüz konu eklenmedi.</p>`;
    return;
  }

  const byCourse = groupByCourse(topics);
  container.innerHTML = "";

  for (const [courseName, list] of byCourse.entries()){
    const details = document.createElement("details");
    details.className = "course";
    details.open = true;

    const summary = document.createElement("summary");
    summary.innerHTML = `<b>${courseName}</b> <span>%0 (0/0)</span>`;
    details.appendChild(summary);

    const topicsDiv = document.createElement("div");
    topicsDiv.className = "topics";

    list.forEach(t => {
      const done = completionMap.get(t.id) === true;

      const label = document.createElement("label");
      label.className = "check" + (done ? " done" : "");
      label.innerHTML = `
        <input type="checkbox" ${done ? "checked" : ""} />
        <span>${t.name}</span>
      `;

      const cb = label.querySelector("input");
      cb.addEventListener("change", async () => {
        cb.disabled = true;
        try {
          await upsertTopicDone(user.id, t.id, cb.checked);
          label.classList.toggle("done", cb.checked);
          updateCourseSummary(details);
        } catch (e) {
          alert("Kaydedilemedi: " + e.message);
          cb.checked = !cb.checked;
        } finally {
          cb.disabled = false;
        }
      });

      topicsDiv.appendChild(label);
    });

    details.appendChild(topicsDiv);
    container.appendChild(details);
    updateCourseSummary(details);
  }
}

// ---------- RENDER: WEEKLY PAGE ----------
async function renderWeeklyPage(user){
  const board = $("weeklyBoard");
  if (!board) return;

  const { monday, sunday } = getWeekRange(new Date());
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);

  board.innerHTML = `<p class="muted">Yükleniyor...</p>`;

  const [tasks, completionMap] = await Promise.all([
    fetchWeeklyTasks(startISO, endISO),
    fetchTaskCompletion()
  ]);

  // Create day buckets
  const dayMap = new Map();
  for (let i=0;i<7;i++){
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    dayMap.set(toISODate(d), { dateObj: d, tasks: [] });
  }
  tasks.forEach(t => {
    if (dayMap.has(t.task_date)) dayMap.get(t.task_date).tasks.push(t);
  });

  board.innerHTML = "";

  for (const [dateISO, info] of dayMap.entries()){
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<h3>${fmtDayTitle(info.dateObj)}</h3>`;

    if (info.tasks.length === 0){
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Henüz görev yok.";
      box.appendChild(empty);
    } else {
      info.tasks.forEach(t => {
        const done = completionMap.get(t.id) === true;
        const row = document.createElement("div");
        row.className = "task" + (done ? " done" : "");
        row.innerHTML = `
          <input type="checkbox" ${done ? "checked" : ""} />
          <div>
            <div><b>${t.course}</b> — ${t.topic}</div>
            <div class="small">${t.task_type} · ${t.duration_min} dk</div>
          </div>
        `;
        const cb = row.querySelector("input");
        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try {
            await upsertTaskDone(user.id, t.id, cb.checked);
            row.classList.toggle("done", cb.checked);
          } catch (e) {
            alert("Kaydedilemedi: " + e.message);
            cb.checked = !cb.checked;
          } finally {
            cb.disabled = false;
          }
        });

        box.appendChild(row);
      });
    }

    board.appendChild(box);
  }
}

// ---------- RENDER: DASHBOARD ----------
function computeCourseStats(topics, completionMap){
  const byCourse = groupByCourse(topics);
  const rows = [];
  let totalAll = 0;
  let doneAll = 0;

  for (const [course, list] of byCourse.entries()){
    const total = list.length;
    let done = 0;
    list.forEach(t => { if (completionMap.get(t.id) === true) done++; });
    totalAll += total;
    doneAll += done;
    rows.push({ course, done, total });
  }
  return { rows, doneAll, totalAll };
}

function renderCourseList(el, rows){
  el.innerHTML = "";
  rows.forEach(r => {
    const percent = r.total ? Math.round((r.done/r.total)*100) : 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<b>${r.course}</b><span>%${percent} (${r.done}/${r.total})</span>`;
    el.appendChild(div);
  });
}

async function renderDashboard(user){
  if (!$("tytCourses")) return;

  // topics + completion
  const [tytTopics, aytTopics, completionMap] = await Promise.all([
    fetchTopics("TYT"),
    fetchTopics("AYT"),
    fetchTopicCompletion()
  ]);

  const tytStats = computeCourseStats(tytTopics, completionMap);
  const aytStats = computeCourseStats(aytTopics, completionMap);

  renderCourseList($("tytCourses"), tytStats.rows);
  renderCourseList($("aytCourses"), aytStats.rows);

  const tytPct = tytStats.totalAll ? Math.round((tytStats.doneAll/tytStats.totalAll)*100) : 0;
  const aytPct = aytStats.totalAll ? Math.round((aytStats.doneAll/aytStats.totalAll)*100) : 0;

  $("tytOverall").textContent = `%${tytPct}`;
  $("aytOverall").textContent = `%${aytPct}`;
  $("tytOverallMeta").textContent = `${tytStats.doneAll} / ${tytStats.totalAll} konu`;
  $("aytOverallMeta").textContent = `${aytStats.doneAll} / ${aytStats.totalAll} konu`;

  // weekly tasks + completion for donuts
  const { monday, sunday } = getWeekRange(new Date());
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);
  const todayISO = toISODate(new Date());

  const [tasks, taskDoneMap] = await Promise.all([
    fetchWeeklyTasks(startISO, endISO),
    fetchTaskCompletion()
  ]);

  const weekTotal = tasks.length;
  const weekDone = tasks.filter(t => taskDoneMap.get(t.id) === true).length;

  const todayTasks = tasks.filter(t => t.task_date === todayISO);
  const todayTotal = todayTasks.length;
  const todayDone = todayTasks.filter(t => taskDoneMap.get(t.id) === true).length;

  const todayPct = todayTotal ? (todayDone/todayTotal)*100 : 0;
  const weekPct = weekTotal ? (weekDone/weekTotal)*100 : 0;

  setDonut($("donutToday"), todayPct);
  setDonut($("donutWeek"), weekPct);
  $("todayMeta").textContent = `${todayDone} / ${todayTotal} görev`;
  $("weekMeta").textContent = `${weekDone} / ${weekTotal} görev`;
}

// ---------- ADMIN ----------
async function requireAdmin(user){
  const msg = $("adminMsg");
  const { data, error } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    if (msg) msg.textContent = "Profil okunamadı: " + error.message;
    throw error;
  }
  if (!data || data.role !== "admin"){
    alert("Erişim reddedildi.");
    location.href = "index.html";
    return false;
  }
  return true;
}

async function loadAdminTopics(){
  const el = $("adminTopics");
  if (!el) return;

  const { data, error } = await sb
    .from("topics")
    .select("id, exam, course, name, sort_order")
    .order("exam", { ascending: true })
    .order("course", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    el.innerHTML = `<p class="muted">Hata: ${error.message}</p>`;
    return;
  }

  el.innerHTML = "";
  if (!data || data.length === 0){
    el.innerHTML = `<p class="muted">Henüz konu yok.</p>`;
    return;
  }

  data.forEach(t => {
    const row = document.createElement("div");
    row.className = "adminLine";
    row.innerHTML = `
      <div>
        <div><b>${t.exam}</b> — ${t.course} — ${t.name}</div>
        <div class="meta">Sıra: ${t.sort_order}</div>
      </div>
      <button class="btnSmall btnDanger" data-id="${t.id}">Sil</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      if (!confirm("Silinsin mi?")) return;
      const { error } = await sb.from("topics").delete().eq("id", t.id);
      if (error) alert("Silinemedi: " + error.message);
      await loadAdminTopics();
    });
    el.appendChild(row);
  });
}

async function loadAdminWeekTasks(weekStartISO){
  const el = $("adminTasks");
  if (!el) return;

  const start = new Date(weekStartISO + "T00:00:00");
  const { monday, sunday } = getWeekRange(start);
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);

  const { data, error } = await sb
    .from("weekly_tasks")
    .select("id, task_date, exam, course, topic, task_type, duration_min, sort_order")
    .gte("task_date", startISO)
    .lte("task_date", endISO)
    .order("task_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    el.innerHTML = `<p class="muted">Hata: ${error.message}</p>`;
    return;
  }

  el.innerHTML = "";
  if (!data || data.length === 0){
    el.innerHTML = `<p class="muted">Bu hafta görev yok.</p>`;
    return;
  }

  data.forEach(t => {
    const row = document.createElement("div");
    row.className = "adminLine";
    row.innerHTML = `
      <div>
        <div><b>${t.task_date}</b> — <b>${t.exam}</b> — ${t.course} — ${t.topic}</div>
        <div class="meta">${t.task_type} · ${t.duration_min} dk</div>
      </div>
      <button class="btnSmall btnDanger" data-id="${t.id}">Sil</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      if (!confirm("Silinsin mi?")) return;
      const { error } = await sb.from("weekly_tasks").delete().eq("id", t.id);
      if (error) alert("Silinemedi: " + error.message);
      await loadAdminWeekTasks(startISO);
    });
    el.appendChild(row);
  });
}

async function initAdmin(user){
  if (!$("btnAddTopic")) return;

  const ok = await requireAdmin(user);
  if (!ok) return;

  // Logout
  const btnLogout = $("btnLogout");
  btnLogout?.addEventListener("click", async () => {
    await sb.auth.signOut();
    location.href = "giris.html";
  });

  // Default dates
  const { monday } = getWeekRange(new Date());
  if ($("weekStart")) $("weekStart").value = toISODate(monday);
  if ($("taskDate")) $("taskDate").value = toISODate(new Date());

  // Add topic
  $("btnAddTopic").addEventListener("click", async () => {
    const exam = $("topicExam").value;
    const course = $("topicCourse").value.trim();
    const name = $("topicName").value.trim();
    const sortOrder = parseInt($("topicOrder").value || "0", 10);

    if (!course || !name){
      alert("Lütfen ders ve konu adı gir.");
      return;
    }

    const { error } = await sb.from("topics").insert({
      exam, course, name, sort_order: isNaN(sortOrder) ? 0 : sortOrder
    });

    if (error) {
      alert("Kaydedilemedi: " + error.message);
      return;
    }

    $("topicName").value = "";
    $("topicOrder").value = "";
    await loadAdminTopics();
  });

  // Add task
  $("btnAddTask").addEventListener("click", async () => {
    const task_date = $("taskDate").value;
    const exam = $("taskExam").value;
    const course = $("taskCourse").value.trim();
    const topic = $("taskTopic").value.trim();
    const task_type = $("taskType").value;
    const duration_min = parseInt($("taskDuration").value || "0", 10);

    if (!task_date || !course || !topic){
      alert("Lütfen tarih, ders ve konu gir.");
      return;
    }

    const { error } = await sb.from("weekly_tasks").insert({
      task_date, exam, course, topic, task_type,
      duration_min: isNaN(duration_min) ? 0 : duration_min,
      sort_order: 0
    });

    if (error) {
      alert("Kaydedilemedi: " + error.message);
      return;
    }

    $("taskTopic").value = "";
    $("taskDuration").value = "";
    // refresh list for current selected week
    const ws = $("weekStart").value || toISODate(getWeekRange(new Date()).monday);
    await loadAdminWeekTasks(ws);
  });

  // Load week button
  $("btnLoadWeek").addEventListener("click", async () => {
    const ws = $("weekStart").value;
    if (!ws) return;
    await loadAdminWeekTasks(ws);
  });

  await loadAdminTopics();
  await loadAdminWeekTasks($("weekStart").value);
}

// ---------- LOGIN ----------
function initLoginPage(){
  if (!isLoginPage()) return;

  const btn = $("btnLogin");
  const msg = $("msg");

  btn.addEventListener("click", async () => {
    msg.textContent = "Giriş yapılıyor...";

    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      msg.textContent = "Giriş başarısız: " + error.message;
      return;
    }

    const next = getNextFromQuery();
    location.href = next ? next : "index.html";
  });
}

// ---------- MAIN ----------
(async function main(){
  const { data: { session } } = await sb.auth.getSession();

  if (!session && !isLoginPage()) {
    redirectToLogin();
    return;
  }

  if (session && isLoginPage()) {
    const next = getNextFromQuery();
    location.href = next ? next : "index.html";
    return;
  }

  if (isLoginPage()){
    initLoginPage();
    return;
  }

  const user = session.user;

  initCountdown();
  await Promise.all([
    renderDashboard(user),
    renderWeeklyPage(user),
    renderTopicsPage(user, "TYT", "tytTopics"),
    renderTopicsPage(user, "AYT", "aytTopics"),
    initAdmin(user),
  ]);
})();
