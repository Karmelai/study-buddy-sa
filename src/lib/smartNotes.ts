type SmartNotePage = { id: string; title: string; content: string };
type SmartNoteSection = { id: string; title: string; pages: SmartNotePage[] };
type SmartNotebook = { id: string; title: string; sections: SmartNoteSection[] };

export const SMART_EXTRACT_DRAFT_KEY = "karmel-smart-extract-draft";
export type SmartExtractDraft = {
  tool: "summary" | "flashcards" | "quiz" | "test";
  title: string;
  source: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const makeUuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });

/** Converts IDs from the former local-only notebook format into database-safe UUIDs. */
export const normalizeSmartNoteIds = (notebooks: SmartNotebook[]): SmartNotebook[] => {
  const usedIds = new Set<string>();
  const idFor = (id: string) => {
    if (uuidPattern.test(id) && !usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    let nextId = makeUuid();
    while (usedIds.has(nextId)) nextId = makeUuid();
    usedIds.add(nextId);
    return nextId;
  };

  return notebooks.map((notebook) => ({
    ...notebook,
    id: idFor(notebook.id),
    sections: notebook.sections.map((section) => ({
      ...section,
      id: idFor(section.id),
      pages: section.pages.map((page) => ({ ...page, id: idFor(page.id) })),
    })),
  }));
};
