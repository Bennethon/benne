/**
 * Read width/height from a PNG buffer (IHDR chunk) without extra dependencies.
 * Returns undefined if the buffer is not a valid PNG.
 */
export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
    if (bytes.length < 24) {
        return undefined;
    }
    // PNG signature
    if (
        bytes[0] !== 0x89 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x4e ||
        bytes[3] !== 0x47 ||
        bytes[4] !== 0x0d ||
        bytes[5] !== 0x0a ||
        bytes[6] !== 0x1a ||
        bytes[7] !== 0x0a
    ) {
        return undefined;
    }
    // First chunk must be IHDR at offset 12
    if (
        bytes[12] !== 0x49 ||
        bytes[13] !== 0x48 ||
        bytes[14] !== 0x44 ||
        bytes[15] !== 0x52
    ) {
        return undefined;
    }
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = dv.getUint32(16, false);
    const height = dv.getUint32(20, false);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return undefined;
    }
    return { width, height };
}
