"use client";

import { useSyncExternalStore } from "react";
import {
  EARTHSCOPE_MAX_SAMPLES,
  EARTHSCOPE_STREAM,
  EARTHSCOPE_WINDOW_SECONDS,
} from "./earthScopeConfig";
import { mergeTimedSamples } from "./dataContinuity";

export interface EarthScopeSignal {
  latency: number | null;
  packets: number;
  sampleRate: number;
  samples: number[];
  status: string;
}

const initialSignal: EarthScopeSignal = {
  latency: null,
  packets: 0,
  sampleRate: 0,
  samples: [],
  status: "connecting",
};

function createDataLinkStore(matchPattern: string) {
  let signal = initialSignal;
  let connection: { close: () => void; endStream: () => unknown } | null = null;
  let connecting = false;
  let disconnectTimer = 0;
  let reconnectTimer = 0;
  let generation = 0;
  let lastEndMillis: number | null = null;
  let lastSampleRate = 0;
  const listeners = new Set<() => void>();

  const publish = (next: EarthScopeSignal) => {
    signal = next;
    for (const listener of listeners) listener();
  };

  const connect = async () => {
    if (connecting || connection || typeof window === "undefined") return;
    connecting = true;
    publish({
      ...signal,
      status: signal.samples.length > 0 ? "reconnecting" : "connecting",
    });
    const currentGeneration = ++generation;
    try {
      const [{ datalink, miniseed }, { DateTime }] = await Promise.all([
        import("seisplotjs"),
        import("luxon"),
      ]);
      if (currentGeneration !== generation) return;

      const onPacket = (packet: {
        asMiniseed: () => unknown;
        isMiniseed: () => boolean;
      }) => {
        if (currentGeneration !== generation || !packet.isMiniseed()) return;
        const segment = miniseed.createSeismogramSegment(
          packet.asMiniseed() as Parameters<
            typeof miniseed.createSeismogramSegment
          >[0],
        );
        const latency = Math.max(0, Date.now() - segment.end.toMillis()) / 1000;
        const merged = mergeTimedSamples({
          endMillis: segment.end.toMillis(),
          existing: signal.samples,
          incoming: Array.from(segment.y),
          lastEndMillis,
          lastSampleRate,
          maxSamples: EARTHSCOPE_MAX_SAMPLES,
          sampleRate: segment.sampleRate,
          startMillis: segment.start.toMillis(),
        });
        if (!merged.accepted) return;
        lastEndMillis = merged.lastEndMillis;
        lastSampleRate = segment.sampleRate;
        publish({
          latency,
          packets: signal.packets + 1,
          sampleRate: segment.sampleRate,
          samples: merged.samples,
          status: latency <= 10 ? "live" : "catching up",
        });
      };

      const retry = (message: string) => {
        if (currentGeneration !== generation) return;
        connecting = false;
        publish({ ...signal, status: message || "reconnecting" });
        try {
          connection?.close();
        } catch (error) {
          void error;
        }
        connection = null;
        generation += 1;
        window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => {
          if (listeners.size > 0) void connect();
        }, 1500);
      };

      const liveConnection = new datalink.DataLinkConnection(
        "wss://rtserve.earthscope.org/datalink",
        onPacket,
        (error: Error) => retry(error.message),
      );
      liveConnection.setOnClose(() => retry("reconnecting"));
      connection = liveConnection;
      await liveConnection.connect();
      await liveConnection.match(matchPattern);
      await liveConnection.positionAfter(
        DateTime.utc().minus({ seconds: EARTHSCOPE_WINDOW_SECONDS }),
      );
      await liveConnection.stream();
    } catch (error) {
      if (currentGeneration === generation) {
        publish({
          ...signal,
          status: error instanceof Error ? error.message : "connection error",
        });
        try {
          connection?.close();
        } catch (closeError) {
          void closeError;
        }
        connection = null;
        window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => {
          if (listeners.size > 0) void connect();
        }, 1500);
      }
    } finally {
      connecting = false;
    }
  };

  const disconnect = () => {
    generation += 1;
    connecting = false;
    window.clearTimeout(reconnectTimer);
    try {
      connection?.endStream();
      connection?.close();
    } catch (error) {
      void error;
    }
    connection = null;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    window.clearTimeout(disconnectTimer);
    void connect();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        disconnectTimer = window.setTimeout(disconnect, 15_000);
      }
    };
  };

  return function useDataLink() {
    return useSyncExternalStore(subscribe, () => signal, () => initialSignal);
  };
}

export const useEarthScope = createDataLinkStore(EARTHSCOPE_STREAM);
