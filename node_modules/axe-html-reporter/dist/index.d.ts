import { AxeResults, Result } from 'axe-core';
export interface Options {
    reportFileName?: string;
    outputDir?: string;
    projectKey?: string;
    customSummary?: string;
    outputDirPath?: string;
    doNotCreateReportFile?: boolean;
}
export interface CreateReport {
    results: Partial<AxeResults>;
    options?: Options;
}
export interface PreparedResults {
    violations: Result[];
    passes?: Result[];
    incomplete?: Result[];
    inapplicable?: Result[];
}
export declare function createHtmlReport({ results, options }: CreateReport): string;
