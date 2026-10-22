// Typora · Obsidian 처럼 쓰는 칸에서 바로 서식이 보이게 한다 (2026-10-22~).
//
// 원칙: 문서의 글자는 절대 바꾸지 않는다. 커서가 없는 줄에서만 기호(# ** ` > 등)를
// 숨기고 제목을 키우고 이미지를 그려서 "보이는 모양" 만 덧씌운다. 커서가 그 줄로
// 들어오면 기호가 다시 보인다. 마크다운을 다른 구조로 바꿨다가 다시 써내는 단계가
// 없으므로, 저장되는 글자는 입력한 글자와 정확히 같다 — 맥북에서 VS Code 로 고치는
// 원문과 어긋날 일이 없다.

import { syntaxTree } from "@codemirror/language";
import { RangeSet } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";

const hide = Decoration.replace({});

/** 이미지 하나는 세션 동안 한 번만 받는다. 위젯은 커서가 움직일 때마다 다시 그려진다 */
const imageCache = new Map();

/** 방금 붙여넣은 이미지는 받을 필요 없이 바로 보여준다 */
export function seedImage(src, blobUrl) {
  imageCache.set(src, Promise.resolve(blobUrl));
}

function loadImage(src) {
  if (!imageCache.has(src)) {
    const path = safeDecode(src);
    const p = fetch(`/api/asset?path=${encodeURIComponent(path)}`)
      .then(r => {
        if (!r.ok) throw new Error(`이미지 응답 ${r.status}`);
        return r.blob();
      })
      .then(b => URL.createObjectURL(b));
    // 실패한 건 기억하지 않는다 — 다음에 다시 시도하게
    p.catch(() => imageCache.delete(src));
    imageCache.set(src, p);
  }
  return imageCache.get(src);
}

function safeDecode(s) {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

class ImageWidget extends WidgetType {
  constructor(src, alt) {
    super();
    this.src = src;
    this.alt = alt;
  }
  eq(o) {
    return o.src === this.src && o.alt === this.alt;
  }
  toDOM(view) {
    const wrap = document.createElement("span");
    wrap.className = "cm-md-img";
    // 바깥 주소는 CSP(img-src 'self') 가 막는다. 저장소 안의 이미지만 그린다
    if (/^[a-z]+:\/\//i.test(this.src) || this.src.startsWith("//")) {
      wrap.classList.add("is-note");
      wrap.textContent = `바깥 이미지는 미리보기를 안 합니다 · ${this.src}`;
      return wrap;
    }
    // 처음 보는 이미지는 서비스가 GitHub 에서 받아오느라 1~2초 걸린다. 그동안 빈칸 대신
    // 자리표시를 보인다
    wrap.classList.add("is-loading");
    const note = document.createElement("span");
    note.className = "cm-md-img-note";
    note.textContent = "이미지 불러오는 중…";
    const img = document.createElement("img");
    img.alt = this.alt || "";
    img.onload = () => {
      wrap.classList.remove("is-loading");
      note.remove();
      view.requestMeasure();
    };
    wrap.append(note, img);
    loadImage(this.src)
      .then(url => (img.src = url))
      .catch(() => {
        wrap.classList.remove("is-loading");
        wrap.classList.add("is-note");
        wrap.textContent = `이미지를 불러오지 못했습니다 · ${this.src}`;
        view.requestMeasure();
      });
    return wrap;
  }
  // 이미지를 누르면 그 줄로 커서가 가서 원문이 보이게 한다
  ignoreEvent() {
    return false;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-md-bullet";
    s.textContent = "•";
    return s;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-md-hr";
    return s;
  }
}

class ReadyWidget extends WidgetType {
  constructor(label) {
    super();
    this.label = label;
  }
  eq(o) {
    return o.label === this.label;
  }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-md-ready";
    s.textContent = this.label;
    return s;
  }
}

/** 선택 영역이 걸친 줄 번호들 — 이 줄들은 원문을 그대로 보여준다 */
function activeLines(state) {
  const lines = new Set();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) lines.add(n);
  }
  return lines;
}

function build(view) {
  const { state } = view;
  const doc = state.doc;
  const active = activeLines(state);
  const isActive = pos => active.has(doc.lineAt(pos).number);
  const decos = [];
  const lineClass = (pos, cls) =>
    decos.push(Decoration.line({ class: cls }).range(doc.lineAt(pos).from));
  // 블록에 걸친 모든 줄에 같은 클래스를 단다 (인용 · 코드 블록)
  const eachLine = (from, to, cls) => {
    for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) {
      decos.push(Decoration.line({ class: cls }).range(doc.line(n).from));
    }
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: node => {
        const name = node.name;

        // 제목: 줄 크기는 늘 키우고, # 는 커서가 없을 때만 숨긴다
        const h = /^ATXHeading(\d)$/.exec(name);
        if (h) {
          lineClass(node.from, `cm-md-h cm-md-h${h[1]}`);
          return;
        }
        if (name === "HeaderMark") {
          if (!isActive(node.from) && node.node.parent?.name.startsWith("ATXHeading")) {
            const after = doc.sliceString(node.to, node.to + 1) === " " ? 1 : 0;
            decos.push(hide.range(node.from, node.to + after));
          }
          return;
        }

        // 강조 · 취소선 · 인라인 코드의 기호
        if (name === "EmphasisMark" || name === "StrikethroughMark") {
          if (!isActive(node.from)) decos.push(hide.range(node.from, node.to));
          return;
        }
        if (name === "InlineCode") {
          decos.push(Decoration.mark({ class: "cm-md-inline-code" }).range(node.from, node.to));
          return;
        }
        if (name === "CodeMark") {
          const parent = node.node.parent?.name;
          if (parent === "InlineCode" && !isActive(node.from)) {
            decos.push(hide.range(node.from, node.to));
          }
          return;
        }

        // 코드 블록은 숨기지 않는다 — 줄마다 배경만
        if (name === "FencedCode" || name === "CodeBlock") {
          eachLine(node.from, node.to, "cm-md-codeblock");
          return false;
        }

        // 인용
        if (name === "Blockquote") {
          eachLine(node.from, node.to, "cm-md-quote");
          return;
        }
        if (name === "QuoteMark") {
          if (!isActive(node.from)) {
            const after = doc.sliceString(node.to, node.to + 1) === " " ? 1 : 0;
            decos.push(hide.range(node.from, node.to + after));
          }
          return;
        }

        // 목록: - * + 는 점으로, 번호 목록은 그대로
        if (name === "ListMark") {
          const list = node.node.parent?.parent?.name;
          if (list === "BulletList" && !isActive(node.from)) {
            decos.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
          }
          return;
        }

        // 가로줄
        if (name === "HorizontalRule") {
          if (!isActive(node.from)) {
            decos.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
          }
          return;
        }

        // 이미지: 커서가 없으면 원문 대신 그림, 있으면 원문 뒤에 그림
        if (name === "Image") {
          const text = doc.sliceString(node.from, node.to);
          const m = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/.exec(text);
          if (m) {
            const widget = new ImageWidget(m[2], m[1]);
            if (isActive(node.from)) {
              decos.push(Decoration.widget({ widget, side: 1 }).range(node.to));
            } else {
              decos.push(Decoration.replace({ widget }).range(node.from, node.to));
            }
          }
          return false;
        }

        // 링크: 커서가 없으면 [ ] ( 주소 ) 를 숨기고 글자만
        if (name === "Link") {
          const active = isActive(node.from);
          let cur = node.node.firstChild;
          let textFrom = -1;
          let textTo = -1;
          while (cur) {
            if (cur.name === "LinkMark") {
              const mark = doc.sliceString(cur.from, cur.to);
              if (mark === "[") textFrom = cur.to;
              if (mark === "]") textTo = cur.from;
              if (!active) decos.push(hide.range(cur.from, cur.to));
            } else if ((cur.name === "URL" || cur.name === "LinkTitle") && !active) {
              decos.push(hide.range(cur.from, cur.to));
            }
            cur = cur.nextSibling;
          }
          if (textFrom >= 0 && textTo > textFrom) {
            decos.push(Decoration.mark({ class: "cm-md-link" }).range(textFrom, textTo));
          }
          return false;
        }

        // 맨 윗줄의 「준비됨」 표시는 알약 모양으로
        if (name === "CommentBlock" || name === "Comment") {
          const line = doc.lineAt(node.from);
          const m = /^<!-- ✅ 준비됨(?: \(([^)]*)\))? -->\s*$/.exec(line.text);
          if (m && !isActive(node.from) && node.from === line.from) {
            const label = m[1] ? `✅ 준비됨 · ${m[1]}` : "✅ 준비됨";
            decos.push(Decoration.replace({ widget: new ReadyWidget(label) }).range(line.from, line.to));
          }
          return;
        }
        return undefined;
      },
    });
  }
  return RangeSet.of(decos, true);
}

export const livePreview = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = build(view);
    }
    update(u) {
      if (
        u.docChanged ||
        u.viewportChanged ||
        u.selectionSet ||
        syntaxTree(u.startState) !== syntaxTree(u.state)
      ) {
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: v => v.decorations }
);
