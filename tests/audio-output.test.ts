import { describe, expect, test } from "vitest";
import {
  audioOutputOptions,
  DEFAULT_AUDIO_OUTPUT,
  readAudioOutputPreference,
  writeAudioOutputPreference,
} from "../app/earthscope/audioOutput";

describe("audio output selection", () => {
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
});
