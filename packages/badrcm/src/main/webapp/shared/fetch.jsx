'use strict';
import { splunkdPath } from '@splunk/splunk-utils/config';
import { defaultFetchInit, handleError, handleresonse } from '@splunk/splunk-utils/fetch';

import Toaster, { makeCreateToast } from '@splunk/react-toast-notifications/Toaster';
import { TOAST_TYPES } from '@splunk/react-toast-notifications/ToastConstants';

const version = "1"
const lifespan = 24 * 60 * 60 * 1000
const local = window.localStorage

// Helpers
const Toast = makeCreateToast(Toaster)

export const cleanUp = () => {
    Object.entries(local).forEach(([key, value]) => {
        if (key.endsWith("time")) {
            if (parseInt(value, 10) < (Date.now() - lifespan)) {
                let path = key.slice(0, -5)
                console.log(`Removing ${path}`)
                local.removeItem(`${path}|data`)
                local.removeItem(`${path}|hash`)
                local.removeItem(`${path}|time`)
            }
        }
    })
}

const makeParameters = (parameters) => {
    parameters['v'] = version
    return Object.entries(parameters).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
}
const makeBody = (data) => {
    return Object.entries(data).reduce((form, [key, value]) => {
        form.append(key, value)
        return form
    }, new URLSearchParams())
}

export async function restGet(endpoint, parameters = {}, callback, skip = 0) {
    const request = `${endpoint}?${makeParameters(parameters)}`
    console.debug('REST GET', request)
    return Promise.resolve().then(() => {
        // If using cache is enabled (default) and the cached item isnt too old.
        if (skip !== 1 && parseInt(local.getItem(`${request}|time`), 10) > (Date.now() - lifespan)) {
            const data = local.getItem(`${request}|data`)
            if (data) {
                console.debug("USING CACHE FOR", request, JSON.parse(data))
                return Promise.resolve().then(() => {
                    callback(JSON.parse(data))
                }).then(() => true)
            }
        }
        return Promise.resolve(false)
    }).then((cached) => {
        // Skip if requested AND a cached resonse was used
        if (skip === 2 && cached === true) { return Promise.resolve() }

        // Only send the hash if a cached resonse was alredy used.
        const hash = (cached === true) ? local.getItem(`${request}|hash`) || "" : ""
        // Improve this by only adding hash if it was enabled, maybe use URL parameters object
        return fetch(`${splunkdPath}/services/badrcm/${request}&hash=${hash}`, { ...defaultFetchInit, })
            .then((res) => {
                if (res.status === 200) {
                    return res.json().then(data => {
                        console.debug("USING res FOR", request)
                        local.setItem(`${request}|time`, Date.now())
                        local.setItem(`${request}|data`, JSON.stringify(data.data))
                        local.setItem(`${request}|hash`, data.hash)
                        return callback(data.data)
                    })
                }
                if (res.status === 304) {
                    console.debug("CACHE NOT CHANGED", request)
                    local.setItem(`${request}|time`, Date.now())
                    return Promise.resolve()
                }
                return res.json().then(data => {
                    data.status = res.status
                    console.warn(data)
                    Toast({ message: data.context, type: TOAST_TYPES.ERROR })
                    return Promise.reject(data)
                })
            })
    })
};


export async function restChange(endpoint, parameters = {}, body, method = "POST", status = [200, 201, 204]) {
    /*const request = endpoint
    if (parameters) {
        request += "?" + Object.entries(parameters).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
    }*/
    const request = `${endpoint}?${makeParameters(parameters)}`
    console.debug('REST', method, request)
    return fetch(`${splunkdPath}/services/badrcm/${request}`, {
        ...defaultFetchInit,
        'method': method,
        'body': makeBody(body)
    }).then((res) => {
        if (status.includes(res.status)) {
            return (res.status === 204) ? Promise.resolve() : res.json().then(j => j.data)
        }
        return res.json().then(data => {
            data.status = res.status
            console.warn(data)
            Toast({ message: data.context, type: TOAST_TYPES.ERROR })
            return Promise.reject(data)
        })
    })
};
