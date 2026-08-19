// Local, focused type stubs for the slice of the Safelight extension API this
// extension uses. The app's real, exhaustive definitions live in the core repo
// (src/extensions/types.ts, src/catalog/types.ts); this file mirrors only what
// we touch so the bundle type-checks standalone without depending on core.

import type { ComponentType, CSSProperties, ReactNode } from "react";

// ── catalog model ────────────────────────────────────────────────────────────

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
  stores: {
    useCatalogStore: StoreHook<CatalogState>;
    useUIStore: StoreHook<UIState>;
    create<T>(initializer: StateCreator<T>): StoreHook<T>;
  };
  dock: { togglePanel(id: string): void };
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
