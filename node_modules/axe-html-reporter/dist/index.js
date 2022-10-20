"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHtmlReport = void 0;
const mustache_1 = __importDefault(require("mustache"));
const loadTemplate_1 = require("./util/loadTemplate");
const prepareReportData_1 = require("./util/prepareReportData");
const prepareAxeRules_1 = require("./util/prepareAxeRules");
const saveHtmlReport_1 = require("./util/saveHtmlReport");
function createHtmlReport({ results, options }) {
    var _a;
    if (!results.violations) {
        throw new Error("'violations' is required for HTML accessibility report. Example: createHtmlReport({ results : { violations: Result[] } })");
    }
    try {
        const template = loadTemplate_1.loadTemplate();
        const preparedReportData = prepareReportData_1.prepareReportData({
            violations: results.violations,
            passes: results.passes,
            incomplete: results.incomplete,
            inapplicable: results.inapplicable,
        });
        const htmlContent = mustache_1.default.render(template, {
            url: results.url,
            violationsSummary: preparedReportData.violationsSummary,
            violations: preparedReportData.violationsSummaryTable,
            violationDetails: preparedReportData.violationsDetails,
            checksPassed: preparedReportData.checksPassed,
            checksIncomplete: preparedReportData.checksIncomplete,
            checksInapplicable: preparedReportData.checksInapplicable,
            hasPassed: Boolean(results.passes),
            hasIncomplete: Boolean(results.incomplete),
            hasInapplicable: Boolean(results.inapplicable),
            incompleteTotal: preparedReportData.checksIncomplete
                ? preparedReportData.checksIncomplete.length
                : 0,
            projectKey: options === null || options === void 0 ? void 0 : options.projectKey,
            customSummary: options === null || options === void 0 ? void 0 : options.customSummary,
            hasAxeRawResults: Boolean(results === null || results === void 0 ? void 0 : results.timestamp),
            rules: prepareAxeRules_1.prepareAxeRules(((_a = results === null || results === void 0 ? void 0 : results.toolOptions) === null || _a === void 0 ? void 0 : _a.rules) || {}),
        });
        if ((options === null || options === void 0 ? void 0 : options.doNotCreateReportFile) === true) {
            console.info('Report file will not be created because user passed options.doNotCreateReportFile = true. Use HTML output of the function to create report file');
        }
        else {
            saveHtmlReport_1.saveHtmlReport({
                htmlContent,
                reportFileName: options === null || options === void 0 ? void 0 : options.reportFileName,
                outputDir: options === null || options === void 0 ? void 0 : options.outputDir,
                outputDirPath: options === null || options === void 0 ? void 0 : options.outputDirPath
            });
        }
        return htmlContent;
    }
    catch (e) {
        console.warn(`HTML report was not created due to the error ${e.message}`);
        return `Failed to create HTML report due to an error ${e.message}`;
    }
}
exports.createHtmlReport = createHtmlReport;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQWdDO0FBRWhDLHNEQUFtRDtBQUNuRCxnRUFBNkQ7QUFDN0QsNERBQXlEO0FBQ3pELDBEQUF1RDtBQXVCdkQsU0FBZ0IsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFnQjs7SUFDL0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUU7UUFDckIsTUFBTSxJQUFJLEtBQUssQ0FDWCwySEFBMkgsQ0FDOUgsQ0FBQztLQUNMO0lBQ0QsSUFBSTtRQUNBLE1BQU0sUUFBUSxHQUFHLDJCQUFZLEVBQUUsQ0FBQztRQUNoQyxNQUFNLGtCQUFrQixHQUFHLHFDQUFpQixDQUFDO1lBQ3pDLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVTtZQUM5QixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07WUFDdEIsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVO1lBQzlCLFlBQVksRUFBRSxPQUFPLENBQUMsWUFBWTtTQUNyQyxDQUFDLENBQUM7UUFDSCxNQUFNLFdBQVcsR0FBRyxrQkFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFDMUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHO1lBQ2hCLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDLGlCQUFpQjtZQUN2RCxVQUFVLEVBQUUsa0JBQWtCLENBQUMsc0JBQXNCO1lBQ3JELGdCQUFnQixFQUFFLGtCQUFrQixDQUFDLGlCQUFpQjtZQUN0RCxZQUFZLEVBQUUsa0JBQWtCLENBQUMsWUFBWTtZQUM3QyxnQkFBZ0IsRUFBRSxrQkFBa0IsQ0FBQyxnQkFBZ0I7WUFDckQsa0JBQWtCLEVBQUUsa0JBQWtCLENBQUMsa0JBQWtCO1lBQ3pELFNBQVMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztZQUNsQyxhQUFhLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7WUFDMUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO1lBQzlDLGVBQWUsRUFBRSxrQkFBa0IsQ0FBQyxnQkFBZ0I7Z0JBQ2hELENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNO2dCQUM1QyxDQUFDLENBQUMsQ0FBQztZQUNQLFVBQVUsRUFBRSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsVUFBVTtZQUMvQixhQUFhLEVBQUUsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLGFBQWE7WUFDckMsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxTQUFTLENBQUM7WUFDN0MsS0FBSyxFQUFFLGlDQUFlLENBQUMsT0FBQSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsV0FBVywwQ0FBRSxLQUFLLEtBQUksRUFBRSxDQUFDO1NBQzVELENBQUMsQ0FBQztRQUNILElBQUksQ0FBQSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUscUJBQXFCLE1BQUssSUFBSSxFQUFFO1lBQ3pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUpBQWlKLENBQUMsQ0FBQztTQUNuSzthQUFNO1lBQ0gsK0JBQWMsQ0FBQztnQkFDWCxXQUFXO2dCQUNYLGNBQWMsRUFBRSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsY0FBYztnQkFDdkMsU0FBUyxFQUFFLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxTQUFTO2dCQUM3QixhQUFhLEVBQUUsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLGFBQWE7YUFDeEMsQ0FBQyxDQUFDO1NBQ047UUFFRCxPQUFPLFdBQVcsQ0FBQztLQUN0QjtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1IsT0FBTyxDQUFDLElBQUksQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFFMUUsT0FBTyxnREFBZ0QsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3RFO0FBQ0wsQ0FBQztBQWxERCw0Q0FrREMifQ==