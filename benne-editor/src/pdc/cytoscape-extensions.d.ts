declare module 'cytoscape-elk' {
    import type { use } from 'cytoscape';
    const ext: Parameters<typeof use>[0];
    export default ext;
}

declare module 'cytoscape-compound-drag-and-drop' {
    import type { use } from 'cytoscape';
    const ext: Parameters<typeof use>[0];
    export default ext;
}

declare module 'cytoscape-svg' {
    import type { use } from 'cytoscape';
    const ext: Parameters<typeof use>[0];
    export default ext;
}

/** cytoscape-svg registers `core.svg()` at runtime via cytoscape.use(svg). */
declare namespace cytoscape {
    interface Core {
        svg(options?: ExportOptions): string;
    }
}
