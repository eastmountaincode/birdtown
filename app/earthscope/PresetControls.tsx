"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
    PRESET_NAME_MAX_LENGTH, deletePreset, readPresets, samePresetName, savePreset,
    type InstrumentPreset, type SavedPreset,
} from "./presets";

export function PresetControls({ setup, onLoad }: {
    setup: InstrumentPreset;
    onLoad: (setup: InstrumentPreset) => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [presets, setPresets] = useState<SavedPreset[]>([]);
    const [selectedName, setSelectedName] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState<{ message: string } | null>(null);
    const [storageReady, setStorageReady] = useState(false);
    const replacing = presets.some(preset => samePresetName(preset.name, name));

    useEffect(() => {
        if (isOpen) dialogRef.current?.showModal();
    }, [isOpen]);

    useEffect(() => {
        if (!status) return;
        const timer = window.setTimeout(() => setStatus(null), 3000);
        return () => window.clearTimeout(timer);
    }, [status]);

    const open = () => {
        setError("");
        setStatus(null);
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

    const save = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setStatus(null);
        try {
            const savedName = savePreset(window.localStorage, name, setup, replacing);
            setName(savedName);
            setPresets(readPresets(window.localStorage));
            setSelectedName(savedName);
            setStatus({ message: `Saved “${savedName}”.` });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
        }
    };

    const load = () => {
        setError("");
        setStatus(null);
        try {
            const saved = readPresets(window.localStorage).find(preset => preset.name === selectedName);
            if (!saved) throw new Error("This setup is no longer available. Reopen Save / Load to refresh the list.");
            onLoad(saved.setup);
            setName(saved.name);
            setStatus({ message: `Loaded “${saved.name}”.` });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load this setup.");
        }
    };

    const remove = () => {
        setError("");
        setStatus(null);
        try {
            const remaining = deletePreset(window.localStorage, selectedName);
            setPresets(remaining);
            setSelectedName(remaining[0]?.name ?? "");
            if (samePresetName(name, selectedName)) setName("");
            setStatus({ message: `Deleted “${selectedName}”.` });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not delete this setup.");
        }
    };

    return (
        <div className="preset-controls">
            <button type="button" aria-haspopup="dialog" aria-expanded={isOpen} onClick={open}>Save / Load</button>
            <dialog className="preset-dialog" aria-labelledby={titleId} ref={dialogRef} onClose={() => setIsOpen(false)}>
                <h2 id={titleId}>Save / Load</h2>
                <form onSubmit={save}>
                    <label>
                        Name
                        <input
                            autoFocus required maxLength={PRESET_NAME_MAX_LENGTH} value={name}
                            onChange={event => setName(event.target.value)}
                        />
                    </label>
                    {replacing ? <p>A setup with this name exists. Replace will overwrite it.</p> : null}
                    <div className="preset-dialog__actions">
                        <button type="submit" disabled={!storageReady || !name.trim()}>{replacing ? "Replace" : "Save"}</button>
                    </div>
                </form>
                {presets.length > 0 ? (
                    <label>
                        Saved setups
                        <select size={6} value={selectedName} onChange={event => {
                            setSelectedName(event.target.value);
                            setName(event.target.value);
                        }}>
                            {presets.map(preset => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
                        </select>
                    </label>
                ) : storageReady ? <p>No saved setups yet.</p> : null}
                <div className="preset-dialog__actions">
                    <button type="button" disabled={!storageReady || !selectedName} onClick={load}>Load</button>
                    <button type="button" disabled={!storageReady || !selectedName} onClick={remove}>Delete</button>
                </div>
                <p>Saved in this browser on this device.</p>
                <p role="status">{status?.message}</p>
                {error ? <p className="instrument-error" role="alert">{error}</p> : null}
                <div className="preset-dialog__actions">
                    <button type="button" onClick={() => dialogRef.current?.close()}>Close</button>
                </div>
            </dialog>
        </div>
    );
}
