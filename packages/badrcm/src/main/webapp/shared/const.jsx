export const DEFAULT_APP_CONTEXT = { name: "-", label: "All" };
export const SYSTEM_APP_CONTEXT = { name: "system", label: "System" };
export const SYSTEM_USER_CONTEXT = { name: "nobody", realname: "Nobody" };
export const COMMON_FILES = ["props", "transforms", "eventtypes", "inputs", "outputs", "server"]; //'app', 'authentication', 'authorize', 'collections', 'commands', 'datamodels',  'fields', 'global-banner', 'health', 'indexes', 'limits', 'macros', 'passwords', 'savedsearches', 'serverclass', 'tags', 'web']
export const MAX_COLUMNS = 4;
export const COLUMN_INDEX = Array(MAX_COLUMNS)
  .fill()
  .map((_, i) => i);
