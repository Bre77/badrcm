import { AxeReport } from './AxeReport';
import { PreparedResults } from '../index';
/**
 * Prepare report splitting it into sections:
 * - total accessibility violations (counting nodes)
 * - summary of violations that could be printed as table
 * - detailed list of violations that could be printed as formatted text
 */
export declare function prepareReportData({ violations, passes, incomplete, inapplicable, }: PreparedResults): AxeReport;
