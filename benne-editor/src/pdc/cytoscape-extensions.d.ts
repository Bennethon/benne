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
