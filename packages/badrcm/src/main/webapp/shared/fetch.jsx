/* eslint-disable */

import { splunkdPath } from "@splunk/splunk-utils/config";
import { defaultFetchInit } from "@splunk/splunk-utils/fetch";

import { TOAST_TYPES } from "@splunk/react-toast-notifications/ToastConstants";
import Toaster, { makeCreateToast } from "@splunk/react-toast-notifications/Toaster";


// Helpers
const Toast = makeCreateToast(Toaster);

const makeParameters = (parameters = []) => {
  return Object.entries(parameters)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
};
const makeBody = (data) => {
  return Object.entries(data).reduce((form, [key, value]) => {
    form.append(key, value);
    return form;
  }, new URLSearchParams());
};

const handleRes = (res) => {
  return res.status === 204
    ? Promise.resolve()
    : res.json().then((data) => {
        if (res.ok) return data;

        data.status = res.status;
        console.warn(data);
        Toast({ message: data.error_message, type: TOAST_TYPES.ERROR, autoDismiss: false });
        return Promise.reject(data.error_message);
      });
};

export async function fetchGet(endpoint, parameters = false) {
  if (parameters) endpoint = `${endpoint}?${makeParameters(parameters)}`;
  return fetch(`${splunkdPath}/services/badrcm/${endpoint}`, defaultFetchInit).then(handleRes);
}

export async function restGet(endpoint, parameters = false, callback, life = 60) {
  if (parameters) endpoint = `${endpoint}?${makeParameters(parameters)}`;
  console.debug("REST GET", endpoint);

  return fetch(`${splunkdPath}/services/badrcm/${endpoint}`, { ...defaultFetchInit, cache: life ? "force-cache" : "reload", mode: "same-origin" }) // force-cache or only-if-cached
    .then((res1) => {
      if (res1.status !== 200) return Promise.reject(res1);

      const age = (Date.now() - new Date(res1.headers.get("date", 0)).getTime()) / 1000;

      return res1.json().then((data1) => {
        callback(data1);
        if (!life || age < life) return Promise.resolve(`Used ${age}s old data for ${endpoint}`);

        return fetch(`${splunkdPath}/services/badrcm/${endpoint}`, { ...defaultFetchInit, cache: "reload", mode: "same-origin" }).then((res2) => {
          if (res2.status !== 200) return Promise.reject(res2);

          return res2.json().then((data2) => {
            callback(data2);
            return Promise.resolve(`Used ${age}s old cache then refresh for ${endpoint}`);
          });
        });
      });
    })
    .then(
      (result) => {
        console.debug(result);
      },
      (res) => {
        return res.json().then((data) => {
          data.status = res.status;
          console.warn(data);
          Toast({ message: data.context, type: TOAST_TYPES.ERROR, autoDismiss: false });
          return Promise.reject(data);
        });
      }
    );
}

export async function restPost(endpoint, parameters = {}, body) {
  return fetch(`${splunkdPath}/services/badrcm/${endpoint}?${makeParameters(parameters)}`, {
    ...defaultFetchInit,
    method: "POST",
    body: makeBody(body),
  }).then(handleRes);
}

export async function restDelete(endpoint, parameters = {}) {
  return fetch(`${splunkdPath}/services/badrcm/${endpoint}?${makeParameters(parameters)}`, {
    ...defaultFetchInit,
    method: "DELETE",
  }).then(handleRes);
}

export async function restRaw(endpoint, parameters = {}, body) {
  return fetch(`${splunkdPath}/services/badrcm/${endpoint}?${makeParameters(parameters)}`, {
    ...defaultFetchInit,
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      ...defaultFetchInit.headers,
      "Content-Type": "application/json",
    },
  }).then(handleRes);
}
