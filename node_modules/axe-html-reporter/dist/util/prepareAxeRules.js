"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareAxeRules = void 0;
function prepareAxeRules(rules) {
    return Object.keys(rules).map((id, index) => {
        return { index: ++index, rule: id, enabled: rules[id].enabled };
    });
}
exports.prepareAxeRules = prepareAxeRules;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcGFyZUF4ZVJ1bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvcHJlcGFyZUF4ZVJ1bGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQU9BLFNBQWdCLGVBQWUsQ0FBQyxLQUFpQjtJQUM3QyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFO1FBQ3hDLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3JFLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUpELDBDQUlDIn0=