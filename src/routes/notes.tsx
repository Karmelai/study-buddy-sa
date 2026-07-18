import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  BookOpen,
  Bold,
  CheckSquare,
  ChevronRight,
  FilePlus2,
  Heading1,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  PanelLeft,
  PanelRight,
  Plus,
  StickyNote,
  Underline,
  X,
  Bot,
  Code2,
  Sigma,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { SmartNotesChat } from "@/components/SmartNotesChat";
import { supabase } from "@/lib/supabase";
import {
  normalizeSmartNoteIds,
  SMART_EXTRACT_DRAFT_KEY,
  type SmartExtractDraft,
} from "@/lib/smartNotes";
import { useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Smart Notes - KARMEL" }] }),
  component: SmartNotesPage,
});
type NotePage = { id: string; title: string; content: string };
type NoteSection = { id: string; title: string; pages: NotePage[] };
type Notebook = { id: string; title: string; sections: NoteSection[] };
type SmartNoteRow = {
  id: string;
  parent_id: string | null;
  node_type: "notebook" | "section" | "page";
  title: string;
  content: string | null;
  position: number;
};
type DeleteTarget =
  | { kind: "notebook"; notebookId: string; title: string }
  | { kind: "section"; notebookId: string; sectionId: string; title: string }
  | { kind: "page"; notebookId: string; sectionId: string; pageId: string; title: string };
const STORAGE_KEY = "karmel-smart-notes";
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const makeStarter = (): Notebook[] => {
  const page = {
    id: makeId(),
    title: "Welcome to Smart Notes",
    content:
      "<h1>Welcome to Smart Notes</h1><p>Create notebooks for each subject, organise them into sections, then write freely on each page.</p><p>Use the toolbar for headings, lists, and checklists.</p>",
  };
  return [
    {
      id: makeId(),
      title: "My first notebook",
      sections: [{ id: makeId(), title: "Getting started", pages: [page] }],
    },
  ];
};
const firstSelection = (notebooks: Notebook[]) => ({
  notebookId: notebooks[0]?.id ?? "",
  sectionId: notebooks[0]?.sections[0]?.id ?? "",
  pageId: notebooks[0]?.sections[0]?.pages[0]?.id ?? "",
});
const flattenNotebooks = (notebooks: Notebook[]): SmartNoteRow[] =>
  notebooks.flatMap((notebook, notebookPosition) => [
    {
      id: notebook.id,
      parent_id: null,
      node_type: "notebook" as const,
      title: notebook.title,
      content: null,
      position: notebookPosition,
    },
    ...notebook.sections.flatMap((section, sectionPosition) => [
      {
        id: section.id,
        parent_id: notebook.id,
        node_type: "section" as const,
        title: section.title,
        content: null,
        position: sectionPosition,
      },
      ...section.pages.map((page, pagePosition) => ({
        id: page.id,
        parent_id: section.id,
        node_type: "page" as const,
        title: page.title,
        content: page.content || null,
        position: pagePosition,
      })),
    ]),
  ]);
const buildNotebooks = (rows: SmartNoteRow[]): Notebook[] => {
  const sections = new Map<string, NoteSection>();
  const notebooks = rows
    .filter((row) => row.node_type === "notebook")
    .sort((left, right) => left.position - right.position)
    .map((row) => ({ id: row.id, title: row.title, sections: [] }));
  const notebooksById = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
  rows
    .filter((row) => row.node_type === "section")
    .sort((left, right) => left.position - right.position)
    .forEach((row) => {
      const section = { id: row.id, title: row.title, pages: [] };
      sections.set(row.id, section);
      notebooksById.get(row.parent_id ?? "")?.sections.push(section);
    });
  rows
    .filter((row) => row.node_type === "page")
    .sort((left, right) => left.position - right.position)
    .forEach((row) => {
      sections
        .get(row.parent_id ?? "")
        ?.pages.push({ id: row.id, title: row.title, content: row.content ?? "" });
    });
  return notebooks;
};

function SmartNotesPage() {
  const navigate = useNavigate();
  const userId = useKarmelStore((state) => state.userId);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selected, setSelected] = useState({ notebookId: "", sectionId: "", pageId: "" });
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saved" | "offline" | "error">(
    "loading",
  );
  const [isNotebookPanelOpen, setIsNotebookPanelOpen] = useState(true);
  const [isSectionPanelOpen, setIsSectionPanelOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [explainRequest, setExplainRequest] = useState<{ id: string; text: string } | null>(null);
  const [isEquationOpen, setIsEquationOpen] = useState(false);
  const [equationLatex, setEquationLatex] = useState("");
  const [expandedNotebookIds, setExpandedNotebookIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{ x: number; y: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const formattingToolbarRef = useRef<HTMLDivElement>(null);
  const selectedRangeRef = useRef<Range | null>(null);
  const contentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const next = stored ? normalizeSmartNoteIds(JSON.parse(stored) as Notebook[]) : makeStarter();
      const usable = next.length ? next : makeStarter();
      setNotebooks(usable);
      setSelected(firstSelection(usable));
      setExpandedNotebookIds(usable[0] ? [usable[0].id] : []);
    } catch {
      const fallback = makeStarter();
      setNotebooks(fallback);
      setSelected(firstSelection(fallback));
      setExpandedNotebookIds([fallback[0].id]);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      setSyncStatus("offline");
      return;
    }
    let active = true;
    setSyncStatus("loading");
    void supabase
      .from("smart_notes")
      .select("id, parent_id, node_type, title, content, position")
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          setSyncStatus("error");
          return;
        }
        const remote = buildNotebooks((data ?? []) as SmartNoteRow[]);
        if (remote.length) {
          setNotebooks(remote);
          setSelected(firstSelection(remote));
          setExpandedNotebookIds(remote[0] ? [remote[0].id] : []);
          setSyncStatus("saved");
          return;
        }
        const local = notebooks.length ? notebooks : makeStarter();
        const rows = flattenNotebooks(local).map((row) => ({ ...row, user_id: userId }));
        const { error: importError } = await supabase.from("smart_notes").insert(rows);
        if (!active) return;
        setSyncStatus(importError ? "error" : "saved");
      });
    return () => {
      active = false;
    };
    // Load once per signed-in account. Local notes are imported only when the account has no rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
  }, [notebooks, ready]);
  useEffect(
    () => () => {
      if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
    },
    [],
  );
  const notebook = useMemo(
    () => notebooks.find((item) => item.id === selected.notebookId) ?? null,
    [notebooks, selected.notebookId],
  );
  const section = useMemo(
    () => notebook?.sections.find((item) => item.id === selected.sectionId) ?? null,
    [notebook, selected.sectionId],
  );
  const page = useMemo(
    () => section?.pages.find((item) => item.id === selected.pageId) ?? null,
    [section, selected.pageId],
  );
  // The editor owns its DOM while typing; only replace its contents after switching pages.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = page?.content ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);
  useEffect(() => {
    const updateSelectionToolbar = () => {
      if (formattingToolbarRef.current?.contains(document.activeElement)) return;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (
        !range ||
        selection?.isCollapsed ||
        !editorRef.current?.contains(range.commonAncestorContainer)
      ) {
        setSelectionToolbar(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      selectedRangeRef.current = range.cloneRange();
      setSelectionToolbar({ x: rect.left + rect.width / 2, y: Math.max(12, rect.top - 10) });
    };
    document.addEventListener("selectionchange", updateSelectionToolbar);
    return () => document.removeEventListener("selectionchange", updateSelectionToolbar);
  }, []);
  const saveNode = (id: string, updates: Record<string, string | null | number>) => {
    if (!userId) return;
    setSyncStatus("loading");
    void supabase
      .from("smart_notes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .then(({ error }) => setSyncStatus(error ? "error" : "saved"));
  };
  const insertNodes = (rows: SmartNoteRow[]) => {
    if (!userId) return;
    setSyncStatus("loading");
    void supabase
      .from("smart_notes")
      .insert(rows.map((row) => ({ ...row, user_id: userId })))
      .then(({ error }) => setSyncStatus(error ? "error" : "saved"));
  };
  const update = (updater: (current: Notebook[]) => Notebook[]) => setNotebooks(updater);
  const createNotebook = () => {
    const page = { id: makeId(), title: "Untitled page", content: "" };
    const section = { id: makeId(), title: "Untitled section", pages: [page] };
    const next = { id: makeId(), title: "Untitled notebook", sections: [section] };
    update((current) => [...current, next]);
    insertNodes(flattenNotebooks([next]));
    setExpandedNotebookIds((current) => [...current, next.id]);
    setSelected({ notebookId: next.id, sectionId: section.id, pageId: page.id });
    setEditing({ key: `notebook:${next.id}`, value: next.title });
  };
  const createSection = () => {
    if (!notebook) return;
    const page = { id: makeId(), title: "Untitled page", content: "" };
    const next = { id: makeId(), title: "Untitled section", pages: [page] };
    update((current) =>
      current.map((item) =>
        item.id === notebook.id ? { ...item, sections: [...item.sections, next] } : item,
      ),
    );
    insertNodes([
      {
        id: next.id,
        parent_id: notebook.id,
        node_type: "section",
        title: next.title,
        content: null,
        position: notebook.sections.length,
      },
      {
        id: page.id,
        parent_id: next.id,
        node_type: "page",
        title: page.title,
        content: null,
        position: 0,
      },
    ]);
    setSelected({ notebookId: notebook.id, sectionId: next.id, pageId: page.id });
    setEditing({ key: `section:${next.id}`, value: next.title });
  };
  const createPage = () => {
    if (!notebook || !section) return;
    const next = { id: makeId(), title: "Untitled page", content: "" };
    update((current) =>
      current.map((book) =>
        book.id !== notebook.id
          ? book
          : {
              ...book,
              sections: book.sections.map((item) =>
                item.id === section.id ? { ...item, pages: [...item.pages, next] } : item,
              ),
            },
      ),
    );
    insertNodes([
      {
        id: next.id,
        parent_id: section.id,
        node_type: "page",
        title: next.title,
        content: null,
        position: section.pages.length,
      },
    ]);
    setSelected({ notebookId: notebook.id, sectionId: section.id, pageId: next.id });
    setEditing({ key: `page:${next.id}`, value: next.title });
  };
  const updatePage = (updates: Partial<NotePage>) => {
    if (!notebook || !section || !page) return;
    update((current) =>
      current.map((book) =>
        book.id !== notebook.id
          ? book
          : {
              ...book,
              sections: book.sections.map((item) =>
                item.id !== section.id
                  ? item
                  : {
                      ...item,
                      pages: item.pages.map((entry) =>
                        entry.id === page.id ? { ...entry, ...updates } : entry,
                      ),
                    },
              ),
            },
      ),
    );
    if (updates.title !== undefined) saveNode(page.id, { title: updates.title });
    if (updates.content !== undefined) {
      if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
      contentSaveTimerRef.current = setTimeout(
        () => saveNode(page.id, { content: updates.content || null }),
        700,
      );
    }
  };
  const renameNotebook = (notebookId: string, title: string) => {
    if (!title) return;
    update((current) =>
      current.map((item) => (item.id === notebookId ? { ...item, title } : item)),
    );
    saveNode(notebookId, { title });
  };
  const renameSection = (notebookId: string, sectionId: string, title: string) => {
    if (!title) return;
    update((current) =>
      current.map((book) =>
        book.id !== notebookId
          ? book
          : {
              ...book,
              sections: book.sections.map((item) =>
                item.id === sectionId ? { ...item, title } : item,
              ),
            },
      ),
    );
    saveNode(sectionId, { title });
  };
  const renamePage = (notebookId: string, sectionId: string, pageId: string, title: string) => {
    if (!title) return;
    update((current) =>
      current.map((book) =>
        book.id !== notebookId
          ? book
          : {
              ...book,
              sections: book.sections.map((item) =>
                item.id !== sectionId
                  ? item
                  : {
                      ...item,
                      pages: item.pages.map((entry) =>
                        entry.id === pageId ? { ...entry, title } : entry,
                      ),
                    },
              ),
            },
      ),
    );
    saveNode(pageId, { title });
  };
  const startEditing = (key: string, value: string) => setEditing({ key, value });
  const updateEditingValue = (value: string) =>
    setEditing((current) => (current ? { ...current, value } : current));
  const finishEditing = (save: (value: string) => void) => {
    const value = editing?.value.trim();
    if (value) save(value);
    setEditing(null);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const next =
      deleteTarget.kind === "notebook"
        ? notebooks.filter((item) => item.id !== deleteTarget.notebookId)
        : deleteTarget.kind === "section"
          ? notebooks.map((item) =>
              item.id === deleteTarget.notebookId
                ? {
                    ...item,
                    sections: item.sections.filter((entry) => entry.id !== deleteTarget.sectionId),
                  }
                : item,
            )
          : notebooks.map((item) =>
              item.id !== deleteTarget.notebookId
                ? item
                : {
                    ...item,
                    sections: item.sections.map((entry) =>
                      entry.id === deleteTarget.sectionId
                        ? {
                            ...entry,
                            pages: entry.pages.filter((page) => page.id !== deleteTarget.pageId),
                          }
                        : entry,
                    ),
                  },
            );
    setNotebooks(next);
    if (userId) {
      setSyncStatus("loading");
      void supabase
        .from("smart_notes")
        .delete()
        .eq(
          "id",
          deleteTarget.kind === "notebook"
            ? deleteTarget.notebookId
            : deleteTarget.kind === "section"
              ? deleteTarget.sectionId
              : deleteTarget.pageId,
        )
        .eq("user_id", userId)
        .then(({ error }) => setSyncStatus(error ? "error" : "saved"));
    }
    setExpandedNotebookIds((current) => current.filter((id) => id !== deleteTarget.notebookId));
    setSelected(firstSelection(next));
    setEditing(null);
    setDeleteTarget(null);
  };
  const command = (
    name: "formatBlock" | "insertUnorderedList" | "insertOrderedList",
    value?: string,
  ) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    updatePage({ content: editorRef.current?.innerHTML ?? "" });
  };
  const checklist = () => {
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      '<div><label><input type="checkbox" /> <span>Checklist item</span></label></div>',
    );
    updatePage({ content: editorRef.current?.innerHTML ?? "" });
  };
  const insertCodeBlock = () => {
    const range = selectedRangeRef.current;
    const selection = window.getSelection();
    if (!range || !selection) return;
    const code = document.createElement("code");
    code.textContent = selection.toString();
    const block = document.createElement("pre");
    block.className = "karmel-code-block";
    block.append(code);
    range.deleteContents();
    range.insertNode(block);
    selection.removeAllRanges();
    selectedRangeRef.current = null;
    setSelectionToolbar(null);
    updatePage({ content: editorRef.current?.innerHTML ?? "" });
  };
  const insertEquation = () => {
    const latex = equationLatex.trim();
    const range = selectedRangeRef.current;
    if (!latex || !range) return;
    const equation = document.createElement("span");
    equation.className = "karmel-equation";
    equation.contentEditable = "false";
    equation.dataset.latex = encodeURIComponent(latex);
    equation.innerHTML = katex.renderToString(latex, { displayMode: true, throwOnError: false });
    range.deleteContents();
    range.insertNode(equation);
    range.collapse(false);
    const spacer = document.createElement("p");
    spacer.append(document.createElement("br"));
    range.insertNode(spacer);
    setEquationLatex("");
    setIsEquationOpen(false);
    selectedRangeRef.current = null;
    setSelectionToolbar(null);
    updatePage({ content: editorRef.current?.innerHTML ?? "" });
  };
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text/plain");
    event.preventDefault();
    const escapeHtml = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const hasPlainTextHeadings = text
      .split(/\r?\n/)
      .some((line) =>
        /^(?:#{1,4}\s+|(?:part|section|chapter|unit|topic)\s+(?:\d+|[ivxlcdm]+)\b)/i.test(
          line.trim(),
        ),
      );
    const promotePastedHeadings = () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.querySelectorAll<HTMLElement>("p, div").forEach((block) => {
        if (block.querySelector("p, div, h1, h2, h3, h4, pre, ul, ol")) return;
        const label = (block.textContent ?? "").replace(/\s+/g, " ").trim();
        const isNamedHeading = /^(?:part|section|chapter|unit|topic)\s+(?:\d+|[ivxlcdm]+)\b/i.test(
          label,
        );
        const isShortBoldHeading =
          label.length > 0 && label.length < 100 && Boolean(block.querySelector("strong, b"));
        if (!isNamedHeading && !isShortBoldHeading) return;
        const heading = document.createElement("h2");
        heading.innerHTML = block.innerHTML;
        block.replaceWith(heading);
      });
    };
    const pastedHtml = event.clipboardData.getData("text/html");
    if (pastedHtml && !hasPlainTextHeadings && !/```[\s\S]*?```|\$\$[\s\S]*?\$\$/.test(text)) {
      const source = document.createElement("div");
      source.innerHTML = pastedHtml;
      const allowedTags = new Set([
        "H1",
        "H2",
        "H3",
        "H4",
        "P",
        "DIV",
        "UL",
        "OL",
        "LI",
        "PRE",
        "CODE",
        "SPAN",
        "FONT",
        "STRONG",
        "B",
        "EM",
        "I",
        "U",
        "BR",
        "BLOCKQUOTE",
      ]);
      const cleanNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const element = node as HTMLElement;
        const tag = element.tagName.toUpperCase();
        const content = Array.from(element.childNodes).map(cleanNode).join("");
        if (!allowedTags.has(tag)) return content;
        const fontSize = element.style.fontSize;
        const fontWeight = element.style.fontWeight;
        const safeFontSize = /^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/.test(fontSize) ? fontSize : "";
        const safeFontWeight = /^(?:[1-9]00|bold|normal)$/.test(fontWeight) ? fontWeight : "";
        const inlineStyle = [
          safeFontSize ? `font-size:${safeFontSize}` : "",
          safeFontWeight ? `font-weight:${safeFontWeight}` : "",
        ]
          .filter(Boolean)
          .join(";");
        const isPartHeading = /^(?:part|section)\s+\d+\s*[:.\-]\s+.+$/i.test(
          (element.textContent ?? "").trim(),
        );
        if ((tag === "DIV" || tag === "P") && isPartHeading)
          return `<h2${inlineStyle ? ` style="${inlineStyle}"` : ""}>${content}</h2>`;
        if (tag === "DIV")
          return `<p${inlineStyle ? ` style="${inlineStyle}"` : ""}>${content}</p>`;
        if (tag === "PRE")
          return `<pre class="karmel-code-block"><code>${escapeHtml(element.textContent ?? "")}</code></pre>`;
        if (tag === "CODE" && element.parentElement?.tagName !== "PRE")
          return `<code>${content}</code>`;
        if (tag === "BR") return "<br>";
        if (tag === "SPAN" || tag === "FONT")
          return `<span${inlineStyle ? ` style="${inlineStyle}"` : ""}>${content}</span>`;
        const safeTag = tag === "B" ? "strong" : tag === "I" ? "em" : tag.toLowerCase();
        return `<${safeTag}>${content}</${safeTag}>`;
      };
      const richHtml = Array.from(source.childNodes).map(cleanNode).join("");
      document.execCommand("insertHTML", false, richHtml || `<p>${escapeHtml(text)}</p>`);
      promotePastedHeadings();
      updatePage({ content: editorRef.current?.innerHTML ?? "" });
      return;
    }
    const blockHtml = text
      .split(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$)/g)
      .map((part) => {
        if (part.startsWith("```")) {
          const match = part.match(/^```([^\n]*)\n?([\s\S]*?)```$/);
          const language = match?.[1]?.trim();
          return `<pre class="karmel-code-block"${language ? ` data-language="${escapeHtml(language)}"` : ""}><code>${escapeHtml(match?.[2] ?? "")}</code></pre>`;
        }
        if (part.startsWith("$$")) {
          const latex = part.slice(2, -2).trim();
          return `<span class="karmel-equation" contenteditable="false" data-latex="${encodeURIComponent(latex)}">${katex.renderToString(latex, { displayMode: true, throwOnError: false })}</span>`;
        }
        const lines = part.split(/\r?\n/);
        const html: string[] = [];
        let paragraph: string[] = [];
        const flushParagraph = () => {
          const body = paragraph.join(" ").trim();
          if (body) html.push(`<p>${escapeHtml(body)}</p>`);
          paragraph = [];
        };
        lines.forEach((line) => {
          const trimmed = line.trim();
          const markdownHeading = trimmed.match(/^(#{1,4})\s+(.+)$/);
          const namedHeading = /^(?:part|section|chapter|unit|topic)\s+(?:\d+|[ivxlcdm]+)\b/i.test(
            trimmed,
          );
          if (markdownHeading || namedHeading) {
            flushParagraph();
            const level = markdownHeading ? Math.min(markdownHeading[1].length, 4) : 2;
            html.push(`<h${level}>${escapeHtml(markdownHeading?.[2] ?? trimmed)}</h${level}>`);
          } else if (!trimmed) {
            flushParagraph();
          } else {
            paragraph.push(trimmed);
          }
        });
        flushParagraph();
        return html.join("");
      })
      .join("");
    document.execCommand("insertHTML", false, blockHtml);
    promotePastedHeadings();
    updatePage({ content: editorRef.current?.innerHTML ?? "" });
  };
  const applySelectionFormat = (
    commandName: "bold" | "italic" | "underline" | "fontName" | "fontSize" | "hiliteColor",
    value?: string,
  ) => {
    const range = selectedRangeRef.current;
    const selection = window.getSelection();
    if (!range || !selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
    editorRef.current?.focus();
    document.execCommand(commandName, false, value);
    selectedRangeRef.current = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    updatePage({ content: editorRef.current?.innerHTML ?? "" });
  };
  const toggleHighlight = () => {
    const range = selectedRangeRef.current;
    const editor = editorRef.current;
    if (!range || !editor || range.collapsed) return;

    const highlightedElements = Array.from(
      editor.querySelectorAll<HTMLElement>(".highlight, [data-karmel-highlight]"),
    ).filter((element) => range.intersectsNode(element));

    if (highlightedElements.length > 0) {
      highlightedElements.forEach((element) => {
        const parent = element.parentNode;
        if (!parent) return;
        const content = document.createDocumentFragment();
        while (element.firstChild) content.append(element.firstChild);
        parent.insertBefore(content, element);
        element.remove();
      });
      editor.normalize();
      selectedRangeRef.current = null;
      setSelectionToolbar(null);
      updatePage({ content: editor.innerHTML });
      return;
    }

    const selectedContent = range.extractContents();
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(selectedContent, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.length) textNodes.push(node as Text);
      node = walker.nextNode();
    }
    textNodes.forEach((textNode) => {
      const highlight = document.createElement("span");
      highlight.className = "highlight";
      textNode.parentNode?.replaceChild(highlight, textNode);
      highlight.append(textNode);
    });
    range.insertNode(selectedContent);
    editor.normalize();
    selectedRangeRef.current = null;
    setSelectionToolbar(null);
    updatePage({ content: editor.innerHTML });
  };
  const pageText = (html: string) => {
    const container = document.createElement("div");
    container.innerHTML = html;
    return (container.textContent ?? "").trim();
  };
  const openExtract = (tool: SmartExtractDraft["tool"]) => {
    if (!page) return;
    const source = pageText(editorRef.current?.innerHTML ?? page.content);
    if (source.length < 20) return;
    window.sessionStorage.setItem(
      SMART_EXTRACT_DRAFT_KEY,
      JSON.stringify({ tool, title: page.title, source } satisfies SmartExtractDraft),
    );
    void navigate({ to: `/${tool === "summary" ? "summary" : tool}` });
  };
  const explainSelection = () => {
    const text = window.getSelection()?.toString().trim();
    if (!text) return;
    setExplainRequest({ id: makeId(), text });
    setIsChatOpen(true);
    setSelectionToolbar(null);
  };
  if (!ready)
    return (
      <AppShell>
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
          Loading your notes…
        </div>
      </AppShell>
    );
  return (
    <AppShell>
      <div className="h-full min-h-0 bg-transparent p-3 sm:p-6">
        <div className="mx-auto flex h-full max-w-7xl min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-card/65 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <header className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3 sm:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Study</p>
              <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
                <StickyNote className="text-primary" size={20} />
                Smart Notes
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {syncStatus === "saved"
                  ? "Saved to your account"
                  : syncStatus === "loading"
                    ? "Saving…"
                    : syncStatus === "offline"
                      ? "Sign in to sync your notes"
                      : "Changes are saved on this device; cloud sync needs attention"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsNotebookPanelOpen((open) => !open)}
                aria-label={
                  isNotebookPanelOpen ? "Collapse notebooks panel" : "Show notebooks panel"
                }
                aria-pressed={isNotebookPanelOpen}
                className={`rounded-xl p-2 transition ${isNotebookPanelOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <PanelLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => setIsSectionPanelOpen((open) => !open)}
                aria-label={isSectionPanelOpen ? "Collapse pages panel" : "Show pages panel"}
                aria-pressed={isSectionPanelOpen}
                className={`rounded-xl p-2 transition ${isSectionPanelOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <PanelRight size={17} />
              </button>
              <button
                type="button"
                onClick={() => setIsChatOpen((open) => !open)}
                aria-label={isChatOpen ? "Hide KARMEL chat" : "Show KARMEL chat"}
                aria-pressed={isChatOpen}
                className={`rounded-xl p-2 transition ${isChatOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <Bot size={17} />
              </button>
              <button
                type="button"
                onClick={createNotebook}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New notebook</span>
              </button>
            </div>
          </header>
          <div
            className={`grid min-h-0 flex-1 ${isChatOpen ? (isNotebookPanelOpen && isSectionPanelOpen ? "xl:grid-cols-[15rem_13rem_minmax(0,1fr)_22rem]" : isNotebookPanelOpen ? "xl:grid-cols-[15rem_minmax(0,1fr)_22rem]" : isSectionPanelOpen ? "xl:grid-cols-[13rem_minmax(0,1fr)_22rem]" : "xl:grid-cols-[minmax(0,1fr)_22rem]") : ""} ${isNotebookPanelOpen && isSectionPanelOpen ? "lg:grid-cols-[15rem_13rem_minmax(0,1fr)]" : isNotebookPanelOpen ? "lg:grid-cols-[15rem_minmax(0,1fr)]" : isSectionPanelOpen ? "lg:grid-cols-[13rem_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)]"}`}
          >
            <aside
              className={`${isNotebookPanelOpen ? "" : "hidden"} min-h-0 overflow-y-auto border-b border-border/70 bg-card/35 p-3 lg:border-b-0 lg:border-r`}
            >
              <p className="mb-3 px-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Notebooks
              </p>
              <div className="space-y-1">
                {notebooks.map((item) => {
                  const isExpanded = expandedNotebookIds.includes(item.id);
                  const isActive = item.id === notebook?.id;
                  return (
                    <div key={item.id}>
                      <div
                        className={`flex w-full items-center gap-1 rounded-xl px-2 py-1 text-sm transition ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedNotebookIds((current) =>
                              current.includes(item.id)
                                ? current.filter((id) => id !== item.id)
                                : [...current, item.id],
                            )
                          }
                          className="rounded-md p-1 transition hover:bg-black/10"
                          aria-label={
                            isExpanded ? `Collapse ${item.title}` : `Expand ${item.title}`
                          }
                          aria-expanded={isExpanded}
                        >
                          <ChevronRight
                            size={15}
                            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </button>
                        <BookOpen size={16} className="shrink-0" />
                        {editing?.key === `notebook:${item.id}` ? (
                          <input
                            autoFocus
                            value={editing.value}
                            onChange={(event) => updateEditingValue(event.target.value)}
                            onBlur={() => finishEditing((value) => renameNotebook(item.id, value))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                              if (event.key === "Escape") setEditing(null);
                            }}
                            className="min-w-0 flex-1 bg-transparent py-1 outline-none"
                            aria-label="Rename notebook"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(firstSelection([item]));
                              if (!isExpanded)
                                setExpandedNotebookIds((current) => [...current, item.id]);
                            }}
                            onDoubleClick={() => startEditing(`notebook:${item.id}`, item.title)}
                            className="min-w-0 flex-1 truncate py-1 text-left"
                          >
                            {item.title}
                          </button>
                        )}
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                kind: "notebook",
                                notebookId: item.id,
                                title: item.title,
                              })
                            }
                            className="rounded-md p-1 text-current/75 transition hover:bg-black/10 hover:text-current"
                            aria-label={`Delete notebook ${item.title}`}
                          >
                            <X size={15} />
                          </button>
                        ) : null}
                      </div>
                      {isExpanded ? (
                        <div className="ml-4 border-l border-border/70 pl-2">
                          {item.sections.map((entry) =>
                            editing?.key === `section:${entry.id}` ? (
                              <input
                                key={entry.id}
                                autoFocus
                                value={editing.value}
                                onChange={(event) => updateEditingValue(event.target.value)}
                                onBlur={() =>
                                  finishEditing((value) => renameSection(item.id, entry.id, value))
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") event.currentTarget.blur();
                                  if (event.key === "Escape") setEditing(null);
                                }}
                                className={`my-0.5 block w-full rounded-lg px-2 py-1.5 text-sm outline-none ${entry.id === section?.id ? "bg-accent text-foreground" : "bg-background text-foreground"}`}
                                aria-label="Rename section"
                              />
                            ) : (
                              <div
                                key={entry.id}
                                className={`my-0.5 flex items-center rounded-lg text-sm transition ${entry.id === section?.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelected({
                                      notebookId: item.id,
                                      sectionId: entry.id,
                                      pageId: entry.pages[0]?.id ?? "",
                                    })
                                  }
                                  onDoubleClick={() =>
                                    startEditing(`section:${entry.id}`, entry.title)
                                  }
                                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left"
                                >
                                  {entry.title}
                                </button>
                                {entry.id === section?.id ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({
                                        kind: "section",
                                        notebookId: item.id,
                                        sectionId: entry.id,
                                        title: entry.title,
                                      })
                                    }
                                    className="mr-1 rounded-md p-1 transition hover:bg-black/10"
                                    aria-label={`Delete section ${entry.title}`}
                                  >
                                    <X size={14} />
                                  </button>
                                ) : null}
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={createSection}
                disabled={!notebook}
                className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <Plus size={15} />
                Add section
              </button>
            </aside>
            <aside
              className={`${isSectionPanelOpen ? "" : "hidden"} min-h-0 overflow-y-auto border-b border-border/70 bg-background/40 p-3 lg:border-b-0 lg:border-r`}
            >
              <div className="mb-3 flex items-center justify-between px-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Pages
                </p>
                <button
                  type="button"
                  onClick={createPage}
                  disabled={!section}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
                  aria-label="Add page"
                >
                  <FilePlus2 size={16} />
                </button>
              </div>
              {section?.pages.map((entry) =>
                editing?.key === `page:${entry.id}` ? (
                  <input
                    key={entry.id}
                    autoFocus
                    value={editing.value}
                    onChange={(event) => updateEditingValue(event.target.value)}
                    onBlur={() =>
                      finishEditing((value) =>
                        renamePage(notebook?.id ?? "", section.id, entry.id, value),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setEditing(null);
                    }}
                    className={`mb-1 block w-full rounded-lg px-3 py-2 text-sm outline-none ${entry.id === page?.id ? "bg-accent text-foreground" : "bg-background text-foreground"}`}
                    aria-label="Rename page"
                  />
                ) : (
                  <div
                    key={entry.id}
                    className={`mb-1 flex items-center rounded-lg text-sm transition ${entry.id === page?.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelected({
                          notebookId: notebook?.id ?? "",
                          sectionId: section.id,
                          pageId: entry.id,
                        })
                      }
                      onDoubleClick={() => startEditing(`page:${entry.id}`, entry.title)}
                      className="min-w-0 flex-1 truncate px-3 py-2 text-left"
                    >
                      {entry.title}
                    </button>
                    {entry.id === page?.id ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "page",
                            notebookId: notebook?.id ?? "",
                            sectionId: section.id,
                            pageId: entry.id,
                            title: entry.title,
                          })
                        }
                        className="mr-1 rounded-md p-1 transition hover:bg-black/10"
                        aria-label={`Delete page ${entry.title}`}
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                ),
              )}
            </aside>
            <main className="flex min-h-0 flex-col overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 border-b border-border/70 px-4 py-2 sm:px-6">
                <span className="mr-auto" />
                {(["summary", "flashcards", "quiz", "test"] as const).map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => openExtract(tool)}
                    disabled={!page}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    {tool === "flashcards" ? "Flashcards" : tool[0].toUpperCase() + tool.slice(1)}
                  </button>
                ))}
              </div>
              {page ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(event) => updatePage({ content: event.currentTarget.innerHTML })}
                    onPaste={handlePaste}
                    className="notes-editor min-h-80 max-w-3xl outline-none"
                    data-placeholder="Start writing here…"
                  />
                </div>
              ) : (
                <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">
                  Create a section and page to start writing.
                </div>
              )}
            </main>
            {isChatOpen ? (
              <SmartNotesChat
                pageId={page?.id ?? ""}
                pageTitle={page?.title ?? "Smart Notes"}
                pageText={pageText(page?.content ?? "")}
                explainRequest={explainRequest}
                onExplainHandled={() => setExplainRequest(null)}
              />
            ) : null}
            {selectionToolbar && typeof document !== "undefined"
              ? createPortal(
                  <div
                    ref={formattingToolbarRef}
                    className="fixed z-[70] flex items-center gap-1 rounded-xl border border-white/15 bg-popover/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
                    style={{
                      left: selectionToolbar.x,
                      top: selectionToolbar.y,
                      transform: "translate(-50%, -100%)",
                    }}
                    role="toolbar"
                    aria-label="Text formatting"
                  >
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value)
                          applySelectionFormat("fontName", event.target.value);
                        event.target.value = "";
                      }}
                      className="h-8 max-w-24 rounded-lg border-0 bg-transparent px-1 text-xs text-foreground outline-none"
                      aria-label="Font"
                    >
                      <option value="" disabled>
                        Font
                      </option>
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Courier New">Mono</option>
                    </select>
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value)
                          applySelectionFormat("fontSize", event.target.value);
                        event.target.value = "";
                      }}
                      className="h-8 w-14 rounded-lg border-0 bg-transparent px-1 text-xs text-foreground outline-none"
                      aria-label="Font size"
                    >
                      <option value="" disabled>
                        Size
                      </option>
                      <option value="2">Small</option>
                      <option value="3">Normal</option>
                      <option value="5">Large</option>
                    </select>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySelectionFormat("bold")}
                      className="rounded-lg p-1.5 text-foreground transition hover:bg-accent"
                      aria-label="Bold"
                    >
                      <Bold size={15} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySelectionFormat("italic")}
                      className="rounded-lg p-1.5 text-foreground transition hover:bg-accent"
                      aria-label="Italic"
                    >
                      <Italic size={15} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySelectionFormat("underline")}
                      className="rounded-lg p-1.5 text-foreground transition hover:bg-accent"
                      aria-label="Underline"
                    >
                      <Underline size={15} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={toggleHighlight}
                      className="rounded-lg p-1.5 text-foreground transition hover:bg-accent"
                      aria-label="Toggle text highlight"
                    >
                      <Highlighter size={15} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={insertCodeBlock}
                      className="rounded-lg p-1.5 text-foreground transition hover:bg-accent"
                      aria-label="Format selected text as code block"
                    >
                      <Code2 size={15} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setEquationLatex(window.getSelection()?.toString().trim() ?? "");
                        setIsEquationOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-foreground transition hover:bg-accent"
                      aria-label="Insert equation"
                    >
                      <Sigma size={15} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={explainSelection}
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                      aria-label="Explain selected text with KARMEL"
                    >
                      Explain
                    </button>
                  </div>,
                  document.body,
                )
              : null}
          </div>
          {deleteTarget ? (
            <div
              className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-notes-title"
            >
              <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
                <h2 id="delete-notes-title" className="text-lg font-semibold">
                  Delete {deleteTarget.kind}?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-foreground">{deleteTarget.title}</span>?
                  {deleteTarget.kind === "notebook"
                    ? " Its sections and pages will also be deleted."
                    : deleteTarget.kind === "section"
                      ? " Its pages will also be deleted."
                      : " This cannot be undone."}
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
                  >
                    Yes, delete
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {isEquationOpen ? (
            <div
              className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="equation-title"
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  insertEquation();
                }}
                className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl"
              >
                <h2 id="equation-title" className="text-lg font-semibold">
                  Insert equation
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter LaTeX, for example: <code>\\frac&#123;a&#125;&#123;b&#125;</code> or{" "}
                  <code>x^2 + y^2 = z^2</code>.
                </p>
                <textarea
                  autoFocus
                  value={equationLatex}
                  onChange={(event) => setEquationLatex(event.target.value)}
                  placeholder="E = mc^2"
                  rows={4}
                  className="mt-4 w-full resize-none rounded-xl border border-border bg-background p-3 font-mono text-sm outline-none focus:border-primary"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEquationOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!equationLatex.trim()}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Insert equation
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
