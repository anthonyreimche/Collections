//#region src/runtime.ts
let React;
let api;
let ui;
function initRuntime(a) {
	api = a;
	React = a.react;
	ui = a.ui;
}
//#endregion
//#region src/model/types.ts
const EMPTY_FILE = {
	version: 1,
	collections: []
};
const is = (values = 1) => ({
	op: "is",
	label: "is",
	values
});
const isnot = (values = 1) => ({
	op: "isnot",
	label: "is not",
	values
});
const contains = {
	op: "contains",
	label: "contains",
	values: 1
};
const ncontains = {
	op: "ncontains",
	label: "doesn't contain",
	values: 1
};
const numeric = [
	is(),
	{
		op: "atleast",
		label: "is at least",
		values: 1
	},
	{
		op: "atmost",
		label: "is at most",
		values: 1
	},
	{
		op: "between",
		label: "is between",
		values: 2
	}
];
const dated = [
	{
		op: "lastdays",
		label: "is in the last (days)",
		values: 1
	},
	{
		op: "notlastdays",
		label: "is not in the last (days)",
		values: 1
	},
	{
		op: "before",
		label: "is before",
		values: 1
	},
	{
		op: "after",
		label: "is after",
		values: 1
	},
	{
		op: "between",
		label: "is between",
		values: 2
	}
];
const FIELD_DEFS = [
	{
		field: "rating",
		label: "Rating",
		kind: "number",
		ops: [
			is(),
			{
				op: "atleast",
				label: "is at least",
				values: 1
			},
			{
				op: "atmost",
				label: "is at most",
				values: 1
			}
		]
	},
	{
		field: "flag",
		label: "Flag",
		kind: "enum",
		ops: [is(), isnot()],
		options: [
			{
				value: "pick",
				label: "picked"
			},
			{
				value: "none",
				label: "unflagged"
			},
			{
				value: "reject",
				label: "rejected"
			}
		]
	},
	{
		field: "label",
		label: "Colour label",
		kind: "enum",
		ops: [is(), isnot()],
		options: [
			"none",
			"red",
			"yellow",
			"green",
			"blue",
			"purple"
		].map((value) => ({
			value,
			label: value
		}))
	},
	{
		field: "keyword",
		label: "Keyword",
		kind: "text",
		ops: [
			contains,
			ncontains,
			is()
		]
	},
	{
		field: "filename",
		label: "Filename",
		kind: "text",
		ops: [
			contains,
			ncontains,
			{
				op: "starts",
				label: "starts with",
				values: 1
			},
			{
				op: "ends",
				label: "ends with",
				values: 1
			}
		]
	},
	{
		field: "folder",
		label: "Folder",
		kind: "text",
		ops: [
			is(),
			{
				op: "under",
				label: "is under",
				values: 1
			},
			{
				op: "notunder",
				label: "is not under",
				values: 1
			}
		]
	},
	{
		field: "filetype",
		label: "File type",
		kind: "text",
		ops: [is(), isnot()]
	},
	{
		field: "captured",
		label: "Capture date",
		kind: "date",
		ops: dated
	},
	{
		field: "imported",
		label: "Import date",
		kind: "date",
		ops: dated
	},
	{
		field: "camera",
		label: "Camera",
		kind: "text",
		ops: [
			contains,
			is(),
			isnot()
		]
	},
	{
		field: "lens",
		label: "Lens",
		kind: "text",
		ops: [contains, is()]
	},
	{
		field: "iso",
		label: "ISO",
		kind: "number",
		ops: numeric
	},
	{
		field: "focal",
		label: "Focal length",
		kind: "number",
		ops: numeric
	},
	{
		field: "aperture",
		label: "Aperture",
		kind: "number",
		ops: numeric
	},
	{
		field: "shutter",
		label: "Shutter speed",
		kind: "number",
		ops: [{
			op: "atleast",
			label: "is at least (s)",
			values: 1
		}, {
			op: "atmost",
			label: "is at most (s)",
			values: 1
		}]
	},
	{
		field: "orientation",
		label: "Orientation",
		kind: "enum",
		ops: [is()],
		options: [
			{
				value: "landscape",
				label: "landscape"
			},
			{
				value: "portrait",
				label: "portrait"
			},
			{
				value: "square",
				label: "square"
			}
		]
	},
	{
		field: "gps",
		label: "GPS location",
		kind: "none",
		ops: [{
			op: "has",
			label: "is present",
			values: 0
		}, {
			op: "hasnot",
			label: "is missing",
			values: 0
		}]
	},
	{
		field: "virtualcopy",
		label: "Virtual copy",
		kind: "none",
		ops: [is(0), isnot(0)]
	}
];
function fieldDef(field) {
	return FIELD_DEFS.find((d) => d.field === field);
}
function isRecord(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}
function sanitizeRule(raw) {
	if (!isRecord(raw)) return null;
	const { field, op, value, value2 } = raw;
	if (typeof field !== "string" || typeof op !== "string") return null;
	return {
		field,
		op,
		...typeof value === "string" ? { value } : {},
		...typeof value2 === "string" ? { value2 } : {}
	};
}
function sanitizeCollection(raw) {
	if (!isRecord(raw)) return null;
	const { id, name, kind } = raw;
	if (typeof id !== "string" || id === "") return null;
	if (typeof name !== "string" || name.trim() === "") return null;
	if (kind === "collection") {
		const memberIds = [];
		const seen = /* @__PURE__ */ new Set();
		if (Array.isArray(raw.memberIds)) {
			for (const m of raw.memberIds) if (typeof m === "string" && !seen.has(m)) {
				seen.add(m);
				memberIds.push(m);
			}
		}
		return {
			id,
			name,
			kind,
			memberIds
		};
	}
	if (kind === "smart") return {
		id,
		name,
		kind,
		match: raw.match === "any" ? "any" : "all",
		rules: Array.isArray(raw.rules) ? raw.rules.map(sanitizeRule).filter((r) => r !== null) : []
	};
	return null;
}
/** Validate a persisted CollectionsFile defensively: recognizable entries
*  survive, garbage drops entry-by-entry, anything unrecognizable at the top
*  level yields a fresh empty file. */
function sanitizeFile(raw) {
	if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.collections)) return {
		version: 1,
		collections: []
	};
	const collections = [];
	const ids = /* @__PURE__ */ new Set();
	for (const entry of raw.collections) {
		const c = sanitizeCollection(entry);
		if (c && !ids.has(c.id)) {
			ids.add(c.id);
			collections.push(c);
		}
	}
	return {
		version: 1,
		collections
	};
}
//#endregion
//#region src/model/rules.ts
/** Compile a rule list. Zero effective rules matches everything (an inert
*  collection lists all photos rather than none). */
function compileRules(rules, match, now) {
	const clauses = rules.map((r) => compileRule(r, now)).filter((c) => c !== null);
	if (clauses.length === 0) return () => true;
	return match === "all" ? (p) => clauses.every((c) => c(p)) : (p) => clauses.some((c) => c(p));
}
function compileRule(rule, now) {
	const value = rule.value ?? "";
	switch (rule.field) {
		case "rating": return numberRule(rule, (p) => p.rating);
		case "flag": return enumRule(rule.op, value, (p) => p.flag);
		case "label": return enumRule(rule.op, value, (p) => p.colorLabel);
		case "keyword": return keywordRule(rule.op, value);
		case "filename": return textRule(rule.op, value, (p) => p.filename);
		case "folder": return folderRule(rule.op, value);
		case "filetype": return filetypeRule(rule.op, value);
		case "captured": return dateRule(rule, now, (p) => p.dateCreated);
		case "imported": return dateRule(rule, now, (p) => p.dateImported);
		case "camera": return textRule(rule.op, value, cameraText);
		case "lens": return textRule(rule.op, value, (p) => p.exif.lens);
		case "iso": return numberRule(rule, (p) => p.exif.iso);
		case "focal": return numberRule(rule, (p) => p.exif.focalLength);
		case "aperture": return numberRule(rule, (p) => p.exif.aperture);
		case "shutter": return shutterRule(rule.op, value);
		case "orientation": return orientationRule(rule.op, value);
		case "gps": return gpsRule(rule.op);
		case "virtualcopy": return copyRule(rule.op);
		default: return null;
	}
}
/** "1/250", "0.5", "30", each with an optional trailing "s" → seconds. */
function parseShutterSeconds(s) {
	const m = s.trim().match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?s?$/);
	if (!m) return null;
	const num = Number(m[1]);
	if (m[2] === void 0) return num;
	const den = Number(m[2]);
	return den > 0 ? num / den : null;
}
/** Strict local "YYYY-MM-DD" → ms at that day's 00:00, or null. */
function parseDay(s) {
	const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	const [y, mo, d] = [
		Number(m[1]),
		Number(m[2]),
		Number(m[3])
	];
	const date = new Date(y, mo - 1, d);
	if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
	return date.getTime();
}
function extensionOf(filename) {
	const dot = filename.lastIndexOf(".");
	return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}
const RAW_EXTENSIONS = /* @__PURE__ */ new Set([
	"nef",
	"nrw",
	"cr2",
	"cr3",
	"crw",
	"arw",
	"srf",
	"sr2",
	"raf",
	"orf",
	"rw2",
	"dng",
	"pef",
	"srw",
	"x3f",
	"kdc",
	"dcr",
	"3fr",
	"fff",
	"iiq",
	"erf",
	"mrw",
	"mef",
	"raw",
	"rwl"
]);
function isRawExtension(ext) {
	return RAW_EXTENSIONS.has(ext.toLowerCase());
}
const NUM_EPSILON = .05 + 1e-9;
const DAY_MS = 864e5;
const never = () => false;
function numberRule(rule, get) {
	const v = Number(rule.value);
	const test = (cmp) => Number.isNaN(v) ? never : (p) => {
		const n = get(p);
		return n !== void 0 && cmp(n);
	};
	switch (rule.op) {
		case "is": return test((n) => Math.abs(n - v) <= NUM_EPSILON);
		case "atleast": return test((n) => n >= v);
		case "atmost": return test((n) => n <= v);
		case "between": {
			const hi = Number(rule.value2);
			if (Number.isNaN(v) || Number.isNaN(hi) || v > hi) return never;
			return (p) => {
				const n = get(p);
				return n !== void 0 && n >= v && n <= hi;
			};
		}
		default: return null;
	}
}
function enumRule(op, value, get) {
	const v = value.toLowerCase();
	switch (op) {
		case "is": return v === "" ? never : (p) => get(p) === v;
		case "isnot": return v === "" ? never : (p) => get(p) !== v;
		default: return null;
	}
}
/** Text ops over an optional field. Negated ops match a photo lacking the
*  field entirely ("lens doesn't contain X" is true of a photo with no lens);
*  an empty rule value is degenerate and never matches either way. */
function textRule(op, value, get) {
	const v = value.toLowerCase();
	const has = (p, test) => {
		const s = get(p);
		return s !== void 0 && test(s.toLowerCase());
	};
	if (v === "") return [
		"contains",
		"ncontains",
		"is",
		"isnot",
		"starts",
		"ends"
	].includes(op) ? never : null;
	switch (op) {
		case "contains": return (p) => has(p, (s) => s.includes(v));
		case "ncontains": return (p) => !has(p, (s) => s.includes(v));
		case "is": return (p) => has(p, (s) => s === v);
		case "isnot": return (p) => !has(p, (s) => s === v);
		case "starts": return (p) => has(p, (s) => s.startsWith(v));
		case "ends": return (p) => has(p, (s) => s.endsWith(v));
		default: return null;
	}
}
function keywordRule(op, value) {
	const v = value.toLowerCase();
	if (v === "") return [
		"contains",
		"ncontains",
		"is"
	].includes(op) ? never : null;
	switch (op) {
		case "contains": return (p) => p.keywords.some((k) => k.toLowerCase().includes(v));
		case "ncontains": return (p) => !p.keywords.some((k) => k.toLowerCase().includes(v));
		case "is": return (p) => p.keywords.some((k) => k.toLowerCase() === v);
		default: return null;
	}
}
/** Folder paths compare case-insensitively; "" is the project root, and
*  everything is under it. */
function folderRule(op, value) {
	const v = value.toLowerCase().replace(/[\\/]+$/, "");
	switch (op) {
		case "is": return (p) => p.folder.toLowerCase() === v;
		case "under": return v === "" ? () => true : (p) => {
			const f = p.folder.toLowerCase();
			return f === v || f.startsWith(v + "/");
		};
		case "notunder": {
			const under = folderRule("under", value);
			return (p) => !under(p);
		}
		default: return null;
	}
}
function filetypeRule(op, value) {
	const v = value.toLowerCase().replace(/^\./, "");
	if (v === "") return op === "is" || op === "isnot" ? never : null;
	const hit = v === "raw" ? (p) => isRawExtension(extensionOf(p.filename)) : (p) => extensionOf(p.filename) === v;
	switch (op) {
		case "is": return hit;
		case "isnot": return (p) => !hit(p);
		default: return null;
	}
}
function dateRule(rule, now, get) {
	const value = rule.value ?? "";
	switch (rule.op) {
		case "lastdays":
		case "notlastdays": {
			const days = Number(value);
			if (!Number.isFinite(days) || value.trim() === "") return never;
			const cutoff = now - days * DAY_MS;
			return rule.op === "lastdays" ? (p) => get(p) >= cutoff : (p) => get(p) < cutoff;
		}
		case "before": {
			const day = parseDay(value);
			return day === null ? never : (p) => get(p) < day;
		}
		case "after": {
			const day = parseDay(value);
			return day === null ? never : (p) => get(p) >= day + DAY_MS;
		}
		case "between": {
			const lo = parseDay(value);
			const hi = parseDay(rule.value2 ?? "");
			if (lo === null || hi === null || lo > hi) return never;
			return (p) => {
				const t = get(p);
				return t >= lo && t < hi + DAY_MS;
			};
		}
		default: return null;
	}
}
function cameraText(p) {
	const s = [p.exif.cameraMake, p.exif.cameraModel].filter(Boolean).join(" ");
	return s === "" ? void 0 : s;
}
function shutterRule(op, value) {
	const v = parseShutterSeconds(value);
	const test = (cmp) => v === null ? never : (p) => {
		const s = p.exif.shutterSpeed !== void 0 ? parseShutterSeconds(p.exif.shutterSpeed) : null;
		return s !== null && cmp(s);
	};
	switch (op) {
		case "atleast": return test((s) => s >= v);
		case "atmost": return test((s) => s <= v);
		default: return null;
	}
}
function orientationRule(op, value) {
	if (op !== "is") return null;
	switch (value) {
		case "landscape": return (p) => p.width > p.height;
		case "portrait": return (p) => p.width < p.height;
		case "square": return (p) => p.width === p.height;
		default: return never;
	}
}
function gpsRule(op) {
	const has = (p) => p.exif.gpsLatitude !== void 0 && p.exif.gpsLongitude !== void 0;
	switch (op) {
		case "has": return has;
		case "hasnot": return (p) => !has(p);
		default: return null;
	}
}
function copyRule(op) {
	switch (op) {
		case "is": return (p) => p.copyOf !== void 0;
		case "isnot": return (p) => p.copyOf === void 0;
		default: return null;
	}
}
//#endregion
//#region src/model/collections.ts
const nameKey = (name) => name.trim().toLowerCase();
/** "Base", else "Base 2", "Base 3", … until free (case-insensitive). */
function uniqueName(list, base) {
	const taken = new Set(list.map((c) => nameKey(c.name)));
	if (!taken.has(nameKey(base))) return base;
	for (let n = 2;; n++) {
		const candidate = `${base} ${n}`;
		if (!taken.has(nameKey(candidate))) return candidate;
	}
}
/** Build a new, uniquely named collection. The caller inserts it. */
function createCollection(list, kind, baseName, id) {
	const name = uniqueName(list, baseName);
	return kind === "collection" ? {
		id,
		name,
		kind,
		memberIds: []
	} : {
		id,
		name,
		kind,
		match: "all",
		rules: []
	};
}
function renameCollection(list, id, name) {
	const target = list.find((c) => c.id === id);
	if (!target) return {
		ok: false,
		reason: "Collection no longer exists"
	};
	const clean = name.trim();
	if (clean === "") return {
		ok: false,
		reason: "Name can't be empty"
	};
	const clash = list.find((c) => c.id !== id && nameKey(c.name) === nameKey(clean));
	if (clash) return {
		ok: false,
		reason: `"${clash.name}" already exists`
	};
	target.name = clean;
	return { ok: true };
}
/** Deep-copy a collection under a fresh unique name and append it. */
function duplicateCollection(list, id, newId) {
	const source = list.find((c) => c.id === id);
	if (!source) return null;
	const name = uniqueName(list, source.name);
	const copy = source.kind === "collection" ? {
		id: newId,
		name,
		kind: "collection",
		memberIds: [...source.memberIds]
	} : {
		id: newId,
		name,
		kind: "smart",
		match: source.match,
		rules: source.rules.map((r) => ({ ...r }))
	};
	list.push(copy);
	return copy;
}
function removeCollection(list, id) {
	const idx = list.findIndex((c) => c.id === id);
	if (idx === -1) return false;
	list.splice(idx, 1);
	return true;
}
/** Append the ids not already present. Returns how many were added. */
function addMembers(c, ids) {
	const have = new Set(c.memberIds);
	let added = 0;
	for (const id of ids) if (!have.has(id)) {
		have.add(id);
		c.memberIds.push(id);
		added++;
	}
	return added;
}
/** Remove the given ids. Returns how many were actually members. */
function removeMembers(c, ids) {
	const drop = new Set(ids);
	const before = c.memberIds.length;
	c.memberIds = c.memberIds.filter((id) => !drop.has(id));
	return before - c.memberIds.length;
}
/** Whether the panel lists this collection for the open catalogue: smart
*  collections are queries (always), regular ones when empty or when at least
*  one member resolves here. Hidden ones stay intact — their photos live in
*  another project folder. */
function isRelevant(c, liveIds) {
	if (c.kind === "smart") return true;
	return c.memberIds.length === 0 || c.memberIds.some((id) => liveIds.has(id));
}
function resolveCount(c, liveIds, smartCount) {
	if (c.kind === "smart") return {
		shown: smartCount(c),
		elsewhere: 0
	};
	const shown = c.memberIds.filter((id) => liveIds.has(id)).length;
	return {
		shown,
		elsewhere: c.memberIds.length - shown
	};
}
/** Alphabetical, case-insensitive, stable; the input is left untouched. */
function sortedCollections(list) {
	return [...list].sort((a, b) => a.name.localeCompare(b.name, void 0, { sensitivity: "base" }));
}
//#endregion
//#region src/store.ts
const PANEL_ID = "com.safelight.collections.panel";
const SETTING_DATA = "data";
const SETTING_TARGET = "targetId";
const SETTING_UI = "ui";
const PERSIST_DELAY_MS = 300;
const PRUNE_DELAY_MS = 100;
const QUICK_NAME = "Quick Collection";
let cs;
let persistTimer;
let pruneTimer;
let removedIds = /* @__PURE__ */ new Set();
let ownFolderWrite = false;
let panelMounted = false;
let disposers = [];
function setPanelMounted(mounted) {
	panelMounted = mounted;
}
function initCollectionsStore() {
	const file = sanitizeFile(api.settings.get(SETTING_DATA, EMPTY_FILE));
	const storedTarget = api.settings.get(SETTING_TARGET, null);
	const ui = api.settings.get(SETTING_UI, {});
	cs = api.stores.create(() => ({
		revision: 0,
		collections: file.collections,
		activeId: null,
		targetId: file.collections.some((c) => c.id === storedTarget) ? storedTarget : null,
		showUnrelated: ui.showUnrelated === true,
		dialog: { kind: "none" },
		editingId: null,
		confirmDeleteId: null
	}));
	disposers.push(api.settings.onChange((key, value) => {
		if (key === SETTING_DATA) {
			const next = sanitizeFile(value);
			cs.setState((s) => ({
				collections: next.collections,
				activeId: next.collections.some((c) => c.id === s.activeId) ? s.activeId : null,
				targetId: next.collections.some((c) => c.id === s.targetId) ? s.targetId : null,
				revision: s.revision + 1
			}));
		} else if (key === SETTING_TARGET) {
			const target = typeof value === "string" ? value : null;
			cs.setState((s) => ({ targetId: s.collections.some((c) => c.id === target) ? target : null }));
		}
	}));
	disposers.push(api.stores.useUIStore.subscribe((s, prev) => {
		if (s.activeFolder !== prev.activeFolder && !ownFolderWrite && cs.getState().activeId) deactivateCollection();
	}));
}
/** Detach the core-store and settings listeners on extension disable — they
*  would otherwise keep firing into an unloaded module. */
function disposeCollectionsStore() {
	for (const dispose of disposers) dispose();
	disposers = [];
}
function bump() {
	cs.setState((s) => ({ revision: s.revision + 1 }));
}
function persist() {
	if (persistTimer !== void 0) clearTimeout(persistTimer);
	persistTimer = setTimeout(flushPersist, PERSIST_DELAY_MS);
}
function flushPersist() {
	if (persistTimer !== void 0) {
		clearTimeout(persistTimer);
		persistTimer = void 0;
	}
	try {
		const file = {
			version: 1,
			collections: cs.getState().collections
		};
		api.settings.set(SETTING_DATA, file);
	} catch (err) {
		console.warn("[collections] failed to persist:", err);
	}
}
function persistTarget() {
	try {
		api.settings.set(SETTING_TARGET, cs.getState().targetId);
	} catch (err) {
		console.warn("[collections] failed to persist target:", err);
	}
}
const byId = (id) => id === null ? void 0 : cs.getState().collections.find((c) => c.id === id);
/** The grid predicate for the active collection; null when none is active. */
function activePredicate() {
	const active = byId(cs.getState().activeId);
	if (!active) return null;
	if (active.kind === "smart") return compileRules(active.rules, active.match, Date.now());
	const members = new Set(active.memberIds);
	return (p) => members.has(p.id);
}
/** The photo fields activePredicate reads, for the grid filter's `reads`: none
*  with no collection active, or a regular one, which goes by photo id (a change
*  to its members registers the filter again). Undefined for a smart one, whose
*  rules may read any field. */
function activeReads() {
	return byId(cs.getState().activeId)?.kind === "smart" ? void 0 : [];
}
function toggleActive(id) {
	if (cs.getState().activeId === id) {
		deactivateCollection();
		return;
	}
	if (!byId(id)) return;
	cs.setState({ activeId: id });
	ownFolderWrite = true;
	try {
		api.stores.useUIStore.getState().setActiveFolder(null);
	} finally {
		ownFolderWrite = false;
	}
}
function deactivateCollection() {
	if (cs.getState().activeId !== null) cs.setState({ activeId: null });
}
function createRegular(name) {
	const { collections } = cs.getState();
	const entry = createCollection(collections, "collection", name ?? "New Collection", crypto.randomUUID());
	collections.push(entry);
	cs.setState({ editingId: name === void 0 ? entry.id : null });
	persist();
	bump();
	return entry.id;
}
function createSmart() {
	cs.setState({ dialog: {
		kind: "smartEdit",
		collectionId: null
	} });
}
function editSmart(id) {
	cs.setState({ dialog: {
		kind: "smartEdit",
		collectionId: id
	} });
}
function saveSmart(id, name, match, rules) {
	const { collections } = cs.getState();
	const clean = name.trim();
	const cloned = rules.map((r) => ({ ...r }));
	if (id === null) {
		if (clean === "") return {
			ok: false,
			reason: "Name can't be empty"
		};
		const clash = collections.find((c) => c.name.trim().toLowerCase() === clean.toLowerCase());
		if (clash) return {
			ok: false,
			reason: `"${clash.name}" already exists`
		};
		collections.push({
			id: crypto.randomUUID(),
			name: clean,
			kind: "smart",
			match,
			rules: cloned
		});
	} else {
		const target = byId(id);
		if (!target || target.kind !== "smart") return {
			ok: false,
			reason: "Collection no longer exists"
		};
		const renamed = renameCollection(collections, id, clean);
		if (!renamed.ok) return renamed;
		target.match = match;
		target.rules = cloned;
	}
	cs.setState({ dialog: { kind: "none" } });
	persist();
	bump();
	return { ok: true };
}
function renameAction(id, name) {
	const result = renameCollection(cs.getState().collections, id, name);
	if (result.ok) {
		cs.setState({ editingId: null });
		persist();
		bump();
	} else api.ui.notify({
		message: result.reason,
		tone: "warning"
	});
	return result;
}
function duplicateAction(id) {
	if (duplicateCollection(cs.getState().collections, id, crypto.randomUUID())) {
		persist();
		bump();
	}
}
function deleteAction(id) {
	const { collections } = cs.getState();
	if (!removeCollection(collections, id)) return;
	cs.setState((s) => ({
		activeId: s.activeId === id ? null : s.activeId,
		targetId: s.targetId === id ? null : s.targetId,
		confirmDeleteId: s.confirmDeleteId === id ? null : s.confirmDeleteId,
		editingId: s.editingId === id ? null : s.editingId
	}));
	if (api.settings.get(SETTING_TARGET, null) === id) persistTarget();
	persist();
	bump();
}
function setTarget(id) {
	if (id !== null && byId(id)?.kind !== "collection") return;
	cs.setState({ targetId: id });
	persistTarget();
}
function addPhotosTo(collectionId, photoIds) {
	const c = byId(collectionId);
	if (c?.kind !== "collection" || photoIds.length === 0) return;
	const added = addMembers(c, photoIds);
	api.ui.notify(added > 0 ? `Added ${added} to "${c.name}"` : `Already in "${c.name}"`);
	if (added > 0) {
		persist();
		bump();
	}
}
function removePhotosFrom(collectionId, photoIds) {
	const c = byId(collectionId);
	if (c?.kind !== "collection" || photoIds.length === 0) return;
	const removed = removeMembers(c, photoIds);
	if (removed > 0) {
		api.ui.notify(`Removed ${removed} from "${c.name}"`);
		persist();
		bump();
	}
}
/** The `B` shortcut: everything targeted is already in the target collection →
*  take it out; otherwise complete the membership (Lightroom Quick Collection
*  semantics). First use with no target creates one. */
function toggleTargetMembership(photoIds) {
	if (photoIds.length === 0) return;
	let target = byId(cs.getState().targetId);
	if (target?.kind !== "collection") {
		const { collections } = cs.getState();
		const entry = createCollection(collections, "collection", uniqueName(collections, QUICK_NAME), crypto.randomUUID());
		collections.push(entry);
		cs.setState({ targetId: entry.id });
		persistTarget();
		target = entry;
	}
	const members = new Set(target.memberIds);
	if (photoIds.every((id) => members.has(id))) removePhotosFrom(target.id, photoIds);
	else addPhotosTo(target.id, photoIds);
}
/** Core reports a bulk removal one photo at a time, with other extensions'
*  hooks (file I/O) in between, so removals gather until they go quiet and a
*  bulk removal prunes, persists and re-derives the grid filter once. */
function pruneRemovedPhoto(photoId) {
	removedIds.add(photoId);
	if (pruneTimer !== void 0) clearTimeout(pruneTimer);
	pruneTimer = setTimeout(flushRemovedPhotos, PRUNE_DELAY_MS);
}
function flushRemovedPhotos() {
	if (pruneTimer !== void 0) {
		clearTimeout(pruneTimer);
		pruneTimer = void 0;
	}
	if (removedIds.size === 0) return;
	const ids = [...removedIds];
	removedIds = /* @__PURE__ */ new Set();
	let changed = false;
	for (const c of cs.getState().collections) if (c.kind === "collection" && removeMembers(c, ids) > 0) changed = true;
	if (changed) {
		persist();
		bump();
	}
}
function openAddTo(photoIds) {
	if (photoIds.length === 0) return;
	cs.setState({ dialog: {
		kind: "addTo",
		photoIds
	} });
	if (!panelMounted) api.dock.togglePanel(PANEL_ID);
}
function closeDialog() {
	cs.setState({ dialog: { kind: "none" } });
}
function setEditing(id) {
	cs.setState({ editingId: id });
}
function setConfirmDelete(id) {
	cs.setState({ confirmDeleteId: id });
}
function toggleShowUnrelated() {
	const next = !cs.getState().showUnrelated;
	cs.setState({ showUnrelated: next });
	try {
		api.settings.set(SETTING_UI, { showUnrelated: next });
	} catch (err) {
		console.warn("[collections] failed to persist ui state:", err);
	}
}
//#endregion
//#region src/ui/menu.tsx
function useMenu() {
	const [open, setOpen] = React.useState(null);
	const openMenu = React.useCallback((e, items) => {
		setOpen({
			x: e.clientX,
			y: e.clientY,
			items
		});
	}, []);
	const close = React.useCallback(() => setOpen(null), []);
	const { ContextMenu } = api.components;
	return {
		menu: open ? /* @__PURE__ */ React.createElement(ContextMenu, {
			x: open.x,
			y: open.y,
			items: open.items,
			onClose: close
		}) : null,
		openMenu
	};
}
//#endregion
//#region src/ui/icons.ts
function svg(size, children, viewBox = "0 0 12 12") {
	return React.createElement("svg", {
		width: size,
		height: size,
		viewBox,
		fill: "none",
		"aria-hidden": true
	}, ...children);
}
/** A stack of photos: the regular-collection glyph. */
function collectionIcon(size = 12) {
	return svg(size, [React.createElement("rect", {
		key: "back",
		x: 3,
		y: 1.5,
		width: 7.5,
		height: 6,
		rx: 1,
		stroke: "currentColor",
		strokeWidth: 1,
		opacity: .55
	}), React.createElement("rect", {
		key: "front",
		x: 1.5,
		y: 4,
		width: 7.5,
		height: 6,
		rx: 1,
		stroke: "currentColor",
		strokeWidth: 1,
		fill: ui.tokens.surface1
	})]);
}
/** The photo stack with a spark: the smart-collection glyph. */
function smartIcon(size = 12) {
	return svg(size, [
		React.createElement("rect", {
			key: "back",
			x: 3,
			y: 1.5,
			width: 7.5,
			height: 6,
			rx: 1,
			stroke: "currentColor",
			strokeWidth: 1,
			opacity: .55
		}),
		React.createElement("rect", {
			key: "front",
			x: 1.5,
			y: 4,
			width: 7.5,
			height: 6,
			rx: 1,
			stroke: "currentColor",
			strokeWidth: 1,
			fill: ui.tokens.surface1
		}),
		React.createElement("path", {
			key: "spark",
			d: "M5.25 5.1 L5.85 6.4 L7.15 7 L5.85 7.6 L5.25 8.9 L4.65 7.6 L3.35 7 L4.65 6.4 Z",
			fill: "currentColor"
		})
	]);
}
function plusIcon(size = 12) {
	return svg(size, [React.createElement("path", {
		key: "p",
		d: "M6 2.5 V9.5 M2.5 6 H9.5",
		stroke: "currentColor",
		strokeWidth: 1.2,
		strokeLinecap: "round"
	})]);
}
//#endregion
//#region src/ui/Overlay.tsx
function Overlay({ title, width, onClose, children, footer }) {
	const t = ui.tokens;
	const onCloseRef = React.useRef(onClose);
	onCloseRef.current = onClose;
	React.useEffect(() => ui.onEscape(() => onCloseRef.current()), []);
	return /* @__PURE__ */ React.createElement("div", {
		style: {
			position: "fixed",
			inset: 0,
			zIndex: 900,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			background: "rgba(0,0,0,0.5)"
		},
		onClick: onClose
	}, /* @__PURE__ */ React.createElement("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			width: `min(94vw, ${width}px)`,
			maxHeight: "80vh",
			padding: 14,
			borderRadius: 8,
			border: `1px solid ${t.border}`,
			background: t.surface1,
			boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
			color: t.textPrimary,
			fontSize: 11
		},
		onClick: (e) => e.stopPropagation()
	}, /* @__PURE__ */ React.createElement("div", { style: {
		fontSize: 13,
		fontWeight: 600
	} }, title), /* @__PURE__ */ React.createElement("div", { style: {
		flex: 1,
		minHeight: 0,
		overflowY: "auto",
		display: "flex",
		flexDirection: "column",
		gap: 8
	} }, children), footer && /* @__PURE__ */ React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		justifyContent: "flex-end"
	} }, footer)));
}
//#endregion
//#region src/ui/AddToDialog.tsx
function AddToDialog({ photoIds }) {
	const revision = cs((s) => s.revision);
	const [newName, setNewName] = React.useState("");
	const t = ui.tokens;
	const regulars = React.useMemo(() => sortedCollections(cs.getState().collections).filter((c) => c.kind === "collection"), [revision]);
	const createAndAdd = () => {
		const name = newName.trim();
		if (name === "") return;
		addPhotosTo(createRegular(name), photoIds);
		setNewName("");
	};
	return /* @__PURE__ */ React.createElement(Overlay, {
		title: `Add ${photoIds.length} ${photoIds.length === 1 ? "photo" : "photos"} to collection`,
		width: 380,
		onClose: closeDialog,
		footer: /* @__PURE__ */ React.createElement(ui.Button, {
			variant: "primary",
			size: "sm",
			onClick: closeDialog
		}, "Done")
	}, regulars.length === 0 && /* @__PURE__ */ React.createElement("p", { style: {
		fontSize: 10,
		color: t.textMuted
	} }, "No collections yet — create one below."), regulars.map((c) => /* @__PURE__ */ React.createElement(CheckRow, {
		key: c.id,
		c,
		photoIds
	})), /* @__PURE__ */ React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		marginTop: 4
	} }, /* @__PURE__ */ React.createElement(ui.TextInput, {
		value: newName,
		onChange: setNewName,
		placeholder: "New collection…",
		onKeyDown: (e) => {
			if (e.key === "Enter") createAndAdd();
		}
	}), /* @__PURE__ */ React.createElement(ui.Button, {
		variant: "secondary",
		size: "sm",
		onClick: createAndAdd,
		disabled: newName.trim() === ""
	}, "Create")));
}
function CheckRow({ c, photoIds }) {
	const t = ui.tokens;
	const [hover, setHover] = React.useState(false);
	const members = new Set(c.memberIds);
	const inCount = photoIds.filter((id) => members.has(id)).length;
	const checked = inCount === photoIds.length && photoIds.length > 0;
	const indeterminate = inCount > 0 && !checked;
	const boxRef = React.useRef(null);
	React.useEffect(() => {
		if (boxRef.current) boxRef.current.indeterminate = indeterminate;
	}, [indeterminate]);
	const toggle = () => {
		if (checked) removePhotosFrom(c.id, photoIds);
		else addPhotosTo(c.id, photoIds);
	};
	return /* @__PURE__ */ React.createElement("label", {
		onMouseEnter: () => setHover(true),
		onMouseLeave: () => setHover(false),
		style: {
			display: "flex",
			alignItems: "center",
			gap: 8,
			padding: "4px 6px",
			borderRadius: 4,
			cursor: "pointer",
			background: hover ? t.surface2 : "transparent"
		}
	}, /* @__PURE__ */ React.createElement("input", {
		ref: boxRef,
		type: "checkbox",
		checked,
		onChange: toggle,
		style: {
			accentColor: t.accent,
			margin: 0
		}
	}), /* @__PURE__ */ React.createElement("span", { style: {
		flex: 1,
		minWidth: 0,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	} }, c.name), /* @__PURE__ */ React.createElement("span", { style: {
		fontSize: 10,
		color: t.textMuted
	} }, c.memberIds.length));
}
//#endregion
//#region src/ui/SmartEditor.tsx
const STARTER_RULE = {
	field: "rating",
	op: "atleast",
	value: "3"
};
/** A fresh rule for a field: its first op, enum value preseeded so the rule is
*  well-formed from the moment it appears. */
function freshRule(def) {
	const op = def.ops[0];
	const rule = {
		field: def.field,
		op: op.op
	};
	if (op.values >= 1 && def.kind === "enum" && def.options) rule.value = def.options[0].value;
	return rule;
}
function SmartEditor({ collectionId }) {
	const revision = cs((s) => s.revision);
	const existing = React.useMemo(() => collectionId === null ? null : cs.getState().collections.find((c) => c.id === collectionId && c.kind === "smart") ?? null, [collectionId, revision]);
	const [name, setName] = React.useState(existing?.name ?? "");
	const [match, setMatch] = React.useState(existing?.match ?? "all");
	const [rules, setRules] = React.useState(existing && existing.rules.length > 0 ? existing.rules.map((r) => ({ ...r })) : [{ ...STARTER_RULE }]);
	const [error, setError] = React.useState(null);
	const photos = api.stores.useCatalogStore((s) => s.photos);
	const t = ui.tokens;
	const matchCount = React.useMemo(() => photos.filter(compileRules(rules, match, Date.now())).length, [
		rules,
		match,
		photos
	]);
	const vanished = collectionId !== null && existing === null;
	React.useEffect(() => {
		if (vanished) closeDialog();
	}, [vanished]);
	if (vanished) return null;
	const patchRule = (i, next) => {
		setRules(rules.map((r, idx) => idx === i ? next : r));
	};
	const save = () => {
		const result = saveSmart(collectionId, name, match, rules);
		if (!result.ok) setError(result.reason ?? "Couldn't save");
	};
	return /* @__PURE__ */ React.createElement(Overlay, {
		title: collectionId === null ? "New smart collection" : "Edit smart collection",
		width: 560,
		onClose: closeDialog,
		footer: /* @__PURE__ */ React.createElement(React.Fragment, null, error && /* @__PURE__ */ React.createElement("span", { style: {
			marginRight: "auto",
			fontSize: 10,
			color: t.labelRed
		} }, error), /* @__PURE__ */ React.createElement("span", { style: {
			marginRight: error ? 0 : "auto",
			fontSize: 10,
			color: t.textMuted
		} }, "Matches ", matchCount, " of ", photos.length, " photos"), /* @__PURE__ */ React.createElement(ui.Button, {
			variant: "ghost",
			size: "sm",
			onClick: closeDialog
		}, "Cancel"), /* @__PURE__ */ React.createElement(ui.Button, {
			variant: "primary",
			size: "sm",
			onClick: save
		}, "Save"))
	}, /* @__PURE__ */ React.createElement(ui.TextInput, {
		value: name,
		onChange: (v) => {
			setName(v);
			setError(null);
		},
		placeholder: "Smart collection name"
	}), /* @__PURE__ */ React.createElement("div", { style: { width: 170 } }, /* @__PURE__ */ React.createElement(ui.Select, {
		value: match,
		onChange: (v) => setMatch(v === "any" ? "any" : "all"),
		options: [{
			value: "all",
			label: "Match all rules"
		}, {
			value: "any",
			label: "Match any rule"
		}],
		ariaLabel: "Rule matching"
	})), rules.map((rule, i) => /* @__PURE__ */ React.createElement(RuleRow, {
		key: i,
		rule,
		onChange: (next) => patchRule(i, next),
		onRemove: rules.length > 1 ? () => setRules(rules.filter((_, idx) => idx !== i)) : void 0
	})), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(ui.Button, {
		variant: "ghost",
		size: "sm",
		onClick: () => setRules([...rules, { ...STARTER_RULE }]),
		title: "Add rule"
	}, /* @__PURE__ */ React.createElement("span", { style: {
		display: "inline-flex",
		alignItems: "center",
		gap: 4
	} }, plusIcon(10), " Add rule"))));
}
function valuePlaceholder(def, op) {
	if (def.kind === "date") return op === "lastdays" || op === "notlastdays" ? "days" : "YYYY-MM-DD";
	if (def.field === "shutter") return "e.g. 1/250";
	if (def.kind === "number") return "value";
	return "text";
}
function RuleRow({ rule, onChange, onRemove }) {
	const t = ui.tokens;
	const def = fieldDef(rule.field);
	const opDef = def?.ops.find((o) => o.op === rule.op);
	if (!def || !opDef) return /* @__PURE__ */ React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		fontSize: 10,
		color: t.textMuted
	} }, /* @__PURE__ */ React.createElement("span", { style: { flex: 1 } }, "Unsupported rule (", rule.field, " ", rule.op, ") — kept, but matches nothing here."), onRemove && /* @__PURE__ */ React.createElement(RemoveButton, { onRemove }));
	const changeField = (field) => {
		const nextDef = fieldDef(field);
		if (nextDef) onChange(freshRule(nextDef));
	};
	const changeOp = (op) => {
		const nextOp = def.ops.find((o) => o.op === op);
		if (!nextOp) return;
		const next = {
			field: rule.field,
			op
		};
		if (nextOp.values >= 1 && rule.value !== void 0) next.value = rule.value;
		if (nextOp.values >= 1 && next.value === void 0 && def.kind === "enum" && def.options) next.value = def.options[0].value;
		if (nextOp.values === 2 && rule.value2 !== void 0) next.value2 = rule.value2;
		onChange(next);
	};
	const valueSlot = (slot) => {
		const key = slot === 1 ? "value" : "value2";
		const current = rule[key] ?? "";
		if (def.kind === "enum" && def.options) return /* @__PURE__ */ React.createElement(ui.Select, {
			value: current,
			onChange: (v) => onChange({
				...rule,
				[key]: v
			}),
			options: def.options,
			ariaLabel: `${def.label} value`
		});
		return /* @__PURE__ */ React.createElement("div", { style: { width: slot === 2 || opDef.values === 2 ? 90 : 130 } }, /* @__PURE__ */ React.createElement(ui.TextInput, {
			value: current,
			onChange: (v) => onChange({
				...rule,
				[key]: v
			}),
			placeholder: valuePlaceholder(def, rule.op)
		}));
	};
	return /* @__PURE__ */ React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 6
	} }, /* @__PURE__ */ React.createElement(ui.Select, {
		value: rule.field,
		onChange: changeField,
		options: FIELD_DEFS.map((d) => ({
			value: d.field,
			label: d.label
		})),
		ariaLabel: "Rule field"
	}), /* @__PURE__ */ React.createElement(ui.Select, {
		value: rule.op,
		onChange: changeOp,
		options: def.ops.map((o) => ({
			value: o.op,
			label: o.label
		})),
		ariaLabel: "Rule operator"
	}), opDef.values >= 1 && valueSlot(1), opDef.values === 2 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: {
		fontSize: 10,
		color: t.textMuted
	} }, "and"), valueSlot(2)), /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto" } }, onRemove && /* @__PURE__ */ React.createElement(RemoveButton, { onRemove })));
}
function RemoveButton({ onRemove }) {
	const t = ui.tokens;
	const [hover, setHover] = React.useState(false);
	return /* @__PURE__ */ React.createElement("button", {
		onClick: onRemove,
		onMouseEnter: () => setHover(true),
		onMouseLeave: () => setHover(false),
		title: "Remove rule",
		"aria-label": "Remove rule",
		style: {
			background: "transparent",
			border: "none",
			padding: "0 4px",
			cursor: "pointer",
			color: hover ? t.labelRed : t.textMuted,
			fontSize: 13,
			lineHeight: 1
		}
	}, "×");
}
//#endregion
//#region src/ui/CollectionsPanel.tsx
const DND_PHOTOS = "application/x-safelight-photos";
function CollectionsPanel() {
	const revision = cs((s) => s.revision);
	const activeId = cs((s) => s.activeId);
	const targetId = cs((s) => s.targetId);
	const showUnrelated = cs((s) => s.showUnrelated);
	const dialog = cs((s) => s.dialog);
	const photos = api.stores.useCatalogStore((s) => s.photos);
	const { menu, openMenu } = useMenu();
	React.useEffect(() => {
		setPanelMounted(true);
		return () => setPanelMounted(false);
	}, []);
	const live = React.useMemo(() => new Set(photos.map((p) => p.id)), [photos]);
	const counts = React.useMemo(() => {
		const now = Date.now();
		const map = /* @__PURE__ */ new Map();
		for (const c of cs.getState().collections) map.set(c.id, resolveCount(c, live, (sc) => photos.filter(compileRules(sc.rules, sc.match, now)).length));
		return map;
	}, [
		revision,
		photos,
		live
	]);
	const sorted = React.useMemo(() => sortedCollections(cs.getState().collections), [revision]);
	const hidden = sorted.filter((c) => !isRelevant(c, live));
	const visible = showUnrelated ? sorted : sorted.filter((c) => isRelevant(c, live));
	const t = ui.tokens;
	return /* @__PURE__ */ React.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: 2,
		padding: 8,
		fontSize: 11
	} }, visible.length === 0 ? /* @__PURE__ */ React.createElement("p", { style: {
		padding: "6px 4px",
		fontSize: 10,
		color: t.textMuted,
		lineHeight: 1.5
	} }, "No collections yet. Create one below, then add photos by right-click, drag-and-drop, or B for the target collection.") : visible.map((c) => /* @__PURE__ */ React.createElement(Row, {
		key: c.id,
		c,
		active: activeId === c.id,
		isTarget: targetId === c.id,
		unrelated: !isRelevant(c, live),
		count: counts.get(c.id) ?? {
			shown: 0,
			elsewhere: 0
		},
		openMenu
	})), /* @__PURE__ */ React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 4,
		marginTop: 6
	} }, /* @__PURE__ */ React.createElement(ui.Button, {
		variant: "ghost",
		size: "sm",
		title: "New collection",
		onClick: () => createRegular()
	}, /* @__PURE__ */ React.createElement("span", { style: {
		display: "inline-flex",
		alignItems: "center",
		gap: 4
	} }, plusIcon(10), " Collection")), /* @__PURE__ */ React.createElement(ui.Button, {
		variant: "ghost",
		size: "sm",
		title: "New smart collection",
		onClick: () => createSmart()
	}, /* @__PURE__ */ React.createElement("span", { style: {
		display: "inline-flex",
		alignItems: "center",
		gap: 4
	} }, plusIcon(10), " Smart")), hidden.length > 0 && /* @__PURE__ */ React.createElement("button", {
		onClick: toggleShowUnrelated,
		style: {
			marginLeft: "auto",
			background: "transparent",
			border: "none",
			padding: "2px 4px",
			cursor: "pointer",
			fontSize: 10,
			color: t.textMuted
		},
		title: "Collections whose photos live in other project folders"
	}, showUnrelated ? "Hide other projects" : `Show ${hidden.length} from other projects`)), menu, dialog.kind === "addTo" && /* @__PURE__ */ React.createElement(AddToDialog, { photoIds: dialog.photoIds }), dialog.kind === "smartEdit" && /* @__PURE__ */ React.createElement(SmartEditor, {
		key: dialog.collectionId ?? "new",
		collectionId: dialog.collectionId
	}));
}
function Row({ c, active, isTarget, unrelated, count, openMenu }) {
	const editing = cs((s) => s.editingId) === c.id;
	const confirming = cs((s) => s.confirmDeleteId) === c.id;
	const [hover, setHover] = React.useState(false);
	const [dropHover, setDropHover] = React.useState(false);
	const t = ui.tokens;
	const menuItems = () => {
		const items = [{
			label: "Rename",
			onClick: () => setEditing(c.id)
		}, {
			label: "Duplicate",
			onClick: () => duplicateAction(c.id)
		}];
		if (c.kind === "collection") items.push(isTarget ? {
			label: "Unset as target collection",
			onClick: () => setTarget(null)
		} : {
			label: "Set as target collection",
			onClick: () => setTarget(c.id)
		});
		else items.push({
			label: "Edit rules…",
			onClick: () => editSmart(c.id)
		});
		items.push({
			label: "Delete…",
			danger: true,
			onClick: () => setConfirmDelete(c.id)
		});
		return items;
	};
	const acceptsDrop = c.kind === "collection";
	const rowStyle = {
		display: "flex",
		alignItems: "center",
		gap: 6,
		padding: "4px 6px",
		borderRadius: 4,
		cursor: "pointer",
		userSelect: "none",
		opacity: unrelated ? .5 : 1,
		color: t.textPrimary,
		background: active ? t.surface3 : hover ? t.surface2 : "transparent",
		boxShadow: dropHover ? `inset 0 0 0 1px ${t.accent}` : active ? `inset 2px 0 0 0 ${t.accent}` : "none"
	};
	return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", {
		style: rowStyle,
		onMouseEnter: () => setHover(true),
		onMouseLeave: () => setHover(false),
		onClick: () => {
			if (!editing) toggleActive(c.id);
		},
		onDoubleClick: () => setEditing(c.id),
		onContextMenu: (e) => {
			e.preventDefault();
			openMenu(e, menuItems());
		},
		onDragOver: acceptsDrop ? (e) => {
			if (e.dataTransfer.types.includes(DND_PHOTOS)) {
				e.preventDefault();
				e.dataTransfer.dropEffect = "copy";
				setDropHover(true);
			}
		} : void 0,
		onDragLeave: acceptsDrop ? () => setDropHover(false) : void 0,
		onDrop: acceptsDrop ? (e) => {
			setDropHover(false);
			const raw = e.dataTransfer.getData(DND_PHOTOS);
			if (!raw) return;
			e.preventDefault();
			try {
				const ids = JSON.parse(raw);
				if (Array.isArray(ids) && ids.every((x) => typeof x === "string")) addPhotosTo(c.id, ids);
			} catch {}
		} : void 0
	}, /* @__PURE__ */ React.createElement("span", { style: {
		display: "flex",
		color: active ? t.accent : t.textMuted
	} }, c.kind === "smart" ? smartIcon(12) : collectionIcon(12)), editing ? /* @__PURE__ */ React.createElement(RenameInput, {
		id: c.id,
		initial: c.name
	}) : /* @__PURE__ */ React.createElement("span", { style: {
		flex: 1,
		minWidth: 0,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	} }, c.name), isTarget && /* @__PURE__ */ React.createElement("span", {
		title: "Target collection (B adds here)",
		style: {
			fontSize: 9,
			lineHeight: 1,
			padding: "2px 4px",
			borderRadius: 999,
			background: t.surface3,
			color: t.accent,
			fontWeight: 700
		}
	}, "+"), /* @__PURE__ */ React.createElement("span", {
		title: count.elsewhere > 0 ? `${count.shown} here · ${count.elsewhere} in other projects` : void 0,
		style: {
			fontSize: 10,
			color: t.textMuted
		}
	}, count.shown, count.elsewhere > 0 ? "*" : "")), confirming && /* @__PURE__ */ React.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		padding: "4px 6px 6px 24px",
		fontSize: 10,
		color: t.textSecondary
	} }, /* @__PURE__ */ React.createElement("span", { style: {
		flex: 1,
		minWidth: 0,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	} }, "Delete “", c.name, "”?"), /* @__PURE__ */ React.createElement(ui.Button, {
		variant: "danger",
		size: "sm",
		onClick: () => deleteAction(c.id)
	}, "Delete"), /* @__PURE__ */ React.createElement(ui.Button, {
		variant: "ghost",
		size: "sm",
		onClick: () => setConfirmDelete(null)
	}, "Cancel")));
}
function RenameInput({ id, initial }) {
	const [value, setValue] = React.useState(initial);
	const ref = React.useRef(null);
	const t = ui.tokens;
	React.useEffect(() => {
		ref.current?.focus();
		ref.current?.select();
	}, []);
	const commit = () => {
		if (value.trim() === "" || value.trim() === initial) {
			setEditing(null);
			return;
		}
		if (!renameAction(id, value).ok) ref.current?.focus();
	};
	return /* @__PURE__ */ React.createElement("input", {
		ref,
		value,
		onChange: (e) => setValue(e.target.value),
		onClick: (e) => e.stopPropagation(),
		onDoubleClick: (e) => e.stopPropagation(),
		onKeyDown: (e) => {
			e.stopPropagation();
			if (e.key === "Enter") commit();
			if (e.key === "Escape") setEditing(null);
		},
		onBlur: commit,
		style: {
			flex: 1,
			minWidth: 0,
			boxSizing: "border-box",
			borderRadius: 4,
			border: `1px solid ${t.borderSubtle}`,
			background: t.surface2,
			color: t.textPrimary,
			fontSize: 11,
			padding: "2px 6px",
			outline: "none"
		}
	});
}
//#endregion
//#region src/index.tsx
const ID = "com.safelight.collections";
const FILTER_ID = `${ID}.filter`;
function activate(api) {
	initRuntime(api);
	initCollectionsStore();
	api.registerPanel({
		id: PANEL_ID,
		title: "Collections",
		component: CollectionsPanel,
		defaultDock: {
			module: "library",
			direction: "left",
			order: .5,
			width: 240
		}
	});
	const syncFilter = () => {
		const predicate = activePredicate();
		api.registerGridFilter({
			id: FILTER_ID,
			test: predicate ?? (() => true),
			reads: activeReads(),
			onClear: deactivateCollection
		});
	};
	syncFilter();
	let hadActive = false;
	cs.subscribe((s, prev) => {
		const has = s.activeId !== null;
		if (s.activeId !== prev.activeId || has && s.revision !== prev.revision || has !== hadActive) {
			hadActive = has;
			syncFilter();
		}
	});
	api.registerGridMenuItem({
		id: `${ID}.add`,
		order: 13,
		label: (ids) => ids.length > 1 ? `Add to collection… (${ids.length})` : "Add to collection…",
		onClick: openAddTo
	});
	const activeRegular = () => {
		const s = cs.getState();
		const active = s.collections.find((c) => c.id === s.activeId);
		return active?.kind === "collection" ? active : null;
	};
	api.registerGridMenuItem({
		id: `${ID}.remove`,
		order: 14,
		label: (ids) => {
			const active = activeRegular();
			if (!active) return "Remove from collection";
			return ids.length > 1 ? `Remove from “${active.name}” (${ids.length})` : `Remove from “${active.name}”`;
		},
		enabled: (ids) => {
			const active = activeRegular();
			return active !== null && ids.some((id) => active.memberIds.includes(id));
		},
		onClick: (ids) => {
			const active = activeRegular();
			if (active) removePhotosFrom(active.id, ids);
		}
	});
	api.registerKeybinding({
		id: `${ID}.target`,
		label: "Toggle selection in target collection",
		category: "Library",
		defaultCombo: "B",
		handler: () => toggleTargetMembership(api.catalog.targetIds())
	});
	api.registerCatalogHooks({
		id: `${ID}.hygiene`,
		async onPhotoRemove({ photo }) {
			pruneRemovedPhoto(photo.id);
		}
	});
}
function deactivate() {
	flushRemovedPhotos();
	flushPersist();
	disposeCollectionsStore();
}
//#endregion
export { activate, deactivate };
