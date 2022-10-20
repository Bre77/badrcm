"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTemplate = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function loadTemplate() {
    try {
        return fs_1.default.readFileSync(path_1.default.resolve(__dirname, 'template', 'pageTemplate.html'), {
            encoding: 'utf8',
        });
    }
    catch (err) {
        throw new Error(`Error happened while trying to get page template. ${err}`);
    }
}
exports.loadTemplate = loadTemplate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZFRlbXBsYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvbG9hZFRlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLDRDQUFvQjtBQUNwQixnREFBd0I7QUFFeEIsU0FBZ0IsWUFBWTtJQUN4QixJQUFJO1FBQ0EsT0FBTyxZQUFFLENBQUMsWUFBWSxDQUFDLGNBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQyxFQUFFO1lBQzdFLFFBQVEsRUFBRSxNQUFNO1NBQ25CLENBQUMsQ0FBQztLQUNOO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDVixNQUFNLElBQUksS0FBSyxDQUFDLHFEQUFxRCxHQUFHLEVBQUUsQ0FBQyxDQUFDO0tBQy9FO0FBQ0wsQ0FBQztBQVJELG9DQVFDIn0=