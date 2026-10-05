import { describe, expect, test } from "vitest";
import { DEFAULT_CONTROLS } from "../app/earthscope/controls";
import { DEFAULT_LOW_PASS_LFO } from "../app/earthscope/lowPassLfo";
import { DEFAULT_SEQUENCE, setSequenceNote } from "../app/earthscope/sequencer";
import { PRESETS_STORAGE_KEY, deletePreset, readPresets, savePreset, type InstrumentPreset } from "../app/earthscope/presets";

function memoryStorage() {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); },
    };
}

const setup: InstrumentPreset = {
    controls: { ...DEFAULT_CONTROLS, cutoff: 880, sampleCount: 200 },
    lowPassLfo: { ...DEFAULT_LOW_PASS_LFO, depth: 0.5, syncEnabled: true, timing: "quarter-triplet" },
    sequence: {
        ...setSequenceNote(setSequenceNote(DEFAULT_SEQUENCE, 0, -12), 31, 96),
        gates: Array.from({ length: 32 }, (_, step) => step === 0 ? [{ start: 0.2, end: 0.7 }] : null),
        attacks: Array.from({ length: 32 }, (_, step) => step === 0),
    },
    tempoBpm: 135,
    latchEnabled: true,
};

describe("saved Birdtown setups", () => {
    test("round-trips settings, extended pitches, hidden steps, and recorded timing", () => {
        const storage = memoryStorage();
        expect(readPresets(storage)).toEqual([]);
        expect(savePreset(storage, "  Night birds  ", setup)).toBe("Night birds");
        const saved = readPresets(storage);
        expect(saved).toEqual([{ name: "Night birds", setup }]);
        expect(saved[0].setup.sequence).not.toBe(setup.sequence);
        expect(JSON.parse(storage.getItem(PRESETS_STORAGE_KEY)!)).toHaveProperty("version", 1);
    });

    test("supports empty patterns and preserves sequencer Off", () => {
        const storage = memoryStorage();
        const empty = { ...setup, sequence: { ...DEFAULT_SEQUENCE, enabled: false } };
        savePreset(storage, "Empty", empty);
        expect(readPresets(storage)[0].setup).toEqual(empty);
    });

    test("requires intentional replacement and retains other saves", () => {
        const storage = memoryStorage();
        savePreset(storage, "Zulu", setup);
        savePreset(storage, "Alpha", setup);
        expect(() => savePreset(storage, " zULu ", setup)).toThrow("already saved");
        savePreset(storage, "Zulu", { ...setup, tempoBpm: 90 }, true);
        expect(readPresets(storage).map(preset => preset.name)).toEqual(["Alpha", "Zulu"]);
        expect(readPresets(storage)[1].setup.tempoBpm).toBe(90);
        expect(readPresets(storage)[0].setup.tempoBpm).toBe(135);
    });

    test("does not overwrite corrupt data or unsupported versions", () => {
        const storage = memoryStorage();
        for (const raw of ["invalid JSON", JSON.stringify({ version: 2, presets: [] }),
            JSON.stringify({ version: 1, presets: [{ name: "Broken", setup: {} }] })]) {
            storage.setItem(PRESETS_STORAGE_KEY, raw);
            expect(() => readPresets(storage)).toThrow();
            expect(() => savePreset(storage, "New", setup)).toThrow();
            expect(storage.getItem(PRESETS_STORAGE_KEY)).toBe(raw);
        }
    });

    test("rejects malformed timing, pitches, controls, names, and duplicate entries", () => {
        const storage = memoryStorage();
        const invalidSetups = [
            { ...setup, controls: { ...setup.controls, volume: 2 } },
            { ...setup, lowPassLfo: { ...setup.lowPassLfo, timing: "unknown" } },
            { ...setup, sequence: { ...setup.sequence, notes: [36] } },
            { ...setup, sequence: { ...setup.sequence, notes: Array(32).fill(1e9) } },
            { ...setup, sequence: { ...setup.sequence, gates: Array(32).fill([{ start: 0.8, end: 0.1 }]) } },
            { ...setup, sequence: { ...setup.sequence, attacks: Array(32).fill("yes") } },
        ];
        for (const invalid of invalidSetups) {
            storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify({ version: 1, presets: [{ name: "Bad", setup: invalid }] }));
            expect(() => readPresets(storage)).toThrow("invalid");
        }
        for (const name of ["   ", "a".repeat(81)]) {
            expect(() => savePreset(memoryStorage(), name, setup)).toThrow("Enter a name");
        }
        storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify({ version: 1, presets: [
            { name: "Same", setup }, { name: "same", setup },
        ] }));
        expect(() => readPresets(storage)).toThrow("invalid");
    });

    test("reports unavailable or full storage without losing existing saves", () => {
        expect(() => readPresets({ getItem: () => { throw Error("denied"); }, setItem: () => {} })).toThrow("unavailable");
        const storage = memoryStorage();
        savePreset(storage, "Original", setup);
        const before = storage.getItem(PRESETS_STORAGE_KEY);
        expect(() => savePreset({ ...storage, setItem: () => { throw Error("quota"); } }, "New", setup)).toThrow("Could not save");
        expect(storage.getItem(PRESETS_STORAGE_KEY)).toBe(before);
    });
});


test("deletion persists, preserves other saves, and supports deleting the final entry", () => {
    const storage = memoryStorage();
    savePreset(storage, "First", setup);
    savePreset(storage, "Second", setup);
    expect(deletePreset(storage, "first").map(preset => preset.name)).toEqual(["Second"]);
    expect(readPresets(storage).map(preset => preset.name)).toEqual(["Second"]);
    deletePreset(storage, "Second");
    expect(readPresets(storage)).toEqual([]);
    expect(() => deletePreset(storage, "Missing")).toThrow("no longer available");
});

test("deletion does not destroy saves when storage writes fail", () => {
    const storage = memoryStorage();
    savePreset(storage, "Original", setup);
    const before = storage.getItem(PRESETS_STORAGE_KEY);
    expect(() => deletePreset({ ...storage, setItem: () => { throw Error("denied"); } }, "Original")).toThrow("Could not delete");
    expect(storage.getItem(PRESETS_STORAGE_KEY)).toBe(before);
});
