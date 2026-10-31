// scratch.parkhyo.in — 메모 목록 · 편집 · 저장 · 이미지 붙여넣기 · 「완성」 표시.
//
// 편집 칸은 CodeMirror 6 (editor.js · live-preview.js). 쓰는 칸에서 바로 제목 · 목록 ·
// 이미지가 보이지만, 문서의 글자는 마크다운 원문 그대로다 (2026-10-22~).
// 이 파일은 src/ 에 있고, `pnpm scratch:build` 가 하나로 묶어 ../app.js 를 만든다.
//
// 저장은 곧 GitHub 커밋이라 자동 저장을 하지 않는다 (글자마다 커밋이 쌓인다).
// 대신 저장하지 않은 글은 이 브라우저의 localStorage 에 보관해서, 창을 닫거나
// 저장이 거부돼도 잃지 않게 한다.
//
// 「초안 결정」을 누르면 화면이 3열(목록 · 글 짜기 · 읽기 전용 초안)로 바뀐다. 그 왼쪽 칸은
// compose.js 가 맡고, 이 파일은 모드 전환 · 초안에서 가져오기 · 서버 호출만 이어준다.
import {
  askStash,
  composeManuscript,
  createCompose,
  dropCompose,
  hasContent,
  parseTags,
  readCompose,
  slugProblem,
  storeCompose,
  withRo,
} from "./compose.js";
import { createEditor } from "./editor.js";

const READY_PREFIX = "<!-- ✅ 준비됨";
const READY_FIRST_LINE = /^<!-- ✅ 준비됨[^\n]*-->$/;
const READY_LEAD = /^<!-- ✅ 준비됨[^\n]*-->\n*/;
const MEMO_MARK = /^\s*[+?!]/;
const MAX_IMAGE = 8 * 1024 * 1024;

const $ = s => document.querySelector(s);
const listEl = $("#list");
const nameEl = $("#name");
const badge = $("#badge");
const statusEl = $("#status");
const saveBtn = $("#save");
const readyBtn = $("#ready");
const newBtn = $("#new");
const newForm = $("#new-form");
const newInput = $("#new-input");
const toastEl = $("#toast");
const appEl = $("#app");
const composeEl = $("#compose");
const decideBtn = $("#decide");
const stashBtn = $("#stash");
const dockBtn = $("#dock");
const pullBtn = $("#pull");
const pullLabel = $("#pull-label");
const unmarkBtn = $("#unmark");
const noteEl = $("#draft-note");
const progressEl = $("#progress");
const meterEl = $("#meter");
const hintEl = $("#hint");
const draftHint = hintEl.textContent;
const composeHint =
  "초안은 아직 그대로입니다. 원고로 저장하면 맨 위에 「원고로 옮김」 주석을 달고 published/ 로 옮깁니다";

const ed = createEditor($("#editor"), {
  onChange: () => onInput(),
  onFiles: files => files.forEach(uploadImage),
  onSelection: () => renderPull(),
});
const composer = createCompose(composeEl, {
  onChange: () => onComposeInput(),
  onActive: label => {
    pullBtn.title = `${withRo(label)} 가져오기`;
  },
  // 뼈대를 갈아끼우면 가져온 글이 모두 사라진 것이므로 표시도 걷는다
  onSkeleton: () => {
    ed.clearPulled();
    renderProgress();
  },
});

/** "draft" 는 지금까지의 메모 칸, "compose" 는 초안을 오른쪽으로 보내고 왼쪽에서 글을 짜는 화면 */
let mode = "draft";
/** 왼쪽 칸이 지금 어느 메모의 덩어리를 들고 있나 */
let composeFor = null;
/** 덩어리를 브라우저에 못 맡겼는데 쓴 게 있으면 true — 창을 닫을 때만 묻는다 */
let composeUnsafe = false;
let editableNow = false;
function loadText(text) {
  ed.setText(text); // 새 상태는 편집 불가로 시작한다 — render() 가 다시 켠다
  editableNow = false;
}

/** 지금 연 메모. saved 는 마지막으로 서버와 같았던 본문 */
let current = null;
let busy = false;
let memos = [];

// ── 서버 ──

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new Error("서버에 닿지 못했습니다. 인터넷 연결을 확인하세요");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 본문이 JSON 이 아닐 수 있다 (nginx 오류 페이지 등) */
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error("로그인이 풀렸습니다. 새로고침하세요");
    if (res.status === 429) throw new Error("요청이 너무 잦습니다. 잠시 뒤에 다시 해보세요");
    throw new Error((data && data.error) || `서버 응답 ${res.status}`);
  }
  return data;
}

// ── 브라우저 보관 ──

const draftKey = name => `scratch:draft:${name}`;

function keepDraft() {
  if (!current) return;
  try {
    if (ed.getText() === current.saved) {
      localStorage.removeItem(draftKey(current.name));
    } else {
      localStorage.setItem(
        draftKey(current.name),
        JSON.stringify({ text: ed.getText(), base: current.sha, at: Date.now() })
      );
    }
  } catch {
    /* 사생활 보호 모드 등에서는 저장소가 막혀 있다 — 보관만 못 할 뿐 */
  }
}

function readDraft(name) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(name)) || "null");
  } catch {
    return null;
  }
}

function dropDraft(name) {
  try {
    localStorage.removeItem(draftKey(name));
  } catch {
    /* 위와 같음 */
  }
}

// ── 화면 ──

const isDirty = () => current !== null && ed.getText() !== current.saved;
const isReady = () => ed.getText().startsWith(READY_PREFIX);
const stem = name => name.replace(/\.md$/, "");

function hhmm() {
  return new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let toastTimer;
function toast(message, error = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle("error", error);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), error ? 7000 : 2500);
}

function render() {
  nameEl.textContent = current ? stem(current.name) : "메모를 고르세요";
  const composing = mode === "compose";
  badge.textContent = composing ? "초안 결정" : "준비됨";
  badge.hidden = composing ? !current : !(current && isReady());
  ed.setPlaceholder(
    current ? "아직 비어 있습니다. 여기에 쓰세요." : "왼쪽에서 메모를 고르거나 새로 만드세요."
  );
  // 초안 결정 화면에서 오른쪽 초안은 읽기 전용이다
  const editNow = !!current && !composing;
  if (editNow !== editableNow) {
    ed.setEditable(editNow);
    editableNow = editNow;
  }
  saveBtn.disabled = !current || busy || !isDirty();
  readyBtn.disabled = !current || busy;
  decideBtn.disabled = !current || busy;
  stashBtn.disabled = busy;
  readyBtn.textContent = current && isReady() ? "완성 취소" : "완성";
  if (current && isDirty() && !busy && !composing) statusEl.textContent = "저장 안 됨";
  for (const b of listEl.querySelectorAll(".item")) {
    if (current && b.dataset.name === current.name) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
}

function renderList() {
  if (!memos.length) {
    const p = document.createElement("li");
    p.className = "empty";
    p.textContent = "메모가 없습니다";
    listEl.replaceChildren(p);
    return;
  }
  listEl.replaceChildren(
    ...memos.map(m => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "item";
      b.dataset.name = m.name;
      const t = document.createElement("span");
      t.className = "item-name";
      t.textContent = stem(m.name);
      b.append(t);
      if (m.ready) {
        const r = document.createElement("span");
        r.className = "item-ready";
        r.textContent = "준비됨";
        b.append(r);
      }
      b.addEventListener("click", () => openMemo(m.name));
      li.append(b);
      return li;
    })
  );
  render();
}

async function loadList() {
  try {
    ({ memos } = await api("GET", "/api/memos"));
    renderList();
  } catch (e) {
    toast(e.message, true);
  }
}

// ── 열기 ──

async function openMemo(name) {
  if (current && current.name === name) return;
  if (
    isDirty() &&
    !confirm("저장하지 않은 글이 있습니다.\n이 브라우저에 보관해뒀으니 다시 열면 불러올 수 있습니다. 넘어갈까요?")
  ) {
    return;
  }
  keepDraft();
  keepCompose();
  // 다른 초안으로 넘어가면 왼쪽 칸은 보관본에서 다시 세운다. 가져온 표시는 초안 쪽 상태라
  // 새로 열 때 사라지므로, 이전 메모로 돌아왔을 때 보관한 범위를 되살려야 한다
  composeFor = null;
  if (mode === "compose") setMode("draft");
  busy = true;
  statusEl.textContent = "불러오는 중…";
  render();
  try {
    const m = await api("GET", `/api/memo?name=${encodeURIComponent(name)}`);
    current = { name: m.name, sha: m.sha, saved: m.content };
    loadText(m.content);
    statusEl.textContent = "";

    const d = readDraft(name);
    if (d && d.text !== m.content) {
      const when = new Date(d.at).toLocaleString("ko-KR");
      // 보관한 글이 옛 버전 위에서 쓴 것이면, 불러와 저장하는 순간 그 사이
      // 다른 곳(맥북 로컬 등)에서 고친 내용을 덮어쓴다. 그걸 숨기지 않는다.
      const stale = d.base && d.base !== m.sha;
      const msg =
        `이 브라우저에 저장하지 않은 글이 있습니다 (${when}).` +
        (stale
          ? "\n\n⚠️ 그 뒤로 서버의 글이 다른 곳에서 바뀌었습니다. 불러와 저장하면 그 변경을 덮어씁니다."
          : "") +
        "\n\n불러올까요? 취소하면 서버의 글을 보여주고, 보관한 글은 지웁니다.";
      if (confirm(msg)) loadText(d.text);
      else dropDraft(name);
    }
    history.replaceState(null, "", `#${encodeURIComponent(name)}`);
  } catch (e) {
    statusEl.textContent = "";
    toast(e.message, true);
  } finally {
    busy = false;
    render();
    if (current) ed.focus();
  }
}

// ── 저장 ──

async function save(reason = "save") {
  if (!current || busy) return;
  const text = ed.getText();
  busy = true;
  statusEl.textContent = "저장 중…";
  render();
  try {
    const r = await api("PUT", "/api/memo", {
      name: current.name,
      content: text,
      sha: current.sha,
      reason,
    });
    current.sha = r.sha;
    current.saved = text;
    // 저장하는 동안 더 쓴 게 있으면 그건 아직 보관 대상이다
    keepDraft();
    keepCompose();
    statusEl.textContent = `저장됨 · ${hhmm()}`;
    if (reason === "ready") toast("완성으로 표시했습니다. 다음 세션에서 Claude 가 초안을 만듭니다");
    loadList();
  } catch (e) {
    keepDraft();
    statusEl.textContent = "저장 안 됨";
    toast(e.message, true);
  } finally {
    busy = false;
    render();
  }
}

async function toggleReady() {
  if (!current || busy) return;
  if (isReady()) {
    ed.removeFirstLine(READY_FIRST_LINE);
    await save("unready");
    return;
  }
  if (!ed.getText().trim()) {
    toast("빈 메모는 완성할 수 없습니다", true);
    return;
  }
  ed.prependLine(`${READY_PREFIX} (${today()}) -->`);
  await save("ready");
}

// ── 새 메모 ──

function toggleNewForm(show) {
  newForm.hidden = !show;
  newBtn.hidden = show;
  if (show) {
    newInput.value = "";
    newInput.focus();
  }
}

async function createMemo(e) {
  e.preventDefault();
  let name = newInput.value.trim().replace(/\s+/g, "-");
  if (!name) return;
  if (!name.endsWith(".md")) name += ".md";
  if (memos.some(m => m.name === name)) {
    toast("같은 이름의 메모가 이미 있습니다", true);
    return;
  }
  try {
    await api("PUT", "/api/memo", { name, content: "", sha: null, reason: "create" });
    toggleNewForm(false);
    await loadList();
    await openMemo(name);
  } catch (err) {
    toast(err.message, true);
  }
}

// ── 이미지 ──

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",", 2)[1]);
    r.onerror = () => reject(new Error("이미지를 읽지 못했습니다"));
    r.readAsDataURL(file);
  });
}

let uploading = 0;
async function uploadImage(file) {
  if (mode === "compose") return;
  if (!current) {
    toast("메모를 먼저 여세요", true);
    return;
  }
  if (file.size > MAX_IMAGE) {
    toast("이미지가 너무 큽니다 (8MB 까지)", true);
    return;
  }
  // 올리는 동안 본문에 자리표시를 넣지 않는다 — 자리표시를 나중에 링크로 바꾸면
  // 되돌리기가 두 단계로 갈라진다. 대신 상태줄에 띄우고, 다 올린 뒤 한 번에 넣는다.
  const memo = current.name;
  uploading++;
  statusEl.textContent = "이미지 올리는 중…";
  try {
    const data = await readAsBase64(file);
    const r = await api("POST", "/api/image", { memo, mime: file.type, data });
    if (!current || current.name !== memo) {
      toast(`이미지는 올렸지만 그사이 다른 메모를 열어서 넣지 않았습니다 — ${r.markdown}`, true);
      return;
    }
    // 방금 붙인 그림은 받을 필요 없이 바로 보여준다
    ed.seedImage(r.path, URL.createObjectURL(file));
    ed.insert(`${r.markdown}\n`);
    toast("이미지를 올렸습니다 · ⌘Z 로 되돌릴 수 있고, 메모도 저장해야 남습니다");
  } catch (e) {
    toast(e.message, true);
  } finally {
    uploading--;
    if (!uploading && statusEl.textContent === "이미지 올리는 중…") {
      statusEl.textContent = isDirty() ? "저장 안 됨" : "";
    }
    render();
  }
}

// ── 초안 결정 · 글 짜기 ──

/** 공백을 뺀 글자 수 */
const countChars = text => text.replace(/\s/g, "").length;

/** 초안에서 셀 글 — 맨 위 「준비됨」 줄은 옮길 글이 아니다 */
function draftBody() {
  const text = ed.getText();
  const lead = READY_LEAD.exec(text);
  return { text, offset: lead ? lead[0].length : 0 };
}

function renderProgress() {
  const { text, offset } = draftBody();
  const total = countChars(text.slice(offset));
  let done = 0;
  for (const r of ed.getPulled()) {
    if (r.to > offset) done += countChars(text.slice(Math.max(r.from, offset), r.to));
  }
  progressEl.textContent = `${done} / ${total}자 옮김`;
  meterEl.max = Math.max(total, 1);
  meterEl.value = done;
}

/** 「가져오기」 — 고른 데가 있으면 눈에 띄게, 없으면 커서가 있는 줄 */
function renderPull() {
  if (mode !== "compose") return;
  const picked = ed.getSelectionText() !== "";
  pullLabel.textContent = picked ? "고른 글 가져오기" : "이 줄 가져오기";
  pullBtn.classList.toggle("btn-primary", picked);
  pullBtn.classList.toggle("btn-quiet", !picked);
  pullBtn.disabled = busy || !current;
}

function pullFromDraft() {
  if (mode !== "compose" || !current) return;
  const r = ed.getPullRange();
  if (!r) {
    toast("고른 글이 없습니다. 초안에서 가져올 글을 고르세요", true);
    return;
  }
  // 「준비됨」 줄이 걸렸으면 그 줄은 빼고 옮긴다
  let { from, text } = r;
  const lead = from === 0 ? READY_LEAD.exec(text) : null;
  if (lead) {
    from += lead[0].length;
    text = text.slice(lead[0].length);
  }
  if (!text.trim()) {
    toast("옮길 글이 없습니다. 「준비됨」 줄은 가져가지 않습니다", true);
    return;
  }
  // 조금이라도 겹치면 막는다. 더 넓게 고르면 이미 가져온 글이 한 번 더 들어간다
  const overlaps = ed.getPulled().some(p => p.from < r.to && p.to > from);
  if (overlaps) {
    toast("이미 가져온 글이 들어 있습니다. 다시 가져오려면 「표시 지우기」를 먼저 누르세요", true);
    return;
  }
  // 원문 그대로 넣는다. 문장을 만들거나 고치지 않는다
  const res = composer.pull(text);
  if (!res) return;
  ed.markPulled(from, r.to);
  renderProgress();
  if (res.kind === "title") {
    toast("초안의 소제목을 덩어리 제목으로 넣었습니다 — 결론 문장으로 고쳐 쓰면 됩니다");
  } else if (MEMO_MARK.test(text)) {
    toast("메모 표기(? ! +)가 그대로 들어왔습니다 — 왼쪽에서 풀어 쓰거나 지우세요");
  } else {
    toast(`${withRo(res.label)} 가져왔습니다`);
  }
}

function setMode(next) {
  mode = next;
  const composing = next === "compose";
  appEl.dataset.mode = next;
  composeEl.hidden = !composing;
  noteEl.hidden = !composing;
  decideBtn.hidden = composing;
  saveBtn.hidden = composing;
  readyBtn.hidden = composing;
  statusEl.hidden = composing;
  hintEl.textContent = composing ? composeHint : draftHint;
  render();
  renderPull();
}

async function enterCompose() {
  if (!current || busy) return;
  // 서버가 옮기는 건 저장된 글이다. 저장 안 된 변경이 있으면 화면과 어긋난다
  if (isDirty()) {
    toast("저장하지 않은 글이 있습니다. 먼저 저장하세요 (⌘S)", true);
    return;
  }
  if (!ed.getText().trim()) {
    toast("빈 메모는 초안으로 결정할 수 없습니다", true);
    return;
  }
  if (composeFor !== current.name) {
    composeFor = current.name;
    const d = readCompose(current.name);
    composer.setState(d);
    ed.clearPulled();
    if (d) {
      const stale = d.base && d.base !== current.sha;
      if (!stale && Array.isArray(d.pulled)) ed.setPulled(d.pulled);
      toast(
        "이 브라우저에 보관한 덩어리를 불러왔습니다" +
          (stale ? " · 초안이 그 뒤로 바뀌어서 가져온 표시는 지웠습니다" : "")
      );
    }
  }
  setMode("compose");
  renderProgress();
  composer.focusFirst();
}

function leaveCompose() {
  keepCompose();
  setMode("draft");
  decideBtn.focus();
}

/** 지금 덩어리를 브라우저에 보관한다. 쓴 게 없으면 보관한 것도 지운다 */
function keepCompose() {
  if (!composeFor) return;
  const st = composer.getState();
  const pulled = ed.getPulled();
  const metaFilled = Object.values(st.meta).some(v => v.trim());
  if (!hasContent(st.sections) && !metaFilled && !pulled.length) {
    dropCompose(composeFor);
    composeUnsafe = false;
    return;
  }
  const kept = storeCompose(composeFor, {
    ...st,
    pulled,
    base: current && current.name === composeFor ? current.sha : null,
    at: Date.now(),
  });
  composeUnsafe = !kept;
}

let composeTimer;
function onComposeInput() {
  clearTimeout(composeTimer);
  composeTimer = setTimeout(keepCompose, 400);
}

async function stash() {
  if (!current || busy || mode !== "compose") return;
  const st = composer.getState();
  if (!hasContent(st.sections)) {
    toast("쓴 글이 없습니다. 덩어리에 제목이나 본문을 채우세요", true);
    return;
  }
  const slug = st.meta.slug.trim();
  const problem = slugProblem(slug);
  if (problem) {
    composer.showSlug();
    toast(problem, true);
    return;
  }
  const text = composeManuscript(st.sections, {
    title: st.meta.title,
    description: st.meta.description,
    tags: parseTags(st.meta.tags),
  });
  if (!(await askStash($("#stash-sheet"), { path: `posts/${slug}.md`, text }))) return;

  const name = current.name;
  busy = true;
  statusEl.textContent = "원고로 저장하는 중…";
  render();
  try {
    const r = await api("POST", "/api/stash", { memo: name, sha: current.sha, slug, content: text });
    // 메모는 서버에서 published/ 로 옮겨졌다. 목록에서도 사라진다
    dropDraft(name);
    dropCompose(name);
    current = null;
    composeFor = null;
    composeUnsafe = false;
    loadText("");
    ed.clearPulled();
    composer.setState(null);
    setMode("draft");
    history.replaceState(null, "", location.pathname + location.search);
    statusEl.textContent = "";
    toast(`원고로 저장했습니다 — ${r.manuscript} · 초안은 ${withRo(r.moved)} 옮겼습니다`);
    loadList();
  } catch (e) {
    statusEl.textContent = "";
    toast(e.message, true);
  } finally {
    busy = false;
    render();
  }
}

// ── 이벤트 ──

let draftTimer;
function onInput() {
  render();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(keepDraft, 400);
}

document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (isDirty()) save();
  }
  if (mode === "compose" && e.altKey && e.key === "Enter") {
    e.preventDefault();
    pullFromDraft();
  }
});

window.addEventListener("beforeunload", e => {
  keepCompose();
  if (!isDirty() && !composeUnsafe) return;
  keepDraft();
  e.preventDefault();
  e.returnValue = "";
});

decideBtn.addEventListener("click", enterCompose);
$("#back").addEventListener("click", leaveCompose);
stashBtn.addEventListener("click", stash);
pullBtn.addEventListener("click", pullFromDraft);
unmarkBtn.addEventListener("click", () => {
  ed.clearPulled();
  renderProgress();
  onComposeInput();
});
dockBtn.addEventListener("click", () => {
  const closed = appEl.dataset.dock !== "closed";
  appEl.dataset.dock = closed ? "closed" : "open";
  dockBtn.textContent = closed ? "펴기" : "접기";
  dockBtn.setAttribute("aria-expanded", String(!closed));
});
saveBtn.addEventListener("click", () => save());
readyBtn.addEventListener("click", toggleReady);
newBtn.addEventListener("click", () => toggleNewForm(true));
$("#new-cancel").addEventListener("click", () => toggleNewForm(false));
newForm.addEventListener("submit", createMemo);

// ── 시작 ──

(async () => {
  render();
  await loadList();
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (fromHash && memos.some(m => m.name === fromHash)) openMemo(fromHash);
})();
