/**
 * Axe returns variety of tags that are not necessary for our purposes.
 * We are interested only in WCAG related tags and Best Practices.
 * Function tries to determine if tag belongs to Best Practice or any WCAG 2.x, otherwise all tags will be returned raw
 * @param tags
 * @returns {string}
 */
export declare function getWcagReference(tags: string[]): string;
