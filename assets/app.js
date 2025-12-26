


function $(id){ return document.getElementById(id); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function setText(id, txt){
  const el = $(id);
  if (el) el.textContent = txt;
}

function setDonut(el, percent, labelText){
  if (!el) return;
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const deg = Math.round(p * 3.6);

  // uses CSS var --accent if you have it; otherwise still works
  el.style.background = `conic-gradient(var(--accent) ${deg}deg, rgba(255,255,255,0.10) ${deg}deg)`;

  const span = el.querySelector("span");
  if (span) span.textContent = labelText ?? `%${p}`;
}

// ===================== Supabase =====================
const SUPABASE_URL = "https://bexcwoukvbwtrllspdmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJleGN3b3VrdmJ3dHJsbHNwZG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODAwNjIsImV4cCI6MjA4MjI1NjA2Mn0.yxCSboNQ2Y4tbe8RO4pt3HjM1-reC9TToOVzZ66LIms"; // <-- paste anon key here

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== Page helpers =====================
function isLoginPage(){ return location.pathname.endsWith("giris.html"); }
function isAdminPage(){ return location.pathname.endsWith("admin.html"); }
function isWeeklyPage(){ return location.pathname.endsWith("weekly.html"); }
function goLogin(){
  const next = encodeURIComponent(location.href);
  location.href = `giris.html?next=${next}`;
}
function getNextFromQuery(){
  const params = new URLSearchParams(location.search);
  return params.get("next");
}

// Navbar auth button (auto adds on any page with .nav)
function renderNavAuthButton(session){
  const nav = document.querySelector(".nav");
  if (!nav) return;

  const old = document.getElementById("navAuthBtn");
  if (old) old.remove();

  const btn = document.createElement("button");
  btn.id = "navAuthBtn";
  btn.style.marginLeft = "auto";

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

// ===================== Date helpers =====================
function toISODate(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function parseISODate(s){
  const [y,m,d] = (s || "").split("-").map(x => parseInt(x,10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m-1, d);
  dt.setHours(0,0,0,0);
  return isNaN(dt.getTime()) ? null : dt;
}
function getWeekRange(base = new Date()){
  const d = new Date(base);
  d.setHours(0,0,0,0);
  const mondayOffset = (d.getDay() + 6) % 7; // Monday start
  const monday = new Date(d); monday.setDate(d.getDate() - mondayOffset);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}
function addDays(dateObj, days){
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}
const TR_DAYS = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
function fmtDayTitle(dateObj){
  const dd = String(dateObj.getDate()).padStart(2,"0");
  const mm = String(dateObj.getMonth()+1).padStart(2,"0");
  return `${TR_DAYS[dateObj.getDay()]} (${dd}.${mm})`;
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

// Week in URL: ?week=YYYY-MM-DD
function getWeekFromURL(){
  const params = new URLSearchParams(location.search);
  const w = params.get("week");
  const dt = parseISODate(w);
  const { monday } = getWeekRange(dt || new Date());
  return monday;
}
function setWeekInURL(mondayDateObj){
  const u = new URL(location.href);
  u.searchParams.set("week", toISODate(mondayDateObj));
  location.href = u.toString();
}

// ===================== Countdown =====================
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

// ===================== Settings: time slots =====================
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

// ===================== Fetchers =====================
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

// ---- Day notes ----
async function fetchDayNotes(startISO, endISO){
  const { data, error } = await sb
    .from("day_notes")
    .select("note_date, note")
    .gte("note_date", startISO)
    .lte("note_date", endISO)
    .order("note_date", { ascending: true });

  if (error) throw error;
  const map = new Map();
  (data || []).forEach(r => map.set(r.note_date, r.note || ""));
  return map;
}
async function upsertDayNote(note_date, note){
  const { error } = await sb
    .from("day_notes")
    .upsert({ note_date, note }, { onConflict: "note_date" });
  if (error) throw error;
}
async function deleteDayNote(note_date){
  const { error } = await sb
    .from("day_notes")
    .delete()
    .eq("note_date", note_date);
  if (error) throw error;
}

// ---- Course links ----
async function fetchCourseLinks(exam){
  const { data, error } = await sb
    .from("course_links")
    .select("id, exam, course, title, url, sort_order")
    .eq("exam", exam)
    .order("course", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;
  return data || [];
}
function groupLinksByCourse(links){
  const m = new Map();
  links.forEach(l => {
    const c = (l.course || "").trim();
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(l);
  });
  return m;
}
async function renderCourseLinks(exam, containerId){
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = `<p class="muted">Yükleniyor...</p>`;

  const links = await fetchCourseLinks(exam);
  if (!links.length){
    container.innerHTML = `<p class="muted">Henüz link eklenmedi.</p>`;
    return;
  }

  const byCourse = groupLinksByCourse(links);
  container.innerHTML = "";

  for (const [course, list] of byCourse.entries()){
    const details = document.createElement("details");
    details.className = "course";
    details.open = false;

    const summary = document.createElement("summary");
    summary.innerHTML = `<b>${escapeHtml(course)}</b> <span>${list.length} link</span>`;
    details.appendChild(summary);

    const div = document.createElement("div");
    div.className = "topics";

    list.forEach(l => {
      const a = document.createElement("a");
      a.className = "item";
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = `<b>${escapeHtml(l.title)}</b><span class="small">Aç</span>`;
      div.appendChild(a);
    });

    details.appendChild(div);
    container.appendChild(details);
  }
}

// ===================== Completion (auth only) =====================
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

// ===================== Dashboard (HOME PAGE FIX) =====================
function groupTopicsByCourse(topics){
  const m = new Map(); // course -> { total, ids:[] }
  topics.forEach(t => {
    const c = (t.course || "").trim();
    if (!m.has(c)) m.set(c, { total: 0, ids: [] });
    const obj = m.get(c);
    obj.total += 1;
    obj.ids.push(t.id);
  });
  return m;
}

async function renderDashboard(session){
  // Only run if homepage elements exist
  const hasHome =
    $("tytCourses") || $("aytCourses") ||
    $("donutToday") || $("donutWeek") ||
    $("tytOverall") || $("aytOverall");

  if (!hasHome) return;

  const todayISO = toISODate(new Date());
  const { monday, sunday } = getWeekRange(new Date());
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);

  // Fetch topics + this week tasks
  const [tytTopics, aytTopics, weekTasks] = await Promise.all([
    fetchTopics("TYT"),
    fetchTopics("AYT"),
    fetchWeeklyTasks(startISO, endISO),
  ]);

  const tasksToday = weekTasks.filter(t => t.task_date === todayISO);

  // Completion maps if logged in
  const [topicDoneMap, taskDoneMap] = session
    ? await Promise.all([fetchTopicCompletion(), fetchTaskCompletion()])
    : [new Map(), new Map()];

  // ---- TYT/AYT overall ----
  const tytTotal = tytTopics.length;
  const aytTotal = aytTopics.length;

  const tytDone = session ? tytTopics.reduce((a,t)=>a + (topicDoneMap.get(t.id) ? 1 : 0), 0) : 0;
  const aytDone = session ? aytTopics.reduce((a,t)=>a + (topicDoneMap.get(t.id) ? 1 : 0), 0) : 0;

  const tytPct = tytTotal ? Math.round((tytDone/tytTotal)*100) : 0;
  const aytPct = aytTotal ? Math.round((aytDone/aytTotal)*100) : 0;

  // If your homepage uses these IDs (most likely)
  setText("tytOverall", session ? `%${tytPct}` : "—");
  setText("tytOverallMeta", session ? `${tytDone} / ${tytTotal} konu` : `Toplam: ${tytTotal} konu`);

  setText("aytOverall", session ? `%${aytPct}` : "—");
  setText("aytOverallMeta", session ? `${aytDone} / ${aytTotal} konu` : `Toplam: ${aytTotal} konu`);

  // ---- Today + Week plan ----
  const todayTotal = tasksToday.length;
  const weekTotal = weekTasks.length;

  const todayDone = session ? tasksToday.reduce((a,t)=>a + (taskDoneMap.get(t.id) ? 1 : 0), 0) : 0;
  const weekDone = session ? weekTasks.reduce((a,t)=>a + (taskDoneMap.get(t.id) ? 1 : 0), 0) : 0;

  const todayPct = todayTotal ? Math.round((todayDone/todayTotal)*100) : 0;
  const weekPct = weekTotal ? Math.round((weekDone/weekTotal)*100) : 0;

  // Donut circles if they exist
  setDonut($("donutToday"), todayPct, session ? `%${todayPct}` : "—");
  setDonut($("donutWeek"), weekPct, session ? `%${weekPct}` : "—");

  // Text under donuts if those IDs exist
  setText("todayMeta", session ? `${todayDone} / ${todayTotal} görev` : `Toplam: ${todayTotal} görev`);
  setText("weekMeta", session ? `${weekDone} / ${weekTotal} görev` : `Toplam: ${weekTotal} görev`);

  // Some homepages also show percent text lines (if you have them)
  setText("todayOverall", session ? `%${todayPct}` : "—");
  setText("weekOverall", session ? `%${weekPct}` : "—");

  // ---- Per-course lists ----
  const renderCourseList = (containerId, topics) => {
    const el = $(containerId);
    if (!el) return;

    const byCourse = groupTopicsByCourse(topics);
    const rows = Array.from(byCourse.entries()).sort((a,b)=>a[0].localeCompare(b[0],"tr"));

    el.innerHTML = "";

    rows.forEach(([course, obj]) => {
      const done = session ? obj.ids.reduce((a,id)=>a + (topicDoneMap.get(id) ? 1 : 0), 0) : 0;
      const pct = obj.total ? Math.round((done/obj.total)*100) : 0;

      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = session
        ? `<b>${escapeHtml(course)}</b><span>%${pct} (${done}/${obj.total})</span>`
        : `<b>${escapeHtml(course)}</b><span>Toplam: ${obj.total}</span>`;

      el.appendChild(div);
    });
  };

  renderCourseList("tytCourses", tytTopics);
  renderCourseList("aytCourses", aytTopics);
}

// ===================== Topics render =====================
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
    details.open = false;

    const summary = document.createElement("summary");
    summary.innerHTML = `<b>${escapeHtml(courseName)}</b> <span>%0 (0/0)</span>`;
    details.appendChild(summary);

    const topicsDiv = document.createElement("div");
    topicsDiv.className = "topics";

    list.forEach(t => {
      const done = session ? (completionMap.get(t.id) === true) : false;

      const label = document.createElement("label");
      label.className = "check" + (done ? " done" : "");
      label.innerHTML = `<span class="topicText">${escapeHtml(t.name)}</span><input type="checkbox" ${done ? "checked" : ""} />`;

      const cb = label.querySelector("input");

      if (!session){
        cb.disabled = true;
        label.addEventListener("click", () => goLogin());
      } else {
        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try{
            await upsertTopicDone(session.user.id, t.id, cb.checked);
            label.classList.toggle("done", cb.checked);
            updateCourseSummary(details);
          }catch(e){
            alert("Kaydedilemedi: " + e.message);
            cb.checked = !cb.checked;
          }finally{
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

// ===================== Weekly page controls =====================
function initWeeklyWeekControls(monday){
  const picker = $("weekPicker");
  const prev = $("btnPrevWeek");
  const next = $("btnNextWeek");
  const label = $("weekLabel");

  if (!picker && !prev && !next && !label) return;

  if (picker) picker.value = toISODate(monday);

  const { sunday } = getWeekRange(monday);
  if (label) label.textContent = `Hafta: ${toISODate(monday)} → ${toISODate(sunday)}`;

  prev?.addEventListener("click", () => setWeekInURL(addDays(monday, -7)));
  next?.addEventListener("click", () => setWeekInURL(addDays(monday, +7)));

  picker?.addEventListener("change", () => {
    const dt = parseISODate(picker.value);
    const { monday: m2 } = getWeekRange(dt || new Date());
    setWeekInURL(m2);
  });
}

// ===================== Weekly grid render (ONLY TODAY clickable) =====================
async function renderWeeklyGrid(session, monday){
  const wrap = $("weeklyGrid");
  if (!wrap) return;

  const { sunday } = getWeekRange(monday);
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);
  const todayISO = toISODate(new Date());

  wrap.innerHTML = `<p class="muted">Yükleniyor...</p>`;

  const [slotLabels, tasks, notesMap] = await Promise.all([
    getTimeSlots(),
    fetchWeeklyTasks(startISO, endISO),
    fetchDayNotes(startISO, endISO),
  ]);

  const doneMap = session ? await fetchTaskCompletion() : new Map();

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
  hr.innerHTML = `<th class="timeCell">Saat</th>` + dates.map(d => `<th>${escapeHtml(fmtDayTitle(d.obj))}</th>`).join("");
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
        const isTodayCell = (task.task_date === todayISO);

        td.innerHTML = `
          <div class="slotCard ${done ? "done" : ""} ${(!isTodayCell ? "slotLocked" : "")}">
            <div class="slotHead">
              <div class="course">${escapeHtml(task.course)}</div>
              <input type="checkbox" ${done ? "checked" : ""} />
            </div>
            <div>${escapeHtml(task.topic)}</div>
            <div class="small">${escapeHtml(task.task_type)} · ${escapeHtml(task.exam)}${!isTodayCell ? " · (Kilitli)" : ""}</div>
          </div>
        `;

        const cb = td.querySelector("input");
        const card = td.querySelector(".slotCard");

        if (!session){
          cb.disabled = true;
          card.addEventListener("click", () => goLogin());
        } else {
          if (!isTodayCell){
            cb.disabled = true;
          } else {
            cb.addEventListener("change", async () => {
              cb.disabled = true;
              try{
                await upsertTaskDone(session.user.id, task.id, cb.checked);
                card.classList.toggle("done", cb.checked);
              }catch(e){
                alert("Kaydedilemedi: " + e.message);
                cb.checked = !cb.checked;
              }finally{
                cb.disabled = false;
              }
            });
          }
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // Notes row
  const notesTr = document.createElement("tr");
  const notesTitle = document.createElement("td");
  notesTitle.className = "timeCell noteRowTitle";
  notesTitle.textContent = "Gün Notu";
  notesTr.appendChild(notesTitle);

  dates.forEach(d => {
    const td = document.createElement("td");
    const txt = (notesMap.get(d.iso) || "").trim();
    td.innerHTML = !txt
      ? `<div class="dayNoteBox dayNoteEmpty">—</div>`
      : `<div class="dayNoteBox">${escapeHtml(txt)}</div>`;
    notesTr.appendChild(td);
  });

  tbody.appendChild(notesTr);

  table.appendChild(tbody);
  wrap.innerHTML = "";
  wrap.appendChild(table);
}

// ===================== Admin =====================
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

// Admin Topics
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

  if (error){ el.innerHTML = `<p class="muted">Hata: ${escapeHtml(error.message)}</p>`; return; }

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
        <div><b>${escapeHtml(t.exam)}</b> — ${escapeHtml(t.course)} — ${escapeHtml(t.name)}</div>
        <div class="small">Sıra: ${escapeHtml(t.sort_order)}</div>
      </div>
      <button class="btnDanger">Sil</button>
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

// Admin time slots
async function loadSlotLines(){
  const ta = $("slotLines");
  if (!ta) return;
  const slots = await getTimeSlots();
  ta.value = slots.join("\n");
}
async function saveSlotLines(){
  const ta = $("slotLines");
  const raw = (ta?.value || "").split("\n").map(s => s.trim()).filter(Boolean);

  const { error } = await sb
    .from("app_settings")
    .upsert({ key: "time_slots", value: { slots: raw } }, { onConflict: "key" });

  if (error) alert("Kaydedilemedi: " + error.message);
  else alert("Kaydedildi.");
}

// Admin weekly grid editor
let ADMIN_SELECTED = null;
let ADMIN_CACHE = { weekStartISO: null, slots: [] };

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

  ADMIN_CACHE = { weekStartISO: startISO, slots };

  const dates = buildWeekDates(monday);

  const table = document.createElement("table");
  table.className = "grid";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  hr.innerHTML = `<th class="timeCell">Saat</th>` + dates.map(d => `<th>${escapeHtml(fmtDayTitle(d.obj))}</th>`).join("");
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
        ? `<div class="small"><b>${escapeHtml(task.exam)}</b> · ${escapeHtml(task.task_type)}</div>
           <div><b>${escapeHtml(task.course)}</b></div>
           <div>${escapeHtml(task.topic)}</div>
           <div class="small">Düzenlemek için tıkla</div>`
        : `<div class="small">Boş (eklemek için tıkla)</div>`;

      td.style.cursor = "pointer";
      td.addEventListener("click", () => {
        ADMIN_SELECTED = { dateISO: d.iso, slotLabel: label, startTime: time };
        if ($("cellInfo")) $("cellInfo").textContent = `${d.iso} · ${label}`;

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
  await renderAdminNotes(ADMIN_CACHE.weekStartISO);
}

async function clearSelectedCell(){
  if (!ADMIN_SELECTED){ alert("Lütfen tabloda bir hücre seç."); return; }

  const { error } = await sb
    .from("weekly_tasks")
    .delete()
    .eq("task_date", ADMIN_SELECTED.dateISO)
    .eq("start_time", ADMIN_SELECTED.startTime);

  if (error) { alert("Silinemedi: " + error.message); return; }
  await loadAdminWeekGrid(ADMIN_CACHE.weekStartISO);
  await renderAdminNotes(ADMIN_CACHE.weekStartISO);
}

// Admin notes editor
async function renderAdminNotes(weekStartISO){
  const list = $("adminNotes");
  if (!list) return;

  const start = new Date(weekStartISO + "T00:00:00");
  const { monday, sunday } = getWeekRange(start);
  const startISO = toISODate(monday);
  const endISO = toISODate(sunday);

  const dates = buildWeekDates(monday);
  const notesMap = await fetchDayNotes(startISO, endISO);

  list.innerHTML = "";

  dates.forEach(d => {
    const wrap = document.createElement("div");
    wrap.className = "adminLine";
    wrap.innerHTML = `
      <div style="flex:1;">
        <div><b>${escapeHtml(fmtDayTitle(d.obj))}</b> <span class="small">(${escapeHtml(d.iso)})</span></div>
        <textarea data-date="${escapeHtml(d.iso)}" placeholder="Not...">${escapeHtml(notesMap.get(d.iso) || "")}</textarea>
      </div>
    `;
    list.appendChild(wrap);
  });
}

async function saveAdminNotes(){
  const list = $("adminNotes");
  if (!list) return;

  const areas = list.querySelectorAll("textarea[data-date]");
  for (const ta of areas){
    const date = ta.getAttribute("data-date");
    const val = (ta.value || "").trim();

    if (!val){
      try { await deleteDayNote(date); } catch (_) {}
    } else {
      await upsertDayNote(date, val);
    }
  }

  alert("Notlar kaydedildi.");
}

// Admin links
async function loadAdminLinks(){
  const el = $("adminLinks");
  if (!el) return;

  const { data, error } = await sb
    .from("course_links")
    .select("id, exam, course, title, url, sort_order")
    .order("exam", { ascending: true })
    .order("course", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error){
    el.innerHTML = `<p class="muted">Hata: ${escapeHtml(error.message)}</p>`;
    return;
  }

  el.innerHTML = "";
  if (!data || data.length === 0){
    el.innerHTML = `<p class="muted">Henüz link yok.</p>`;
    return;
  }

  data.forEach(l => {
    const row = document.createElement("div");
    row.className = "adminLine";
    row.innerHTML = `
      <div style="flex:1;">
        <div><b>${escapeHtml(l.exam)}</b> — ${escapeHtml(l.course)}</div>
        <div>${escapeHtml(l.title)}</div>
        <div class="small">${escapeHtml(l.url)}</div>
      </div>
      <button class="btnDanger">Sil</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      if (!confirm("Silinsin mi?")) return;
      const { error } = await sb.from("course_links").delete().eq("id", l.id);
      if (error) alert("Silinemedi: " + error.message);
      await loadAdminLinks();
    });
    el.appendChild(row);
  });
}

async function addAdminLink(){
  const exam = $("linkExam")?.value;
  const course = ($("linkCourse")?.value || "").trim();
  const title = ($("linkTitle")?.value || "").trim();
  const url = ($("linkUrl")?.value || "").trim();
  const sortOrder = parseInt($("linkOrder")?.value || "0", 10);

  if (!exam || !course || !title || !url){
    alert("Lütfen sınav, ders, başlık ve URL gir.");
    return;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")){
    alert("URL 'https://' ile başlamalı.");
    return;
  }

  const { error } = await sb.from("course_links").insert({
    exam, course, title, url, sort_order: isNaN(sortOrder) ? 0 : sortOrder
  });

  if (error){
    alert("Eklenemedi: " + error.message);
    return;
  }

  $("linkTitle").value = "";
  $("linkUrl").value = "";
  $("linkOrder").value = "";

  await loadAdminLinks();
}

// ===================== Login page =====================
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

// ===================== MAIN =====================
(async function main(){
  const { data: { session } } = await sb.auth.getSession();

  // navbar
  renderNavAuthButton(session);

  // login page
  if (isLoginPage()){
    if (session){
      const next = getNextFromQuery();
      location.href = next ? next : "index.html";
      return;
    }
    initLoginPage();
    return;
  }

  // admin requires login
  if (isAdminPage() && !session){
    goLogin();
    return;
  }

  // countdown (home)
  initCountdown();

  // HOME dashboard (this fixes 0/0 issue)
  await renderDashboard(session);

  // weekly page
  if (isWeeklyPage()){
    const monday = getWeekFromURL();
    initWeeklyWeekControls(monday);
    await renderWeeklyGrid(session, monday);
  }

  // topic pages
  await Promise.all([
    renderTopicsPage(session, "TYT", "tytTopics"),
    renderTopicsPage(session, "AYT", "aytTopics"),
  ]);

  // links sections
  await Promise.all([
    renderCourseLinks("TYT", "tytLinks"),
    renderCourseLinks("AYT", "aytLinks"),
  ]);

  // admin wiring
  if (isAdminPage() && session){
    const ok = await requireAdmin(session.user);
    if (!ok) return;

    // add topic
    $("btnAddTopic")?.addEventListener("click", async () => {
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

      if (error) { alert("Kaydedilemedi: " + error.message); return; }

      $("topicName").value = "";
      $("topicOrder").value = "";
      await loadAdminTopics();
    });

    await loadAdminTopics();

    // time slots
    await loadSlotLines();
    $("btnSaveSlots")?.addEventListener("click", async () => {
      await saveSlotLines();
      const ws = $("weekStart").value;
      if (ws){
        await loadAdminWeekGrid(ws);
        await renderAdminNotes(ws);
      }
    });

    // default weekStart
    const { monday: mNow } = getWeekRange(new Date());
    if ($("weekStart") && !$("weekStart").value) $("weekStart").value = toISODate(mNow);

    $("btnLoadWeek")?.addEventListener("click", async () => {
      const ws = $("weekStart").value;
      if (!ws) return;
      await loadAdminWeekGrid(ws);
      await renderAdminNotes(ws);
    });

    $("btnSaveCell")?.addEventListener("click", saveSelectedCell);
    $("btnClearCell")?.addEventListener("click", clearSelectedCell);

    $("btnSaveNotes")?.addEventListener("click", saveAdminNotes);

    // links admin
    $("btnAddLink")?.addEventListener("click", addAdminLink);
    await loadAdminLinks();

    // initial load
    await loadAdminWeekGrid($("weekStart").value);
    await renderAdminNotes($("weekStart").value);
  }
})();
