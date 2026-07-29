/**
 * GG Sheet Export — logo (laúd con las dos G espejadas).
 * Se usa APLANADO a un solo color para que se lea como laúd completo (con las
 * cuerdas) y no como una cruz. logoDataUri(color) arma la variante en el color
 * que pida cada uso: watermark oscuro sobre pergamino, o dorado sobre dorso oscuro.
 */
const LOGO_VB = "0 0 627.38 548.44";
const LOGO_PATHS = [
  "M307.74,0h4.15v299.21h0c-2.29,0-4.15-1.86-4.15-4.15V0h0Z",
  "M323.82,2.19h0c2.29,0,4.15,3.56,4.15,7.96v269.29c0,2.2-4.15,13.03-4.15,13.03V2.19Z",
  "M315.78,0h4.15v295.06c0,2.29-1.86,4.15-4.15,4.15h0V0h0Z",
  "M303.84,2.7h0c-2.29,0-4.15,3.56-4.15,7.96v269.29c0,2.2,4.15,13.03,4.15,13.03V2.7Z",
  "M605.15,279.37c.15,3.47.23,50.09.23,53.62,0,110.25-116.09,205.47-263.56,214.88v.57c68.81-4.29,132.76-26.02,182.2-62.29,55.69-40.86,103.36-95.25,103.36-153.16,0-.03,0-.07,0-.1,0-6.43-1.61-12.76-4.52-18.5l-17.71-35.01Z",
  "M22.23,279.38c-.15,3.47-.23,50.09-.23,53.62,0,110.25,116.09,205.47,263.56,214.87v.57c-68.81-4.29-132.76-26.02-182.2-62.29C47.67,445.3,0,390.9,0,332.99c0-.03,0-.07,0-.1,0-6.43,1.61-12.76,4.52-18.5l17.71-35.01Z",
  "M335.21,108.28v177.6h110.06s8,0,8,0l-.19,42.65s-3.34-11.63-13.81-11.63-93.17,0-93.17,0v157.21s196-6,196-161c0-155-206.9-240.32-206.9-240.32v35.5Z",
  "M292.46,108.28v177.6h-110.06s-8,0-8,0l.19,42.65s3.34-11.63,13.81-11.63,93.17,0,93.17,0v157.21s-196-6-196-161,206.9-240.32,206.9-240.32v35.5Z"
];
const b64 = (s) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s).toString("base64"));

/** Data-URI del logo aplanado en un color sólido. */
export function logoDataUri(color = "#1d1d1b") {
  const body = LOGO_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VB}">${body}</svg>`;
  return `data:image/svg+xml;base64,${b64(svg)}`;
}

/** Marca de agua por defecto: laúd plano oscuro (sobre pergamino claro). */
export const LOGO_WATERMARK = logoDataUri("#1d1d1b");
