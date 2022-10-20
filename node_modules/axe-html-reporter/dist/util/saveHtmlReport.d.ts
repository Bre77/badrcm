export declare const defaultReportFileName = "accessibilityReport.html";
interface SaveReportOptions {
    htmlContent: string;
    reportFileName?: string;
    outputDir?: string;
    outputDirPath?: string;
}
/**
 * Saves the file with specified file name or with default file name index.thml
 * @param htmlContent
 * @param fileName
 */
export declare function saveHtmlReport({ htmlContent, reportFileName, outputDir, outputDirPath }: SaveReportOptions): void;
export {};
