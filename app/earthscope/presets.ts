import { CONTROL_SPECS, type VoiceControls, type VoiceControlKey } from "./controls";
import { LOW_PASS_LFO_TIMINGS, LOW_PASS_LFO_RATE_MIN, LOW_PASS_LFO_RATE_MAX, type LowPassLfoSettings } from "./lowPassLfo";
import { isSequenceLength, isSequencerNote, MAX_SEQUENCE_STEPS, type MelodicSequence } from "./sequencer";
import { TEMPO_MIN, TEMPO_MAX } from "./tempo";

export const PRESETS_STORAGE_KEY = "birdtown.presets.v1";
export const PRESET_NAME_MAX_LENGTH = 80;

export interface InstrumentPreset {
    controls: VoiceControls;
    lowPassLfo: LowPassLfoSettings;
    sequence: MelodicSequence;
    tempoBpm: number;
    latchEnabled: boolean;
}

export interface SavedPreset {
    name: string;
    setup: InstrumentPreset;
}

type PresetStorage = Pick<Storage, "getItem" | "setItem">;

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inRange(value: unknown, min: number, max: number): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isSequence(value: unknown): value is MelodicSequence {
    if (!isObject(value) || typeof value.enabled !== "boolean" ||
        typeof value.length !== "number" || !isSequenceLength(value.length) ||
        !Array.isArray(value.notes) || value.notes.length !== MAX_SEQUENCE_STEPS ||
        !value.notes.every(note => note === null || (typeof note === "number" && isSequencerNote(note)))) {
        return false;
    }
    if (value.gates !== undefined && (!Array.isArray(value.gates) ||
        value.gates.length !== MAX_SEQUENCE_STEPS || !value.gates.every(segments =>
            segments === null || (Array.isArray(segments) && segments.every(gate =>
                isObject(gate) && inRange(gate.start, 0, 1) &&
                inRange(gate.end, 0, 1) && gate.end > gate.start))))) {
        return false;
    }
    return value.attacks === undefined || (Array.isArray(value.attacks) &&
        value.attacks.length === MAX_SEQUENCE_STEPS && value.attacks.every(attack => typeof attack === "boolean"));
}

function isPreset(value: unknown): value is InstrumentPreset {
    if (!isObject(value) || !isObject(value.controls) || !isObject(value.lowPassLfo)) return false;
    const controls = value.controls;
    const lfo = value.lowPassLfo;
    return (Object.keys(CONTROL_SPECS) as VoiceControlKey[]).every(key =>
        inRange(controls[key], CONTROL_SPECS[key].min, CONTROL_SPECS[key].max)) &&
        Number.isInteger(controls.sampleCount) &&
        inRange(lfo.depth, 0, 1) && inRange(lfo.rate, LOW_PASS_LFO_RATE_MIN, LOW_PASS_LFO_RATE_MAX) &&
        typeof lfo.syncEnabled === "boolean" && LOW_PASS_LFO_TIMINGS.some(timing => timing.value === lfo.timing) &&
        isSequence(value.sequence) && inRange(value.tempoBpm, TEMPO_MIN, TEMPO_MAX) &&
        typeof value.latchEnabled === "boolean";
}

export function samePresetName(first: string, second: string) {
    return first.trim().toLowerCase() === second.trim().toLowerCase();
}

export function readPresets(storage: PresetStorage): SavedPreset[] {
    let raw: string | null;
    try {
        raw = storage.getItem(PRESETS_STORAGE_KEY);
    } catch {
        throw new Error("Saved setups are unavailable. Allow storage for this site and try again.");
    }
    if (raw === null) return [];
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error("Saved setups could not be read. Your stored data has not been changed.");
    }
    if (!isObject(data) || data.version !== 1 || !Array.isArray(data.presets)) {
        throw new Error("This saved setup format is not supported. Your stored data has not been changed.");
    }
    const names = new Set<string>();
    const presets: SavedPreset[] = [];
    for (const entry of data.presets) {
        if (!isObject(entry) || typeof entry.name !== "string" || !entry.name.trim() ||
            entry.name.length > PRESET_NAME_MAX_LENGTH || !isPreset(entry.setup) ||
            names.has(entry.name.trim().toLowerCase())) {
            throw new Error("A saved setup is invalid. Your stored data has not been changed.");
        }
        names.add(entry.name.trim().toLowerCase());
        presets.push({ name: entry.name.trim(), setup: entry.setup });
    }
    return presets.sort((first, second) => first.name.localeCompare(second.name));
}

export function savePreset(storage: PresetStorage, name: string, setup: InstrumentPreset, replace = false) {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > PRESET_NAME_MAX_LENGTH) {
        throw new Error(`Enter a name between 1 and ${PRESET_NAME_MAX_LENGTH} characters.`);
    }
    if (!isPreset(setup)) throw new Error("The current setup could not be saved.");
    // Re-read before writing so saves made in another tab are retained.
    const presets = readPresets(storage);
    const existing = presets.findIndex(preset => samePresetName(preset.name, trimmedName));
    if (existing >= 0 && !replace) {
        throw new Error("That name is already saved. Reopen Save to replace it, or choose another name.");
    }
    // Store only musical settings, never live samples, device IDs, or playback state.
    const snapshot: SavedPreset = {
        name: trimmedName,
        setup: {
            controls: {
                cutoff: setup.controls.cutoff,
                repeatsPerSecond: setup.controls.repeatsPerSecond,
                resonance: setup.controls.resonance,
                sampleCount: setup.controls.sampleCount,
                volume: setup.controls.volume,
            },
            lowPassLfo: {
                depth: setup.lowPassLfo.depth,
                rate: setup.lowPassLfo.rate,
                syncEnabled: setup.lowPassLfo.syncEnabled,
                timing: setup.lowPassLfo.timing,
            },
            sequence: {
                enabled: setup.sequence.enabled,
                length: setup.sequence.length,
                notes: setup.sequence.notes,
                ...(setup.sequence.gates ? { gates: setup.sequence.gates } : {}),
                ...(setup.sequence.attacks ? { attacks: setup.sequence.attacks } : {}),
            },
            tempoBpm: setup.tempoBpm,
            latchEnabled: setup.latchEnabled,
        },
    };
    if (existing < 0) presets.push(snapshot);
    else presets[existing] = snapshot;
    try {
        storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify({ version: 1, presets }));
    } catch {
        throw new Error("Could not save. Browser storage may be full or unavailable; existing saves have not been changed.");
    }
    return trimmedName;
}

export function deletePreset(storage: PresetStorage, name: string) {
    const presets = readPresets(storage);
    const remaining = presets.filter(preset => !samePresetName(preset.name, name));
    if (remaining.length === presets.length) throw new Error("This setup is no longer available. Reopen Save / Load to refresh the list.");
    try {
        storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify({ version: 1, presets: remaining }));
    } catch {
        throw new Error("Could not delete. Browser storage is unavailable; existing saves have not been changed.");
    }
    return remaining;
}
