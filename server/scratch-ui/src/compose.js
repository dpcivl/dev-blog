// 「초안 결정 → 구조 다시 짜기」 — 왼쪽 칸 (2026-10-31~).
//
// 이 칸의 일은 하나다: 초안을 보면서 소제목 덩어리를 세우고 순서를 정하는 것.
// 문장은 만들어주지 않는다. 오른쪽 초안에서 가져올 때도 원문을 그대로 옮기고, 읽히게
// 고치는 건 여기서 사람이 손으로 한다.
//
// 스타일은 런타임에 만들지 않는다 (CSP style-src 'self'). 모양은 전부 app.css 의 클래스다.
// 진행 막대도 style="width:…" 가 아니라 <progress> 로 그린다 (app.js).

/** 서버(scratch_service.py 의 SLUG_RE)와 같은 규칙 — 보내기 전에 화면에서 먼저 거른다 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;

const blank = () => ({ title: "", body: "" });

// ── 순수 함수 (DOM 을 읽지 않는다) ──

/** 비어 있으면 "" 를, 규칙에 어긋나면 사람에게 보일 이유를 돌려준다 */
export function slugProblem(slug) {
  if (slug === undefined || slug === null || slug === "") return "slug 를 적으세요";
  // 서버도 문자열인지부터 본다 — 화면 검사가 느슨하면 400 을 보고서야 알게 된다
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return "소문자 · 숫자 · 하이픈만, 2~80자이고 하이픈으로 시작하거나 끝나면 안 됩니다";
  }
  return "";
}

/** 쉼표로 이어 적은 tags 입력을 배열로 */
export function parseTags(text) {
  return String(text ?? "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

export function hasContent(sections) {
  return (sections ?? []).some(s => `${s.title ?? ""}${s.body ?? ""}`.trim() !== "");
}

/** 공백을 뺀 글자 수와 문단 수 */
export function sectionStats(body) {
  const text = String(body ?? "");
  return {
    chars: text.replace(/\s/g, "").length,
    paras: text.split(/\n{2,}/).filter(p => p.trim()).length,
  };
}

const oneLine = v =>
  String(v ?? "")
    .replace(/\s*[\r\n]+\s*/g, " ")
    .trim();

/**
 * 앞말에 조사 「로/으로」 를 붙여 돌려준다. 받침이 없거나 ㄹ 이면 「로」, 그 밖의 받침은 「으로」.
 * 판정은 마지막 한글 음절로 하고, 「상황」 처럼 닫는 괄호가 뒤에 붙은 것은 건너뛴다.
 * 한글이 아니면 「로」 로 둔다 (published/x.md 로)
 */
export function withRo(word) {
  const s = String(word ?? "");
  const last = s.replace(/[\s」』)\]"'>]+$/, "").slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  const jong = code >= 0 && code <= 11171 ? code % 28 : 0;
  return `${s}${jong === 0 || jong === 8 ? "로" : "으로"}`;
}

/** frontmatter 값. 평범한 글은 그대로 두고, YAML 이 다르게 읽을 만한 것만 따옴표로 감싼다 */
function yamlScalar(v, inList = false) {
  const risky =
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(v) ||
    /:(\s|$)|\s#/.test(v) ||
    /^(true|false|null|yes|no|on|off|~|[-+]?\d[\d_.:e+-]*)$/i.test(v) ||
    // 0x1F · 0o17 · 0b101 · .inf · .nan · .5 는 숫자로, 2026-10-31 꼴은 날짜로 읽힌다
    /^[-+]?(0[xob][0-9a-f_]+|\.(inf|nan)|\.\d[\d_]*(e[-+]?\d+)?)$/i.test(v) ||
    /^\d{4}-\d{1,2}-\d{1,2}([Tt\s].*)?$/.test(v) ||
    (inList && /[,[\]{}]/.test(v));
  return risky ? JSON.stringify(v) : v;
}

/**
 * 덩어리와 글 정보로 원고 마크다운을 조립한다.
 *
 * - 작성자가 채운 칸만 frontmatter 에 적는다. 빈 칸은 줄째 뺀다 — 자리표시자를 글자로
 *   박으면 그대로 배포된다 (CLAUDE.md 9번)
 * - pubDatetime 을 쓰지 않는다. 발행 시점에 세션이 정한다. 미래 시각이 박히면
 *   isPublishTimePassed 에 걸려 production 빌드에서 조용히 빠진다
 * - 제목도 본문도 비어 있는 덩어리는 건너뛴다
 *
 * @param {{ title?: string, body?: string }[]} sections
 * @param {{ title?: string, description?: string, tags?: string[] | string }} [meta]
 */
export function composeManuscript(sections, meta = {}) {
  const title = oneLine(meta?.title);
  const description = oneLine(meta?.description);
  const tags = (Array.isArray(meta?.tags) ? meta.tags.map(oneLine) : parseTags(meta?.tags)).filter(Boolean);

  const fm = [];
  if (title) fm.push(`title: ${yamlScalar(title)}`);
  if (description) fm.push(`description: ${yamlScalar(description)}`);
  if (tags.length) fm.push(`tags: [${tags.map(t => yamlScalar(t, true)).join(", ")}]`);

  const blocks = [];
  for (const s of sections ?? []) {
    const t = oneLine(s?.title);
    const b = String(s?.body ?? "")
      .replace(/\r\n?/g, "\n")
      .trim();
    if (!t && !b) continue;
    blocks.push(t ? (b ? `## ${t}\n\n${b}` : `## ${t}`) : b);
  }

  const head = fm.length ? `---\n${fm.join("\n")}\n---\n` : "";
  if (!blocks.length) return head;
  return `${head ? `${head}\n` : ""}${blocks.join("\n\n")}\n`;
}

// ── 브라우저 보관 ──
// 덩어리를 짜다 창을 닫아도 잃지 않게 한다. 기존 scratch:draft:<name> (본문 문자열) 은
// 건드리지 않는다 — 초안 모드는 그대로 그걸 쓴다.

const composeKey = name => `scratch:compose:${name}`;

/** 보관했으면 true. 사생활 보호 모드 등에서는 저장소가 막혀 있다 */
export function storeCompose(name, data) {
  try {
    localStorage.setItem(composeKey(name), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readCompose(name) {
  try {
    const d = JSON.parse(localStorage.getItem(composeKey(name)) || "null");
    const ok =
      d &&
      Array.isArray(d.sections) &&
      d.sections.length > 0 &&
      d.sections.every(s => s && typeof s.title === "string" && typeof s.body === "string");
    return ok ? d : null;
  } catch {
    return null;
  }
}

export function dropCompose(name) {
  try {
    localStorage.removeItem(composeKey(name));
  } catch {
    /* 보관만 못 할 뿐 */
  }
}

// ── 미리보기 ──
// 읽히는지 보려는 것이라 작은 렌더러로 충분하다: 제목 · 문단 · 목록 · 코드 · 이미지.
// 글자는 전부 textContent 로 넣는다 (메모에 든 HTML 을 해석하지 않는다)

function buildPreview(title, sections) {
  const out = [];
  const h1 = document.createElement("h2");
  h1.className = "prose-title";
  h1.textContent = title || "(제목 없음)";
  if (!title) h1.classList.add("thin");
  out.push(h1);

  for (const s of sections) {
    if (s.title.trim()) {
      const h = document.createElement("h2");
      h.textContent = s.title.trim();
      out.push(h);
    }
    out.push(...blocksOf(s.body));
    if (!s.title.trim() && !s.body.trim()) {
      const p = document.createElement("p");
      p.className = "thin";
      p.textContent = "(빈 덩어리)";
      out.push(p);
    }
  }
  return out;
}

function blocksOf(body) {
  const out = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let para = [];
  // 목록은 들여쓰기로 중첩된다. 들여쓰기 폭을 2칸이나 4칸으로 못박지 않고
  // 스택으로 따라간다 — 더 깊어지면 밀어넣고 얕아지면 그만큼 꺼낸다
  const stack = [];
  const flush = () => {
    if (para.length) {
      const p = document.createElement("p");
      p.textContent = para.join("\n");
      out.push(p);
      para = [];
    }
    stack.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const code = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      const pre = document.createElement("pre");
      pre.textContent = code.join("\n");
      out.push(pre);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const img = /^!\[[^\]]*\]\(\s*<?([^)\s>]+)/.exec(line.trim());
    if (img) {
      flush();
      const ph = document.createElement("span");
      ph.className = "ph";
      ph.textContent = `이미지 · ${img[1]}`;
      out.push(ph);
      continue;
    }
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      flush();
      const el = document.createElement(h[1].length <= 2 ? "h2" : "h3");
      el.textContent = h[2];
      out.push(el);
      continue;
    }
    const li = /^([ \t]*)[-*+][ \t]+(.+)$/.exec(line);
    if (li) {
      // 탭은 네 칸으로 센다
      const indent = li[1].replace(/\t/g, "    ").length;
      if (!stack.length) {
        flush();
        const ul = document.createElement("ul");
        out.push(ul);
        stack.push({ indent, ul });
      } else {
        while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
        const top = stack[stack.length - 1];
        if (indent > top.indent) {
          // 중첩 목록은 바로 위 항목 안에 들어간다. 첫 줄부터 깊으면 붙일 항목이 없다
          const ul = document.createElement("ul");
          (top.ul.lastElementChild || top.ul).append(ul);
          stack.push({ indent, ul });
        }
      }
      const item = document.createElement("li");
      item.textContent = li[2];
      stack[stack.length - 1].ul.append(item);
      continue;
    }
    stack.length = 0;
    para.push(line);
  }
  flush();
  return out;
}

// ── 화면 ──

/** 소제목 줄 하나. 덩어리 제목이 비어 있을 때만 제목 자리로 간다 */
const HEADING_LINE = /^#{1,6}[ \t]+(\S.*)$/;

/**
 * @param {HTMLElement} root  #compose
 * @param {{ onChange: () => void, onActive: (label: string) => void, onSkeleton: () => void }} hooks
 */
export function createCompose(root, hooks) {
  const q = s => root.querySelector(s);
  const sectionsEl = q("#sections");
  const proseEl = q("#prose");
  const addBtn = q("#add");
  const infoEl = q("#info");
  const inputs = {
    title: q("#title"),
    description: q("#desc"),
    slug: q("#slug"),
    tags: q("#tags"),
  };
  const slugNote = q("#slug-note");

  let sections = [blank()];
  let active = 0;
  let view = "write";

  const secEl = i => sectionsEl.querySelector(`.sec[data-i="${i}"]`);
  const labelOf = i =>
    sections[i] && sections[i].title.trim() ? `「${sections[i].title.trim()}」` : `${i + 1}번째 덩어리`;

  function changed() {
    renderPreview();
    hooks.onChange();
  }

  function renderSections(focus) {
    sectionsEl.replaceChildren(
      ...sections.map((s, i) => {
        const art = document.createElement("article");
        art.className = "sec";
        art.dataset.i = String(i);
        if (i === active) art.setAttribute("aria-current", "true");
        art.addEventListener("focusin", () => setActive(i));
        art.addEventListener("click", e => {
          if (!e.target.closest(".ico")) setActive(i);
        });

        const head = document.createElement("header");
        head.className = "sec-head";

        const n = document.createElement("span");
        n.className = "sec-n";
        n.textContent = `${i + 1}.`;

        const title = document.createElement("input");
        title.className = "sec-title";
        title.type = "text";
        title.value = s.title;
        title.placeholder = "소제목 — 주제어 말고 결론 문장으로";
        title.setAttribute("aria-label", `${i + 1}번째 소제목`);
        title.addEventListener("input", () => {
          s.title = title.value;
          if (i === active) hooks.onActive(labelOf(i));
          changed();
        });

        const here = document.createElement("span");
        here.className = "here";
        here.textContent = "여기로";

        head.append(
          n,
          title,
          here,
          iconButton("↑", "위로", () => move(i, -1), i === 0),
          iconButton("↓", "아래로", () => move(i, 1), i === sections.length - 1),
          iconButton("×", "덩어리 지우기", () => remove(i), sections.length === 1)
        );

        const body = document.createElement("textarea");
        body.className = "sec-body";
        body.value = s.body;
        body.placeholder = "오른쪽에서 ◀ 로 가져오거나 직접 쓰세요";
        body.spellcheck = false;
        body.setAttribute("aria-label", `${i + 1}번째 덩어리 본문`);
        body.addEventListener("input", () => {
          s.body = body.value;
          renderCounts();
          changed();
        });

        const foot = document.createElement("p");
        foot.className = "sec-foot";

        art.append(head, body, foot);
        return art;
      })
    );
    renderCounts();
    if (focus) secEl(focus.i)?.querySelector(`.${focus.which}`)?.focus();
    hooks.onActive(labelOf(active));
  }

  function iconButton(label, aria, fn, disabled) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ico";
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    b.disabled = !!disabled;
    b.addEventListener("click", fn);
    return b;
  }

  function renderCounts() {
    sections.forEach((s, i) => {
      const foot = secEl(i)?.querySelector(".sec-foot");
      if (!foot) return;
      const { chars, paras } = sectionStats(s.body);
      foot.textContent = chars ? `${paras}문단 · ${chars}자` : "비어 있습니다";
    });
  }

  function setActive(i) {
    if (active === i) return;
    active = i;
    for (const el of sectionsEl.querySelectorAll(".sec")) {
      if (Number(el.dataset.i) === i) el.setAttribute("aria-current", "true");
      else el.removeAttribute("aria-current");
    }
    hooks.onActive(labelOf(i));
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    [sections[i], sections[j]] = [sections[j], sections[i]];
    active = j;
    renderSections({ i: j, which: "sec-title" });
    changed();
  }

  function remove(i) {
    if (sections.length === 1) return;
    const s = sections[i];
    if ((s.title || s.body).trim() && !confirm("쓴 게 있습니다. 이 덩어리를 지울까요?")) return;
    sections.splice(i, 1);
    active = Math.min(active, sections.length - 1);
    renderSections();
    changed();
  }

  addBtn.addEventListener("click", () => {
    sections.push(blank());
    active = sections.length - 1;
    renderSections({ i: active, which: "sec-title" });
    changed();
  });

  for (const b of root.querySelectorAll("[data-skel]")) {
    b.addEventListener("click", () => {
      const titles = b.dataset.skel ? b.dataset.skel.split(",") : [];
      if (hasContent(sections) && !confirm("쓴 게 있습니다. 뼈대로 갈아끼울까요?")) return;
      sections = (titles.length ? titles : [""]).map(t => ({ title: t, body: "" }));
      active = 0;
      renderSections();
      // 갈아끼운 덩어리에는 가져온 글이 없으므로 오른쪽의 가져온 표시도 걷는다
      hooks.onSkeleton();
      changed();
    });
  }

  // ── 보기 ──

  function setView(v) {
    view = v;
    root.dataset.view = v;
    for (const b of root.querySelectorAll(".views button")) {
      b.setAttribute("aria-pressed", String(b.dataset.view === v));
    }
    sectionsEl.hidden = v === "read";
    proseEl.hidden = v !== "read";
    addBtn.hidden = v !== "write";
    renderPreview();
  }

  for (const b of root.querySelectorAll(".views button")) {
    b.addEventListener("click", () => setView(b.dataset.view));
  }

  function renderPreview() {
    if (view !== "read") return;
    proseEl.replaceChildren(...buildPreview(inputs.title.value.trim(), sections));
  }

  // ── 글 정보 ──

  function renderSlugNote() {
    const slug = inputs.slug.value.trim();
    const problem = slug ? slugProblem(slug) : "";
    slugNote.textContent = problem || `posts/${slug || "<slug>"}.md`;
    slugNote.classList.toggle("is-bad", !!problem);
    inputs.slug.toggleAttribute("aria-invalid", !!problem);
  }

  for (const el of Object.values(inputs)) el.addEventListener("input", changed);
  inputs.slug.addEventListener("input", renderSlugNote);

  // ── 바깥에 내놓는 것 ──

  setView("write");
  renderSections();

  return {
    getState: () => ({
      sections: sections.map(s => ({ title: s.title, body: s.body })),
      active,
      meta: {
        title: inputs.title.value,
        description: inputs.description.value,
        slug: inputs.slug.value,
        tags: inputs.tags.value,
      },
    }),

    /** 보관해둔 상태를 되살리거나(state), 새로 시작한다(null) */
    setState(state) {
      sections = state ? state.sections.map(s => ({ title: s.title, body: s.body })) : [blank()];
      active = state && Number.isInteger(state.active) ? Math.min(Math.max(state.active, 0), sections.length - 1) : 0;
      const m = (state && state.meta) || {};
      for (const k of Object.keys(inputs)) inputs[k].value = typeof m[k] === "string" ? m[k] : "";
      renderSections();
      renderSlugNote();
      renderPreview();
    },

    /**
     * 초안에서 고른 글을 지금 덩어리로 옮긴다. 문장을 만들거나 고치지 않는다.
     * 앞뒤 빈 줄만 다듬는다. 소제목 줄 하나이고 덩어리 제목이 비어 있으면 제목 자리로 간다
     * @returns {{ kind: "title" | "body", label: string } | null}
     */
    pull(text) {
      const clean = text.replace(/\r\n?/g, "\n").replace(/^\n+/, "").replace(/\s+$/, "");
      if (!clean) return null;
      const sec = sections[active];
      const h = HEADING_LINE.exec(clean);
      let kind = "body";
      if (h && !sec.title.trim()) {
        kind = "title";
        sec.title = h[1].trim();
        const input = secEl(active)?.querySelector(".sec-title");
        if (input) input.value = sec.title;
        hooks.onActive(labelOf(active));
      } else {
        sec.body = (sec.body ? sec.body.replace(/\n*$/, "\n\n") : "") + clean;
        const ta = secEl(active)?.querySelector(".sec-body");
        if (ta) {
          ta.value = sec.body;
          ta.scrollTop = ta.scrollHeight;
        }
        renderCounts();
      }
      changed();
      return { kind, label: labelOf(active) };
    },

    focusFirst: () => secEl(active)?.querySelector(".sec-title")?.focus(),

    /** 보낼 때 slug 가 틀렸으면 글 정보를 열고 그 칸으로 데려간다 */
    showSlug() {
      infoEl.open = true;
      inputs.slug.focus();
    },
  };
}

// ── 원고로 저장 확인 시트 ──

/**
 * 어떤 파일이 어디로 가는지 보여주고 묻는다. 닫으면(Esc 포함) false
 * @param {HTMLDialogElement} dlg
 */
export function askStash(dlg, { path, text }) {
  return new Promise(resolve => {
    dlg.querySelector("#sheet-path").textContent = path;
    dlg.querySelector("#sheet-file").textContent = text;
    let ok = false;
    dlg.querySelector("#sheet-ok").onclick = () => {
      ok = true;
      dlg.close();
    };
    dlg.querySelector("#sheet-cancel").onclick = () => dlg.close();
    dlg.addEventListener("close", () => resolve(ok), { once: true });
    dlg.showModal();
  });
}
