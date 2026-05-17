/** HTML escape for attribute values and text nodes in Inspector markup. */
export function escInspectorHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export type InspectorCardSubsectionBodyWrapper = 'section-body' | 'benne-card-subsection-body' | 'none';

export type InspectorCardSubsectionOptions = {
    /**
     * Wrapper around `bodyHtml` inside `<details>`.
     * - `section-body` — GUI control sub-panels (prop grid padding)
     * - `benne-card-subsection-body` — room prop / hotspot nested panels
     * - `none` — emit `bodyHtml` as-is
     */
    bodyWrapper?: InspectorCardSubsectionBodyWrapper;
};

/**
 * Nested `<details>` inside an inspector card (prop, GUI control, etc.).
 * Open state is preserved via `data-sub-pe` / `data-sub-pid` / `data-sub-k`
 * (see `captureInspectorOpenState` in `inspectorMain.ts`).
 */
export function renderInspectorCardSubsection(
    parentEntity: string,
    parentId: string,
    subsectionKey: string,
    summaryTitle: string,
    bodyHtml: string,
    options?: InspectorCardSubsectionOptions
): string {
    const wrapper = options?.bodyWrapper ?? 'section-body';
    const inner =
        wrapper === 'none'
            ? bodyHtml
            : `<div class="${wrapper}">${bodyHtml}</div>`;
    return `<details class="benne-card-subsection" data-sub-pe="${escInspectorHtml(
        parentEntity
    )}" data-sub-pid="${escInspectorHtml(parentId)}" data-sub-k="${escInspectorHtml(subsectionKey)}">
  <summary>${summaryTitle}</summary>
  ${inner}
</details>`;
}

/** GUI control card nested subsection (`data-sub-pe="guiControl"`). */
export function renderGuiControlSubAccordion(
    controlKey: string,
    subKey: string,
    title: string,
    bodyHtml: string
): string {
    return renderInspectorCardSubsection('guiControl', controlKey, subKey, title, bodyHtml, {
        bodyWrapper: 'section-body'
    });
}
