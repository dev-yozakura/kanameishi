import { defineStore } from 'pinia';

const STORAGE_KEY = 'shakeDetections';
const STORAGE_VERSION = 1;
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

function buildShakeId({ source, originTimeText, timeZone }) {
    return `shake:${source}:${originTimeText}:UTC+${timeZone}`;
}

function buildTsunamiId({ source, id }) {
    return `tsunami:${source}:${id || 'unknown'}`;
}

export const useShakeDetectionsStore = defineStore('shakeDetectionsStore', {
    state: () => ({
        items: [],
        hydrated: false,
    }),
    getters: {
        sortedItems: (state) => {
            return [...state.items].sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
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
            if (version !== STORAGE_VERSION || !Array.isArray(items)) {
                this.hydrated = true;
                return;
            }

            this.items = items
                .filter((x) => x && typeof x === 'object')
                .slice(0, MAX_ITEMS);
            this.hydrated = true;
        },

        serialize() {
            return JSON.stringify({ version: STORAGE_VERSION, items: this.items });
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

        upsertShake({ id, source, epicenterName, originTimeText, timeZone, depthKm, obsCount }) {
            const normalizedSource = normalizeString(source);
            const normalizedOriginTimeText = normalizeString(originTimeText);
            const normalizedEpicenterName = normalizeString(epicenterName);

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
                updatedAtMs: nowMs(),
                createdAtMs: nowMs(),
            };

            const prev = this.items.find((x) => x?.id === itemId);
            if (prev) {
                const unchanged =
                    prev.epicenterName === nextItem.epicenterName &&
                    prev.originTimeText === nextItem.originTimeText &&
                    prev.timeZone === nextItem.timeZone &&
                    prev.depthKm === nextItem.depthKm &&
                    prev.obsCount === nextItem.obsCount;
                if (unchanged) return;
                nextItem.createdAtMs = prev.createdAtMs;
            }

            this._upsert(nextItem);
        },

        upsertTsunami({ source, id, titleText, reportTime, timeZone, status }) {
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
