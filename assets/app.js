function $(id){ return document.getElementById(id); }

// 1) Supabase client (CDN provides global `supabase`)
const SUPABASE_URL = "https://bexcwoukvbwtrllspdmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJleGN3b3VrdmJ3dHJsbHNwZG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODAwNjIsImV4cCI6MjA4MjI1NjA2Mn0.yxCSboNQ2Y4tbe8RO4pt3HjM1-reC9TToOVzZ66LIms"; // <-- paste anon key here

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Page helpers
function isLoginPage(){ return location.pathname.endsWith("giris.html"); }
function isAdminPage(){ return location.pathname.endsWith("admin.html"); }
function redirectToLogin(){
  const next = encodeURIComponent(location.href);
  location.href = `giris.html?next=${next}`;
}
function getNextFromQuery(){
  const params = new URLSearchParams(location.search);
  return params.get("next");
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
function setDonut(el, percent){
  if (!el) return;
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const deg = Math.round(p * 3.6);
  el.style.background = `conic-gradient(var(--accent) ${deg}deg, rgba(255,255,255,0.10) ${deg}deg)`;
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

// --- Settings: time slots ---
function parseStartTime(slotLabel){
  // "08:00-09:00" -> "08:00"
  const p = slotLabel.split("-")[0].trim();
  return p.length === 5 ? p : p.slice(0,5);
}
async function getTimeSlots(){
  // default fallback
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

// --- Topics (unchanged logic) ---
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
    .upsert({ user_id: userId, topic_id: topicId, done }, { onConflict: "user_id,topic_id" });
  if (error) throw error;
}
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
  const [topics, completionMap] = await Promise.all([fetchTopics(exam), fetchTopicCompletion()]);
  if (topics.length === 0){ container.innerHTML = `<p class="muted">Henüz konu eklenmedi.</p>`; return; }

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
      label.innerHTML = `<span class="topicText">${t.name}</span><input type="checkbox" ${done ? "checked" : ""} />`;

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

// --- Weekly tasks (GRID) ---
async function fetchWeeklyTasks(startISO, endISO){
  const { data, error } = await sb
    .from("weekly_tasks")
    .select("id, task_date, start_time, exam, course, topic, task_type, duration_min")
    .gte("task_date", startISO)
    .lte("task_date", endISO)
    .order("task_date", { ascending: true })
    .order("start_time", { ascending: true })
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
    .upsert({ user_id: userId, task_id: taskId, done }, { onConflict: "user_id,task_id" });
  if (error) throw error;
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

async function renderWeeklyGridStudent(user){
  const wrap = $("weeklyGrid");
  if (!wrap) return;

  const { monday, sunday } = getWeekRange(new Date());
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);
  const [slots, tasks, doneMap] = await Promise.all([
    getTimeSlots(),
    fetchWeeklyTasks(startISO, endISO),
    fetchTaskCompletion()
  ]);

  // Map cell -> task
  const cellMap = new Map();
  tasks.forEach(t => {
    if (!t.start_time) return; // tasks without time won't appear in grid
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

  slots.forEach(label => {
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
        const done = doneMap.get(task.id) === true;
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

        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try{
            await upsertTaskDone(user.id, task.id, cb.checked);
            slotEl.classList.toggle("done", cb.checked);
          }catch(e){
            alert("Kaydedilemedi: " + e.message);
            cb.checked = !cb.checked;
          }finally{
            cb.disabled = false;
          }
        });
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.innerHTML = "";
  wrap.appendChild(table);
}

// --- Dashboard (uses tasks for donuts) ---
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

  const [tytTopics, aytTopics, topicDoneMap] = await Promise.all([
    fetchTopics("TYT"),
    fetchTopics("AYT"),
    fetchTopicCompletion()
  ]);

  const tytStats = computeCourseStats(tytTopics, topicDoneMap);
  const aytStats = computeCourseStats(aytTopics, topicDoneMap);

  renderCourseList($("tytCourses"), tytStats.rows);
  renderCourseList($("aytCourses"), aytStats.rows);

  const tytPct = tytStats.totalAll ? Math.round((tytStats.doneAll/tytStats.totalAll)*100) : 0;
  const aytPct = aytStats.totalAll ? Math.round((aytStats.doneAll/aytStats.totalAll)*100) : 0;

  $("tytOverall").textContent = `%${tytPct}`;
  $("aytOverall").textContent = `%${aytPct}`;
  $("tytOverallMeta").textContent = `${tytStats.doneAll} / ${tytStats.totalAll} konu`;
  $("aytOverallMeta").textContent = `${aytStats.doneAll} / ${aytStats.totalAll} konu`;

  // donuts from weekly_tasks + task_completion
  const { monday, sunday } = getWeekRange(new Date());
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);
  const todayISO = toISODate(new Date());

  const [tasks, doneMap] = await Promise.all([fetchWeeklyTasks(startISO, endISO), fetchTaskCompletion()]);

  const weekTotal = tasks.length;
  const weekDone = tasks.filter(t => doneMap.get(t.id) === true).length;

  const todayTasks = tasks.filter(t => t.task_date === todayISO);
  const todayTotal = todayTasks.length;
  const todayDone = todayTasks.filter(t => doneMap.get(t.id) === true).length;

  setDonut($("donutToday"), todayTotal ? (todayDone/todayTotal)*100 : 0);
  setDonut($("donutWeek"), weekTotal ? (weekDone/weekTotal)*100 : 0);

  $("todayMeta").textContent = `${todayDone} / ${todayTotal} görev`;
  $("weekMeta").textContent = `${weekDone} / ${weekTotal} görev`;
}

// --- Admin role check + topic admin (same idea as before) ---
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

  if (error){ el.innerHTML = `<p class="muted">Hata: ${error.message}</p>`; return; }
  el.innerHTML = "";

  (data || []).forEach(t => {
    const row = document.createElement("div");
    row.className = "adminLine";
    row.innerHTML = `
      <div>
        <div><b>${t.exam}</b> — ${t.course} — ${t.name}</div>
        <div class="small">Sıra: ${t.sort_order}</div>
      </div>
      <button class="btnDanger" data-id="${t.id}">Sil</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      if (!confirm("Silinsin mi?")) return;
      const { error } = await sb.from("topics").delete().eq("id", t.id);
      if (error) alert("Silinemedi: " + error.message);
      await loadAdminTopics();
    });
    el.appendChild(row);
  });

  if (!data || data.length === 0) el.innerHTML = `<p class="muted">Henüz konu yok.</p>`;
}

// --- Admin: time slot editor ---
async function loadSlotLines(){
  const ta = $("slotLines");
  if (!ta) return;

  const slots = await getTimeSlots();
  ta.value = slots.join("\n");
}
async function saveSlotLines(){
  const ta = $("slotLines");
  const raw = (ta.value || "").split("\n").map(s => s.trim()).filter(Boolean);

  const { error } = await sb
    .from("app_settings")
    .upsert({ key: "time_slots", value: { slots: raw } }, { onConflict: "key" });

  if (error) alert("Kaydedilemedi: " + error.message);
  else alert("Kaydedildi.");
}

// --- Admin: weekly grid editor (writes weekly_tasks with start_time) ---
let ADMIN_SELECTED = null; // { dateISO, slotLabel, startTime }
let ADMIN_CACHE = { tasksByCell: new Map(), weekStartISO: null, slots: [] };

async function loadAdminWeekGrid(weekStartISO){
  const wrap = $("adminGrid");
  if (!wrap) return;

  const start = new Date(weekStartISO + "T00:00:00");
  const { monday, sunday } = getWeekRange(start);
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);

  const [slots, tasks] = await Promise.all([
    getTimeSlots(),
    fetchWeeklyTasks(startISO, endISO),
  ]);

  const cellMap = new Map();
  tasks.forEach(t => {
    if (!t.start_time) return;
    const time = String(t.start_time).slice(0,5);
    cellMap.set(`${t.task_date}|${time}`, t);
  });

  ADMIN_CACHE = { tasksByCell: cellMap, weekStartISO: startISO, slots };

  const dates = buildWeekDates(monday);

  const table = document.createElement("table");
  table.className = "grid";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  hr.innerHTML = `<th class="timeCell">Saat</th>` + dates.map(d => `<th>${fmtDayTitle(d.obj)}</th>`).join("");
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  slots.forEach(label => {
    const time = parseStartTime(label);
    const tr = document.createElement("tr");

    const tdTime = document.createElement("td");
    tdTime.className = "timeCell";
    tdTime.textContent = label;
    tr.appendChild(tdTime);

    dates.forEach(d => {
      const td = document.createElement("td");
      const task = cellMap.get(`${d.iso}|${time}`);

      td.innerHTML = task
        ? `<div class="small"><b>${task.exam}</b> · ${task.task_type}</div><div><b>${task.course}</b></div><div>${task.topic}</div><div class="small">Düzenlemek için tıkla</div>`
        : `<div class="small">Boş (eklemek için tıkla)</div>`;

      td.style.cursor = "pointer";
      td.addEventListener("click", () => {
        ADMIN_SELECTED = { dateISO: d.iso, slotLabel: label, startTime: time };
        $("cellInfo").textContent = `${d.iso} · ${label}`;

        const existing = cellMap.get(`${d.iso}|${time}`);
        if (existing){
          $("cellExam").value = existing.exam;
          $("cellType").value = existing.task_type;
          $("cellCourse").value = existing.course;
          $("cellTopic").value = existing.topic;
        } else {
          $("cellExam").value = "TYT";
          $("cellType").value = "Çalışma";
          $("cellCourse").value = "";
          $("cellTopic").value = "";
        }
      });

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.innerHTML = "";
  wrap.appendChild(table);
}

async function saveSelectedCell(){
  if (!ADMIN_SELECTED){ alert("Lütfen tabloda bir hücre seç."); return; }

  const task_date = ADMIN_SELECTED.dateISO;
  const start_time = ADMIN_SELECTED.startTime;
  const exam = $("cellExam").value;
  const task_type = $("cellType").value;
  const course = $("cellCourse").value.trim();
  const topic = $("cellTopic").value.trim();

  if (!course || !topic){
    alert("Lütfen ders ve konu/not gir.");
    return;
  }

  const { error } = await sb
    .from("weekly_tasks")
    .upsert(
      { task_date, start_time, exam, course, topic, task_type, duration_min: 0, sort_order: 0 },
      { onConflict: "task_date,start_time" }
    );

  if (error) { alert("Kaydedilemedi: " + error.message); return; }
  await loadAdminWeekGrid(ADMIN_CACHE.weekStartISO);
}

async function clearSelectedCell(){
  if (!ADMIN_SELECTED){ alert("Lütfen tabloda bir hücre seç."); return; }

  const task_date = ADMIN_SELECTED.dateISO;
  const start_time = ADMIN_SELECTED.startTime;

  const { error } = await sb
    .from("weekly_tasks")
    .delete()
    .eq("task_date", task_date)
    .eq("start_time", start_time);

  if (error) { alert("Silinemedi: " + error.message); return; }
  await loadAdminWeekGrid(ADMIN_CACHE.weekStartISO);
}

// --- Login page ---
function initLoginPage(){
  if (!isLoginPage()) return;

  const btn = $("btnLogin");
  const msg = $("msg");

  btn?.addEventListener("click", async () => {
    msg.textContent = "Giriş yapılıyor...";
    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { msg.textContent = "Giriş başarısız: " + error.message; return; }

    const next = getNextFromQuery();
    location.href = next ? next : "index.html";
  });
}

// --- Main ---
(async function main(){
  const { data: { session } } = await sb.auth.getSession();

  if (!session && !isLoginPage()){
    redirectToLogin();
    return;
  }

  if (session && isLoginPage()){
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
    renderWeeklyGridStudent(user),
    renderTopicsPage(user, "TYT", "tytTopics"),
    renderTopicsPage(user, "AYT", "aytTopics"),
  ]);

  // Admin wiring
  if (isAdminPage()){
    const ok = await requireAdmin(user);
    if (!ok) return;

    $("btnLogout")?.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.href = "giris.html";
    });

    // topic add
    $("btnAddTopic")?.addEventListener("click", async () => {
      const exam = $("topicExam").value;
      const course = $("topicCourse").value.trim();
      const name = $("topicName").value.trim();
      const sortOrder = parseInt($("topicOrder").value || "0", 10);

      if (!course || !name){ alert("Lütfen ders ve konu adı gir."); return; }

      const { error } = await sb.from("topics").insert({
        exam, course, name, sort_order: isNaN(sortOrder) ? 0 : sortOrder
      });

      if (error) { alert("Kaydedilemedi: " + error.message); return; }

      $("topicName").value = "";
      $("topicOrder").value = "";
      await loadAdminTopics();
    });

    await loadAdminTopics();

    // slots editor
    await loadSlotLines();
    $("btnSaveSlots")?.addEventListener("click", async () => {
      await saveSlotLines();
      // reload grid with new rows
      const ws = $("weekStart").value;
      if (ws) await loadAdminWeekGrid(ws);
    });

    // week default to current monday
    const { monday } = getWeekRange(new Date());
    $("weekStart").value = toISODate(monday);

    $("btnLoadWeek")?.addEventListener("click", async () => {
      const ws = $("weekStart").value;
      if (!ws) return;
      await loadAdminWeekGrid(ws);
    });

    $("btnSaveCell")?.addEventListener("click", saveSelectedCell);
    $("btnClearCell")?.addEventListener("click", clearSelectedCell);

    await loadAdminWeekGrid($("weekStart").value);
  }
})();
