// Sorting
export const isort = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }) // Case insensitive sort 
export const isort0 = (a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
export const isort1 = (a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' })
export const dedup = (a) => Array.from(new Set(a))

// State
export const tupleSplit = (states) => [states.map(x => x[0]), states.map(x => x[1])]
export const wrapSetValue = (f) => (_, { value }) => f(value)
export const wrapSetValues = (f) => (_, { values }) => f(values)

// Local Storage
export const localSave = (f, key) => (value) => {
    f(value)
    window.localStorage.setItem(key, JSON.stringify(value))
}
export const localLoad = (key, fallback = null) => {
    try {
        return JSON.parse(window.localStorage.getItem(key)) || fallback
    } catch {
        return fallback
    }
}
export const localDel = (key) => window.localStorage.removeItem(key)