import { defineStore } from 'pinia';

const STORAGE_KEY = 'shakeDetections';
const STORAGE_VERSION = 2;
const MAX_ITEMS = 200;

function safeParse(json) {
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function nowMs() {
    return Date.now();
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function shindoLabelRank(label) {
    // JMA shindo label ordering
    const v = normalizeString(label);
    if (!v || v === '?') return -1;
    const map = {
        '0': 0,
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5弱': 5,
        '5強': 6,
        '6弱': 7,
        '6強': 8,
        '7': 9,
    };
    if (Object.prototype.hasOwnProperty.call(map, v)) return map[v];
    const n = Number(v);
    return Number.isFinite(n) ? n : -1;
}

function pickMaxShindo(prevLabel, nextLabel) {
    const a = shindoLabelRank(prevLabel);
    const b = shindoLabelRank(nextLabel);
    if (b > a) return normalizeString(nextLabel);
    return normalizeString(prevLabel);
}

function buildShakeId({ source, originTimeText, timeZone }) {
    return `shake:${source}:${originTimeText}:UTC+${timeZone}`;
}

function buildTsunamiId({ source, id }) {
    return `tsunami:${source}:${id || 'unknown'}`;
}

export const useShakeDetectionsStore = defineStore('shakeDetectionsStore', {
    state: () => ({
        items: [],
        captureEnabled: true,
        hydrated: false,
    }),
    getters: {
        sortedItems: (state) => {
            // 最新(作成/開始)が一番上。更新時刻で並びが揺れないよう createdAtMs 優先。
            return [...state.items].sort((a, b) => {
                const at = (b?.createdAtMs ?? b?.updatedAtMs ?? 0) - (a?.createdAtMs ?? a?.updatedAtMs ?? 0);
                if (at !== 0) return at;
                return (b?.updatedAtMs ?? 0) - (a?.updatedAtMs ?? a?.updatedAtMs ?? 0);
            });
        },
    },
    actions: {
        hydrateFromStorage(raw) {
            if (this.hydrated) return;

            const parsed = safeParse(raw);
            if (!parsed || typeof parsed !== 'object') {
                this.hydrated = true;
                return;
            }

            const version = parsed.version;
            const items = parsed.items;
            if (!Array.isArray(items) || (version !== 1 && version !== STORAGE_VERSION)) {
                this.hydrated = true;
                return;
            }

            const captureEnabled = parsed.captureEnabled;
            if (typeof captureEnabled === 'boolean') this.captureEnabled = captureEnabled;

            this.items = items
                .filter((x) => x && typeof x === 'object')
                .slice(0, MAX_ITEMS);
            this.hydrated = true;
        },

        serialize() {
            return JSON.stringify({ version: STORAGE_VERSION, captureEnabled: !!this.captureEnabled, items: this.items });
        },

        persist() {
            localStorage.setItem(STORAGE_KEY, this.serialize());
        },

        _upsert(nextItem) {
            if (!nextItem || typeof nextItem !== 'object') return;

            const index = this.items.findIndex((x) => x?.id === nextItem.id);
            if (index === -1) {
                this.items.unshift(nextItem);
            } else {
                const prev = this.items[index];
                const merged = { ...prev, ...nextItem, updatedAtMs: nowMs() };
                this.items.splice(index, 1);
                this.items.unshift(merged);
            }

            if (this.items.length > MAX_ITEMS) {
                this.items.length = MAX_ITEMS;
            }
        },

        setCaptureEnabled(enabled) {
            this.captureEnabled = !!enabled;
        },

        removeItem(id) {
            const normalizedId = normalizeString(id);
            if (!normalizedId) return;
            const index = this.items.findIndex((x) => x?.id === normalizedId);
            if (index === -1) return;
            this.items.splice(index, 1);
        },

        upsertShake({ id, source, epicenterName, originTimeText, timeZone, depthKm, obsCount, maxShindo }) {
            if (!this.captureEnabled) return;
            const normalizedSource = normalizeString(source);
            const normalizedOriginTimeText = normalizeString(originTimeText);
            const normalizedEpicenterName = normalizeString(epicenterName);
            const normalizedMaxShindo = normalizeString(maxShindo);

            if (!normalizedSource || !normalizedOriginTimeText || !Number.isInteger(timeZone)) return;

            const normalizedId = normalizeString(id);
            const itemId =
                normalizedId ||
                buildShakeId({
                    source: normalizedSource,
                    originTimeText: normalizedOriginTimeText,
                    timeZone,
                });

            const nextItem = {
                id: itemId,
                kind: 'shake',
                source: normalizedSource,
                epicenterName: normalizedEpicenterName,
                originTimeText: normalizedOriginTimeText,
                timeZone,
                depthKm: isFiniteNumber(depthKm) ? depthKm : null,
                obsCount: Number.isInteger(obsCount) ? obsCount : null,
                maxShindo: normalizedMaxShindo || null,
                updatedAtMs: nowMs(),
                createdAtMs: nowMs(),
            };

            const prev = this.items.find((x) => x?.id === itemId);
            if (prev) {
                // keep max intensity through the session
                nextItem.maxShindo = pickMaxShindo(prev.maxShindo, nextItem.maxShindo) || null;
                const unchanged =
                    prev.epicenterName === nextItem.epicenterName &&
                    prev.originTimeText === nextItem.originTimeText &&
                    prev.timeZone === nextItem.timeZone &&
                    prev.depthKm === nextItem.depthKm &&
                    prev.obsCount === nextItem.obsCount &&
                    prev.maxShindo === nextItem.maxShindo;
                if (unchanged) return;
                nextItem.createdAtMs = prev.createdAtMs;
            }

            this._upsert(nextItem);
        },

        upsertTsunami({ source, id, titleText, reportTime, timeZone, status }) {
            if (!this.captureEnabled) return;
            const normalizedSource = normalizeString(source);
            const normalizedId = normalizeString(id);

            if (!normalizedSource) return;

            const itemId = buildTsunamiId({ source: normalizedSource, id: normalizedId });
            const nextItem = {
                id: itemId,
                kind: 'tsunami',
                source: normalizedSource,
                epicenterName: normalizeString(titleText),
                originTimeText: normalizeString(reportTime),
                timeZone: Number.isInteger(timeZone) ? timeZone : 8,
                depthKm: null,
                obsCount: null,
                tsunamiStatus: Number.isInteger(status) ? status : null,
                updatedAtMs: nowMs(),
                createdAtMs: nowMs(),
            };

            const prev = this.items.find((x) => x?.id === itemId);
            if (prev) {
                const unchanged =
                    prev.epicenterName === nextItem.epicenterName &&
                    prev.originTimeText === nextItem.originTimeText &&
                    prev.timeZone === nextItem.timeZone &&
                    prev.tsunamiStatus === nextItem.tsunamiStatus;
                if (unchanged) return;
                nextItem.createdAtMs = prev.createdAtMs;
            }

            this._upsert(nextItem);
        },
    },
});
