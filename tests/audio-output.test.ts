import { afterEach, describe, expect, test, vi } from "vitest";
import {
  audioOutputOptions,
  DEFAULT_AUDIO_OUTPUT,
  readAudioOutputPreference,
  revealAudioOutputs,
  setAudioContextOutput,
  writeAudioOutputPreference,
} from "../app/earthscope/audioOutput";

describe("audio output selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("lists named output devices after the system default", () => {
    expect(
      audioOutputOptions([
        {
          deviceId: "input-1",
          kind: "audioinput",
          label: "Mac microphone",
        },
        {
          deviceId: "default",
          kind: "audiooutput",
          label: "Default - Mac speakers",
        },
        {
          deviceId: "birdtown",
          kind: "audiooutput",
          label: "Birdtown Out",
        },
        {
          deviceId: "cicada",
          kind: "audiooutput",
          label: "Cicada Out",
        },
      ]),
    ).toEqual([
      DEFAULT_AUDIO_OUTPUT,
      { deviceId: "birdtown", label: "Birdtown Out" },
      { deviceId: "cicada", label: "Cicada Out" },
    ]);
  });

  test("keeps unnamed outputs selectable", () => {
    expect(
      audioOutputOptions([
        { deviceId: "one", kind: "audiooutput", label: "" },
        { deviceId: "two", kind: "audiooutput", label: "" },
      ]),
    ).toEqual([
      DEFAULT_AUDIO_OUTPUT,
      { deviceId: "one", label: "Audio output 1" },
      { deviceId: "two", label: "Audio output 2" },
    ]);
  });

  test("stores and restores the selected virtual cable", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const selected = {
      deviceId: "birdtown",
      label: "Birdtown Out",
    };

    writeAudioOutputPreference(storage, selected);
    expect(readAudioOutputPreference(storage)).toEqual(selected);
  });

  test("falls back safely when the stored preference is invalid", () => {
    expect(
      readAudioOutputPreference({
        getItem: () => '{"deviceId": 4}',
      }),
    ).toEqual(DEFAULT_AUDIO_OUTPUT);
  });

  test("routes the complete AudioContext to the selected device", async () => {
    const setSinkId = vi.fn(async () => undefined);
    const context = { setSinkId } as unknown as AudioContext;

    await setAudioContextOutput(context, "birdtown");

    expect(setSinkId).toHaveBeenCalledWith("birdtown");
  });

  test("reports stale output ids without silently choosing another device", async () => {
    const context = {
      setSinkId: vi.fn(async () => {
        throw new DOMException("Missing device", "NotFoundError");
      }),
    } as unknown as AudioContext;

    await expect(
      setAudioContextOutput(context, "disconnected-device"),
    ).rejects.toThrow("That audio output is unavailable. Choose it again.");
  });

  test("does not require sink routing for the system default", async () => {
    await expect(
      setAudioContextOutput({} as AudioContext, ""),
    ).resolves.toBeUndefined();
    await expect(
      setAudioContextOutput({} as AudioContext, "birdtown"),
    ).rejects.toThrow("Audio output selection is unavailable in this browser.");
  });

  test("uses already-exposed named outputs without microphone access", async () => {
    const getUserMedia = vi.fn();
    const enumerateDevices = vi.fn(async () => [
      {
        deviceId: "birdtown",
        kind: "audiooutput",
        label: "Birdtown Out",
      },
    ]);
    vi.stubGlobal("navigator", {
      mediaDevices: { enumerateDevices, getUserMedia },
    });

    await expect(revealAudioOutputs()).resolves.toEqual([
      DEFAULT_AUDIO_OUTPUT,
      { deviceId: "birdtown", label: "Birdtown Out" },
    ]);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  test("releases temporary microphone access after revealing outputs", async () => {
    const stop = vi.fn();
    const enumerateDevices = vi
      .fn()
      .mockResolvedValueOnce([
        { deviceId: "hidden", kind: "audiooutput", label: "" },
      ])
      .mockResolvedValueOnce([
        {
          deviceId: "blackhole",
          kind: "audiooutput",
          label: "BlackHole 2ch",
        },
      ]);
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop }],
    }));
    vi.stubGlobal("navigator", {
      mediaDevices: { enumerateDevices, getUserMedia },
    });

    await expect(revealAudioOutputs()).resolves.toEqual([
      DEFAULT_AUDIO_OUTPUT,
      { deviceId: "blackhole", label: "BlackHole 2ch" },
    ]);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledOnce();
  });
});
