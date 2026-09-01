/** One-shot handoff for the bill photo picked on the "more" screen's sheet,
 * so `modals/scan-bill` can start straight into "scanning" instead of
 * re-showing its own picker over a blank screen. Module-level, not React
 * state: the value only needs to survive the single push to that route. */
export type PendingScanImage = { base64: string; mimeType: string };

let pending: PendingScanImage | null = null;

export function setPendingScanImage(image: PendingScanImage) {
  pending = image;
}

export function takePendingScanImage(): PendingScanImage | null {
  const image = pending;
  pending = null;
  return image;
}
