# AI-generated study widgets: feasibility

## Recommendation

Feasible as a second phase. Keep AI responsible for proposing structured study content and keep Still responsible for validating, previewing, and saving a widget. Do not let model output execute code or directly mutate workspace state.

## Existing foundations

- The assistant already receives note text as a bounded resource and can produce flashcards and quizzes in its response.
- The widget system has a typed `WidgetType`, a registry of React renderers, serialized `WidgetInstance` state, workspace placement helpers, and guarded assistant actions.
- Notes have stable document IDs, tags, and links, so generated sets can retain source note IDs and show provenance.

## Suggested implementation

1. Define versioned JSON schemas for `FlashcardSet` and `QuizSet` (prompt/answer cards; question/options/correct answer/explanation). Set limits on item count and text length.
2. Ask the configured assistant provider for schema-constrained data from selected notes. Reject malformed output and show a repairable error without changing the workspace.
3. Present a preview with source notes, edit/delete controls, and an explicit Add to workspace action.
4. Persist approved content in new typed widget instances or a versioned study-content payload in the existing workspace model. Migrate old workspace state safely and support export/import.
5. Implement keyboard-accessible study sessions, shuffle, reveal/grade, progress, and resume state. Keep generated content separate from source notes unless the user explicitly chooses to write it back.

## Main risks

- Schema drift and inconsistent provider output: solve with schema validation, bounded retries, and preview-before-save.
- Content hallucination: keep citations to note/document IDs and excerpts, label unsupported answers, and let the user edit every item.
- Persistence compatibility: add a versioned migration before shipping new widget types, and verify old saved workspaces still load.
- Scope: a single reusable study-set renderer with modes is likely simpler than separate flashcard and quiz implementations; separate widget types can be added later if the user experience requires them.

## Effort estimate

A useful first version is a moderate feature: schema and generation flow, preview/editor, persistence migration, and study UI. The main prerequisite is reliable assistant provider connectivity, which should be confirmed independently before building the creation flow.
