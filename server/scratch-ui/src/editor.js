// CodeMirror 6 편집기 조립. 화면 코드(app.js)는 이 파일이 내놓는 함수만 쓴다.
//
// 스타일은 런타임에 끼워 넣지 않는다. 이 사이트의 CSP 는 style-src 'self' 라서
// 강조 색은 tagHighlighter 로 "고정 클래스 이름" 만 붙이고, 모양은 app.css 에 쓴다.
// (CodeMirror 의 기본 배치 스타일만 자체적으로 들어간다 — 시험에서 CSP 를 걸고 확인)

import { history, defaultKeymap, historyKeymap, indentWithTab, isolateHistory } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, drawSelection, EditorView, keymap, placeholder } from "@codemirror/view";
import { tagHighlighter, tags as t } from "@lezer/highlight";
import { livePreview, seedImage } from "./live-preview.js";

const mdClasses = tagHighlighter([
  { tag: t.heading, class: "md-heading" },
  { tag: t.strong, class: "md-strong" },
  { tag: t.emphasis, class: "md-em" },
  { tag: t.strikethrough, class: "md-strike" },
  { tag: t.link, class: "md-link" },
  { tag: t.url, class: "md-url" },
  { tag: t.monospace, class: "md-code" },
  { tag: t.processingInstruction, class: "md-mark" },
  { tag: t.comment, class: "md-comment" },
  { tag: t.quote, class: "md-quote" },
  { tag: t.contentSeparator, class: "md-mark" },
]);

// ── 가져온 범위 (초안 결정 화면) ──
// 오른쪽 초안에서 왼쪽 덩어리로 옮긴 범위를 기억해서 흐리게 칠한다. 문서의 글자는 건드리지
// 않고 데코레이션만 얹는다. 위치는 문서가 바뀌면 따라 움직인다.

const setPulledRanges = StateEffect.define();
const pulledMark = Decoration.mark({ class: "cm-md-pulled" });

/** 겹치거나 맞닿은 범위를 하나로 합쳐 정렬한다 */
function mergeRanges(ranges) {
  const sorted = ranges
    .filter(r => r.to > r.from)
    .map(r => ({ from: r.from, to: r.to }))
    .sort((a, b) => a.from - b.from);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
    else out.push(r);
  }
  return out;
}

const pulledField = StateField.define({
  create: () => [],
  update(ranges, tr) {
    let next = ranges;
    if (tr.docChanged) {
      next = mergeRanges(
        next.map(r => ({ from: tr.changes.mapPos(r.from, 1), to: tr.changes.mapPos(r.to, -1) }))
      );
    }
    for (const e of tr.effects) if (e.is(setPulledRanges)) next = mergeRanges(e.value);
    return next;
  },
  provide: f =>
    EditorView.decorations.from(f, ranges =>
      Decoration.set(ranges.map(r => pulledMark.range(r.from, r.to)))
    ),
});

/**
 * @param {HTMLElement} parent
 * @param {{ onChange: () => void, onFiles: (files: File[]) => void, onSelection?: () => void }} hooks
 */
export function createEditor(parent, hooks) {
  const editable = new Compartment();
  // CodeMirror 는 기본 배치 스타일을 <style> 로 끼워 넣는다. CSP(style-src 'self') 가
  // 이걸 막아서 처음엔 편집 칸이 통째로 깨졌다. nginx 가 요청마다 만든 nonce 를
  // 붙이면 이 스타일만 통과한다
  const nonce = document.querySelector('meta[name="csp-nonce"]')?.content;
  const extensions = [
    ...(nonce && nonce !== "__CSP_NONCE__" ? [EditorView.cspNonce.of(nonce)] : []),
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    // GFM(표 · 취소선 · 할 일 목록) 포함. Enter 로 목록이 이어지고 Backspace 로 빠진다
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(mdClasses),
    livePreview,
    pulledField,
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    editable.of(EditorView.editable.of(false)),
    placeholder("왼쪽에서 메모를 고르거나 새로 만드세요."),
    EditorView.contentAttributes.of({ "aria-label": "메모 본문", spellcheck: "false" }),
    EditorView.updateListener.of(u => {
      if (u.docChanged) hooks.onChange();
      if (u.selectionSet && hooks.onSelection) hooks.onSelection();
    }),
    EditorView.domEventHandlers({
      paste(e) {
        const files = imagesOf(e.clipboardData && e.clipboardData.files);
        if (!files.length) return false;
        e.preventDefault();
        hooks.onFiles(files);
        return true;
      },
      drop(e, view) {
        const files = imagesOf(e.dataTransfer && e.dataTransfer.files);
        if (!files.length) return false;
        e.preventDefault();
        // 놓은 자리로 커서를 옮긴 뒤 넣는다
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos !== null) view.dispatch({ selection: { anchor: pos } });
        hooks.onFiles(files);
        return true;
      },
    }),
  ];

  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: "", extensions }),
  });

  return {
    getText: () => view.state.doc.toString(),

    /** 다른 메모를 열 때. 되돌리기 기록도 새로 시작한다 — 메모를 넘나들며 되돌리지 않게 */
    setText(text) {
      view.setState(EditorState.create({ doc: text, extensions }));
      // 상태를 갈아끼워도 스크롤 위치는 남는다. 긴 메모를 아래까지 본 뒤 다른 메모를
      // 열면 중간부터 보였다. scrollTop 을 직접 바꾸면 CodeMirror 가 다시 재면서
      // 되돌려서, CodeMirror 의 스크롤 명령으로 맨 위로 보낸다
      view.dispatch({ effects: EditorView.scrollIntoView(0, { y: "start", yMargin: 200 }) });
    },

    setEditable(on) {
      view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(on)) });
    },

    /**
     * 지금 커서 자리에 넣는다. 되돌리기 한 번에 이것만 빠지도록 따로 떼어 둔다
     * (textarea 시절에는 ⌘Z 로 붙여넣은 이미지가 안 지워졌다)
     */
    insert(text) {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        annotations: isolateHistory.of("full"),
        userEvent: "input.paste",
        scrollIntoView: true,
      });
    },

    /** 맨 앞에 붙이거나(준비됨) 맨 앞 줄을 뗀다 — 이것도 되돌리기 한 단위 */
    prependLine(line) {
      view.dispatch({
        changes: { from: 0, insert: `${line}\n` },
        annotations: isolateHistory.of("full"),
      });
    },
    removeFirstLine(re) {
      const first = view.state.doc.line(1);
      if (!re.test(first.text)) return false;
      const to = view.state.doc.lines > 1 ? first.to + 1 : first.to;
      view.dispatch({ changes: { from: 0, to }, annotations: isolateHistory.of("full") });
      return true;
    },

    /** 고른 글. 고른 게 없으면 빈 문자열 */
    getSelectionText() {
      const { from, to } = view.state.selection.main;
      return from === to ? "" : view.state.sliceDoc(from, to);
    },

    /**
     * 가져올 범위. 고른 데가 있으면 그만큼, 없으면 커서가 있는 줄. 빈 줄이면 null
     * (산문에서 줄 경계는 자의적이라 기본은 고른 만큼이다)
     */
    getPullRange() {
      const { from, to } = view.state.selection.main;
      if (from !== to) return { from, to, text: view.state.sliceDoc(from, to) };
      const line = view.state.doc.lineAt(from);
      return line.text.trim() ? { from: line.from, to: line.to, text: line.text } : null;
    },

    /** 옮겨 간 범위를 흐리게. 겹치면 합친다 */
    markPulled(from, to) {
      const ranges = view.state.field(pulledField);
      view.dispatch({ effects: setPulledRanges.of([...ranges, { from, to }]) });
    },
    getPulled: () => view.state.field(pulledField).map(r => ({ ...r })),
    /** 보관해둔 범위를 되살린다. 문서 길이를 넘는 값은 잘라낸다 */
    setPulled(ranges) {
      const len = view.state.doc.length;
      view.dispatch({
        effects: setPulledRanges.of(
          ranges.map(r => ({ from: Math.min(r.from, len), to: Math.min(r.to, len) }))
        ),
      });
    },
    clearPulled: () => view.dispatch({ effects: setPulledRanges.of([]) }),

    seedImage,
    focus: () => view.focus(),
  };
}

const imagesOf = list => [...(list || [])].filter(f => f.type.startsWith("image/"));
