export const EARTHSCOPE_STREAM = "FDSN:CO_BIRD_00_H_H_Z/MSEED";
export const EARTHSCOPE_STATION = "CO.BIRD.00.HHZ";
export const EARTHSCOPE_STATION_URL =
  "https://service.earthscope.org/fdsnws/station/1/query?net=CO&sta=BIRD&level=station&format=text&nodata=404";
export const EARTHSCOPE_DATALINK_URL =
  "https://earthscope.github.io/libdali/datalink-protocol.html";
export const EARTHSCOPE_EXPECTED_SAMPLE_RATE = 100;
export const EARTHSCOPE_WINDOW_SECONDS = 120;
export const EARTHSCOPE_MAX_SAMPLES =
  EARTHSCOPE_EXPECTED_SAMPLE_RATE * EARTHSCOPE_WINDOW_SECONDS;
