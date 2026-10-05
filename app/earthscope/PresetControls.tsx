"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
    PRESET_NAME_MAX_LENGTH, readPresets, samePresetName, savePreset,
    type InstrumentPreset, type SavedPreset,
} from "./presets";

export function PresetControls({ setup, onLoad }: {
    setup: InstrumentPreset;
    onLoad: (setup: InstrumentPreset) => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<"save" | "load">("save");
    const [name, setName] = useState("");
    const [presets, setPresets] = useState<SavedPreset[]>([]);
    const [selectedName, setSelectedName] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [storageReady, setStorageReady] = useState(false);
    const replacing = presets.some(preset => samePresetName(preset.name, name));

    useEffect(() => {
        if (isOpen) dialogRef.current?.showModal();
    }, [isOpen]);

    const open = (nextMode: "save" | "load") => {
        setMode(nextMode);
        setError("");
        setStatus("");
        try {
            const saved = readPresets(window.localStorage);
            setPresets(saved);
            setSelectedName(saved.find(preset => samePresetName(preset.name, name))?.name ?? saved[0]?.name ?? "");
            setStorageReady(true);
        } catch (cause) {
            setPresets([]);
            setStorageReady(false);
            setError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
        }
        setIsOpen(true);
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        try {
            if (mode === "save") {
                const savedName = savePreset(window.localStorage, name, setup, replacing);
                setName(savedName);
                setStatus(`Saved “${savedName}”.`);
            } else {
                // Use the latest stored version if another tab updated this setup.
                const saved = readPresets(window.localStorage).find(preset => preset.name === selectedName);
                if (!saved) throw new Error("This setup is no longer available. Reopen Load to refresh the list.");
                onLoad(saved.setup);
                setName(saved.name);
                setStatus(`Loaded “${saved.name}”.`);
            }
            dialogRef.current?.close();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
        }
    };

    return (
        <div className="preset-controls">
            <button type="button" onClick={() => open("save")}>Save</button>
            <button type="button" onClick={() => open("load")}>Load</button>
            <span role="status">{status}</span>
            <dialog className="preset-dialog" aria-labelledby={titleId} ref={dialogRef} onClose={() => setIsOpen(false)}>
                <h2 id={titleId}>{mode === "save" ? "Save setup" : "Load setup"}</h2>
                <form onSubmit={submit}>
                    {mode === "save" ? (
                        <label>
                            Name
                            <input
                                autoFocus
                                required
                                maxLength={PRESET_NAME_MAX_LENGTH}
                                value={name}
                                onChange={event => setName(event.target.value)}
                            />
                        </label>
                    ) : presets.length > 0 ? (
                        <label>
                            Saved setups
                            <select size={6} value={selectedName} onChange={event => setSelectedName(event.target.value)}>
                                {presets.map(preset => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
                            </select>
                        </label>
                    ) : storageReady ? <p>No saved setups yet.</p> : null}
                    {mode === "save" && replacing ? <p>A setup with this name exists. Replace will overwrite it.</p> : null}
                    <p>Saved in this browser on this device.</p>
                    {error ? <p className="instrument-error" role="alert">{error}</p> : null}
                    <div className="preset-dialog__actions">
                        <button type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
                        <button type="submit" disabled={!storageReady || (mode === "save" ? !name.trim() : !selectedName)}>
                            {mode === "save" ? replacing ? "Replace" : "Save" : "Load"}
                        </button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}
