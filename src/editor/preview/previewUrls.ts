/** Join a VS Code webview resource base URI with path segments (no leading slashes on segments). */
export function joinGameWebviewUri(base: string, ...segments: string[]): string {
    const trimmed = base.replace(/\/+$/, '');
    const path = segments
        .filter((s) => s.length > 0)
        .map((s) => s.replace(/^\/+/, '').replaceAll('\\', '/'))
        .join('/');
    return path.length > 0 ? `${trimmed}/${path}` : trimmed;
}
