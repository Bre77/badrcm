"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWcagReference = void 0;
/**
 * Axe returns variety of tags that are not necessary for our purposes.
 * We are interested only in WCAG related tags and Best Practices.
 * Function tries to determine if tag belongs to Best Practice or any WCAG 2.x, otherwise all tags will be returned raw
 * @param tags
 * @returns {string}
 */
function getWcagReference(tags) {
    // case 1: tags includes best-practice
    if (tags.includes('best-practice')) {
        return 'Best practice';
    }
    // case 2: tags does not include best-practice and include one or more wcag tags
    const foundWcagTags = tags.filter((tag) => tag.includes('wcag'));
    if (foundWcagTags.length > 0) {
        return foundWcagTags
            .map((tag) => {
            const sectionNumberMatch = tag.match(/\d+/);
            const levelMatch = tag.match(/wcag\d+(a+)/);
            const sectionNumber = sectionNumberMatch && sectionNumberMatch.length >= 1
                ? sectionNumberMatch[0].split('').join('.')
                : ''; // wcag section number, e.g 2 in 'wcag2aa' or 411 in 'wcag411' tag
            const level = levelMatch && levelMatch.length > 1
                ? ` Level ${levelMatch[1].toUpperCase()}`
                : ''; // wcag level, e.g aa in 'wcag2aa' or a in 'wcag21a' tag
            return `WCAG ${sectionNumber}${level}`;
        })
            .join(', ');
    }
    // case 3: tags does not include best-practice or wcag, return raw tags comma separated
    return tags.join(',');
}
exports.getWcagReference = getWcagReference;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0V2NhZ1JlZmVyZW5jZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL2dldFdjYWdSZWZlcmVuY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsSUFBYztJQUMzQyxzQ0FBc0M7SUFDdEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBQ2hDLE9BQU8sZUFBZSxDQUFDO0tBQzFCO0lBQ0QsZ0ZBQWdGO0lBQ2hGLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNqRSxJQUFJLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzFCLE9BQU8sYUFBYTthQUNmLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ1QsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzVDLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDNUMsTUFBTSxhQUFhLEdBQ2Ysa0JBQWtCLElBQUksa0JBQWtCLENBQUMsTUFBTSxJQUFJLENBQUM7Z0JBQ2hELENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztnQkFDM0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGtFQUFrRTtZQUNoRixNQUFNLEtBQUssR0FDUCxVQUFVLElBQUksVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDO2dCQUMvQixDQUFDLENBQUMsVUFBVSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUU7Z0JBQ3pDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyx3REFBd0Q7WUFDdEUsT0FBTyxRQUFRLGFBQWEsR0FBRyxLQUFLLEVBQUUsQ0FBQztRQUMzQyxDQUFDLENBQUM7YUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDbkI7SUFDRCx1RkFBdUY7SUFFdkYsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzFCLENBQUM7QUEzQkQsNENBMkJDIn0=