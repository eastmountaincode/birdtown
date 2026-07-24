"use client";

import Image from "next/image";
import { useRef } from "react";
import {
  EARTHSCOPE_DATALINK_URL,
  EARTHSCOPE_STATION,
  EARTHSCOPE_STATION_URL,
} from "../lib/earthScopeConfig";

const SENSOR_REFERENCE_URL =
  "https://www.ngu.no/om-geologi/er-det-maleinstrumenter-som-viser-jordskjelv-pa-havbunnen";

export function AboutDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        About
      </button>
      <dialog
        aria-labelledby="about-title"
        className="about-dialog"
        ref={dialogRef}
      >
        <div className="about-dialog__header">
          <h2 id="about-title">About Birdtown</h2>
          <form method="dialog">
            <button type="submit">Close</button>
          </form>
        </div>
        <figure className="about-dialog__sensor">
          <Image
            alt="Nanometrics Trillium 120PA seismometer"
            height={1067}
            src="/trillium-120pa.jpg"
            unoptimized
            width={1440}
          />
          <figcaption>
            <a href={SENSOR_REFERENCE_URL} rel="noreferrer" target="_blank">
              Photo: Rune Eian / NGU
            </a>
          </figcaption>
        </figure>
        <p>
          Live vertical seismic data from{" "}
          <a href={EARTHSCOPE_STATION_URL} rel="noreferrer" target="_blank">
            {EARTHSCOPE_STATION}
          </a>{" "}
          in Birdtown, Kershaw, South Carolina.
        </p>
        <p>Trillium 120PA · 100 Hz · raw digitizer counts</p>
        <p>
          miniSEED over{" "}
          <a href={EARTHSCOPE_DATALINK_URL} rel="noreferrer" target="_blank">
            EarthScope DataLink
          </a>
        </p>
      </dialog>
    </>
  );
}
