// Local, focused type stubs for the slice of the Safelight extension API this
// extension uses. The app's real, exhaustive definitions live in the core repo
// (src/extensions/types.ts, src/catalog/types.ts); this file mirrors only what
// we touch so the bundle type-checks standalone without depending on core.

import type { ComponentType, CSSProperties, JSX, ReactNode } from "react";

// ── catalogue model ────────────────────────────────────────────────────────────

export type ColorLabel = "none" | "red" | "yellow" | "green" | "blue" | "purple";
export type FlagStatus = "none" | "pick" | "reject";

export interface ExifData {
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  iso?: number;
  aperture?: number;
  focalLength?: number;
  shutterSpeed?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

export interface CatalogPhoto {
  id: string;
  filename: string;
  relPath: string;
  /** Containing folder: dirname of relPath ("" = project root). */
  folder: string;
  mimeType: string;
  rating: number;
  colorLabel: ColorLabel;
  flag: FlagStatus;
  keywords: string[];
  dateCreated: number;
  dateImported: number;
  width: number;
  height: number;
  /** Present on a virtual copy: id of the master record. */
  copyOf?: string;
  exif: ExifData;
}

export interface CatalogState {
  photos: CatalogPhoto[];
  selectedIds: Set<string>;
  activePhotoId: string | null;
}

export interface UIState {
  /** Project folder filter: relative path ("" = whole project), null = all. */
  activeFolder: string | null;
  setActiveFolder(path: string | null): void;
}

/** A zustand hook: callable as a selector inside React, with getState/subscribe
 *  off the function for use outside render. */
export interface StoreHook<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState(): T;
  setState(partial: Partial<T> | ((state: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

export type StateCreator<T> = (
  set: (partial: Partial<T> | ((s: T) => Partial<T>)) => void,
  get: () => T,
) => T;

// ── contribution shapes ──────────────────────────────────────────────────────

export interface PanelDockDefault {
  module: "library" | "develop";
  direction: "left" | "right" | "bottom";
  order?: number;
  width?: number;
  height?: number;
}

export interface PanelContribution {
  id: string;
  title: string;
  component: ComponentType;
  order?: number;
  defaultDock?: PanelDockDefault;
}

export interface GridMenuItemContribution {
  id: string;
  label: string | ((ids: string[]) => string);
  order?: number;
  danger?: boolean;
  enabled?: (ids: string[]) => boolean;
  onClick: (ids: string[]) => void;
}

export interface GridFilterContribution {
  id: string;
  test(photo: CatalogPhoto): boolean;
  /** The photo fields `test` reads, by top-level name; the Library filters
   *  again only when one changes. `[]` for a test that reads none. */
  reads?: readonly (keyof CatalogPhoto)[];
  onClear?(): void;
}

export interface CatalogHooksContribution {
  id: string;
  onPhotoRemove?(ctx: { photo: CatalogPhoto }): Promise<void>;
}

export interface KeyActionContribution {
  id: string;
  label: string;
  category?: "General" | "Develop" | "Library";
  defaultCombo: string;
  handler(): void;
}

// ── UI kit (api.ui) ──────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface UiKit {
  Button: ComponentType<{
    variant?: Variant;
    size?: Size;
    active?: boolean;
    full?: boolean;
    disabled?: boolean;
    title?: string;
    onClick?: (e: { stopPropagation(): void }) => void;
    children?: ReactNode;
    style?: CSSProperties;
  }>;
  Select: ComponentType<{
    value: string;
    onChange: (value: string) => void;
    options?: { value: string; label: string; disabled?: boolean }[];
    groups?: { title?: string; items: { value: string; label: string; disabled?: boolean }[] }[];
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
  }>;
  TextInput: ComponentType<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    style?: CSSProperties;
    onKeyDown?: (e: {
      key: string;
      preventDefault(): void;
      stopPropagation(): void;
    }) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    ref?: unknown;
  }>;
  Field: ComponentType<{ label?: ReactNode; hint?: ReactNode; children?: ReactNode }>;
  tokens: Record<string, string>;
  /** Take the Escape key while something of yours is open that Escape should
   *  close (an edit mode whose handles sit over the photo, a popover): the
   *  newest taker gets the key, ahead of an on-image tool, and a slider's
   *  value field keeps it for its own revert. Returns the function that
   *  gives the key back: call it as soon as there is nothing left to close,
   *  from a React effect's cleanup. Needs Safelight 3.2.4. */
  onEscape(handler: () => void): () => void;
  /** Tell the person something without stopping them: a bar in the app's
   *  bottom stack, under your extension's name, with a × to dismiss.
   *  `info` and `success` go by themselves after a few seconds; `warning`
   *  and `error` stay; a notice with `progress` (0..1) stays while the run
   *  is under way. `update` changes it in place, `close` takes it down, and
   *  core takes it down when your extension stops. Needs Safelight 3.2.7. */
  notify(notice: string | NoticeOptions): NoticeHandle;
}

export type NoticeTone = "info" | "success" | "warning" | "error";

export interface NoticeOptions {
  message: string;
  /** info and success go by themselves; warning and error stay until dismissed. */
  tone?: NoticeTone;
  /** 0..1 while a run is under way, which keeps the notice up; null for none. */
  progress?: number | null;
}

export interface NoticeHandle {
  update(next: Partial<NoticeOptions>): void;
  close(): void;
}

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  /** Render in the red danger colour (e.g. Remove). */
  danger?: boolean;
  disabled?: boolean;
}

/** A horizontal divider between groups of items. */
export type ContextMenuEntry = ContextMenuItem | "separator";

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

// ── the scoped API object handed to activate() ───────────────────────────────

export interface SafelightAPI {
  version: 1;
  extensionId: string;
  react: typeof import("react");
  registerPanel(c: PanelContribution): void;
  registerGridFilter(c: GridFilterContribution): void;
  registerGridMenuItem(c: GridMenuItemContribution): void;
  registerCatalogHooks(c: CatalogHooksContribution): void;
  registerKeybinding(c: KeyActionContribution): void;
  settings: {
    get<T>(key: string, fallback: T): T;
    set(key: string, value: unknown): void;
    onChange(cb: (key: string, value: unknown) => void): () => void;
  };
  ui: UiKit;
  components: {
    /** The right-click menu core surfaces use, placed at client `x`/`y` and
     *  kept in the viewport. Closes on an outside click, Escape, scroll, or
     *  choosing an item. */
    ContextMenu: (props: ContextMenuProps) => JSX.Element;
  };
  stores: {
    useCatalogStore: StoreHook<CatalogState>;
    useUIStore: StoreHook<UIState>;
    create<T>(initializer: StateCreator<T>): StoreHook<T>;
  };
  dock: { togglePanel(id: string): void };
  catalog: {
    /** The ids a command on "these photos" acts on: the selection, else the
     *  active photo, else none. Core's rating, rotate and delete shortcuts use
     *  the same rule. Needs Safelight 3.2.7. */
    targetIds(): string[];
  };
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
