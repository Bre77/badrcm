import { RuleObject } from 'axe-core';
export interface ReformattedRulesObject {
    index: number;
    rule: string;
    enabled: boolean;
}
export declare function prepareAxeRules(rules: RuleObject): ReformattedRulesObject[];
