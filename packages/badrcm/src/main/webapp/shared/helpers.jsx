import { useReducer } from "react";

// Sorting
export const isort = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }); // Case insensitive sort
export const isort0 = (a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
export const isort1 = (a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" });
export const dedup = (a) => Array.from(new Set(a));

// State
export const tupleSplit = (states) => [states.map((x) => x[0]), states.map((x) => x[1])];
export const wrapSetValue =
  (f) =>
  (_, { value }) =>
    f(value);
export const wrapSetValues =
  (f) =>
  (_, { values }) =>
    f(values);

// Local Storage
export const localSave = (key) => (value) => {
  f(value);
  window.localStorage.setItem(key, JSON.stringify(value));
};

// ? Should this be in Hooks
export const useLocal = (key, fallback) =>
  useReducer((prev, value) => {
    value === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, JSON.stringify(value));
    return value;
  }, localLoad(key, fallback));

export const localLoad = (key, fallback = null) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key));
    return value !== null ? value : fallback;
  } catch {
    return fallback;
  }
};
export const localDel = (key) => window.localStorage.removeItem(key);

export const latest = (results) => results.reduce((x, { dataUpdatedAt }) => Math.max(x, dataUpdatedAt), 0);
