"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveHtmlReport = exports.defaultReportFileName = void 0;
const fs_1 = __importDefault(require("fs"));
exports.defaultReportFileName = 'accessibilityReport.html';
/**
 * Saves the file with specified file name or with default file name index.thml
 * @param htmlContent
 * @param fileName
 */
function saveHtmlReport({ htmlContent, reportFileName, outputDir, outputDirPath = process.cwd() }) {
    try {
        const reportDirectory = `${outputDirPath}/${outputDir || 'artifacts'}`;
        if (!fs_1.default.existsSync(reportDirectory)) {
            fs_1.default.mkdirSync(reportDirectory, {
                recursive: true,
            });
        }
        const reportFilePath = `${reportDirectory}/${reportFileName || exports.defaultReportFileName}`;
        fs_1.default.writeFileSync(reportFilePath, htmlContent);
        console.info(`HTML report was saved into the following directory ${reportFilePath}`);
    }
    catch (err) {
        console.error(`Error happened while trying to save html report. ${err}`);
    }
}
exports.saveHtmlReport = saveHtmlReport;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZUh0bWxSZXBvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbC9zYXZlSHRtbFJlcG9ydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSw0Q0FBb0I7QUFFUCxRQUFBLHFCQUFxQixHQUFHLDBCQUEwQixDQUFDO0FBUWhFOzs7O0dBSUc7QUFDSCxTQUFnQixjQUFjLENBQUMsRUFDM0IsV0FBVyxFQUNYLGNBQWMsRUFDZCxTQUFTLEVBQ1QsYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFDYjtJQUNoQixJQUFJO1FBQ0EsTUFBTSxlQUFlLEdBQUcsR0FBRyxhQUFhLElBQUksU0FBUyxJQUFJLFdBQVcsRUFBRSxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxZQUFFLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxFQUFFO1lBQ2pDLFlBQUUsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFO2dCQUMxQixTQUFTLEVBQUUsSUFBSTthQUNsQixDQUFDLENBQUM7U0FDTjtRQUNELE1BQU0sY0FBYyxHQUFHLEdBQUcsZUFBZSxJQUFJLGNBQWMsSUFBSSw2QkFBcUIsRUFBRSxDQUFDO1FBQ3ZGLFlBQUUsQ0FBQyxhQUFhLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQzlDLE9BQU8sQ0FBQyxJQUFJLENBQUMsc0RBQXNELGNBQWMsRUFBRSxDQUFDLENBQUM7S0FDeEY7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNWLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0RBQW9ELEdBQUcsRUFBRSxDQUFDLENBQUM7S0FDNUU7QUFDTCxDQUFDO0FBbkJELHdDQW1CQyJ9