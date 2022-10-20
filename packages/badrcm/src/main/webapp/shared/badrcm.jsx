'use strict';
import React, { useEffect, useState } from 'react';
import { splunkdPath } from '@splunk/splunk-utils/config';
import { defaultFetchInit, handleError, handleResponse } from '@splunk/splunk-utils/fetch';
import Button from '@splunk/react-ui/Button';

const AsyncButton = (props) => {
    const [running, setRunning] = useState(false);

    const action = (e, x) => {
        setRunning(true)
        return props.onClick(e, x).then(setRunning(false))
    }

    useEffect(() => {
        console.log(running, props.disabled, running || !!props.disabled)
    }, [running])

    return <Button label={running.toString()} onClick={action} disabled={running} />
}



//const postFetchInit = Object.assign({}, defaultFetchInit, { 'method': 'POST' });
const version = "1"
const lifespan = 24 * 60 * 60 * 1000

const local = window.localStorage

const cleanUp = () => {
    for (const [key, value] of Object.entries(local)) {
        if (key.endsWith("time")) {
            //console.log(key, parseInt(value), (Date.now() - lifespan), (parseInt(value) > (Date.now() - lifespan)))
            if (parseInt(value) < (Date.now() - lifespan)) {
                let path = key.slice(0, -5)
                console.log(`Removing ${path}`)
                local.removeItem(`${path}|data`)
                local.removeItem(`${path}|hash`)
                local.removeItem(`${path}|time`)
            }
        }
    }
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

async function get(endpoint, parameters = {}, callback, skip = 0) {
    const request = `${endpoint}?${makeParameters(parameters)}`
    console.log('GET', request)
    return Promise.resolve().then(() => {
        // If using cache is enabled (default) and the cached item isnt too old.
        const cached = skip != 1 && parseInt(local.getItem(`${request}|time`)) > (Date.now() - lifespan)
        if (cached) {
            const data = local.getItem(`${request}|data`)
            if (data) {
                console.debug("USING CACHE FOR", request, JSON.parse(data))
                return callback(JSON.parse(data))
            } else cached == false
        }
        return Promise.resolve(false)
    }).then((cached) => {
        if (skip == 2 && cached !== false) return Promise.resolve()
        // Only send the hash if a cached response was alredy used.

        const hash = (cached !== false) ? local.getItem(`${request}|hash`) || "" : ""
        // Improve this by only adding hash if it was enabled, maybe use URL parameters object
        return fetch(`${splunkdPath}/services/badrcm/${request}&hash=${hash}`, { ...defaultFetchInit, })
            .then((res) => {
                if (res.status === 200) {
                    return res.json().then(data => {
                        console.log("USING RESP FOR", request, data.data)
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
                return Promise.reject(res.status)
            })
    })
};


async function change(endpoint, parameters = {}, data, method = "POST", usecache = false, status = [200, 201, 204]) {
    /*const request = endpoint
    if (parameters) {
        request += "?" + Object.entries(parameters).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
    }*/
    const request = `${endpoint}?${makeParameters(parameters)}`

    return fetch(`${splunkdPath}/services/badrcm/${request}`, {
        ...defaultFetchInit,
        'method': method,
        'body': makeBody(data)
    }).then((resp) => {
        if (status.includes(resp.status)) {
            return (resp.status == 204) ? Promise.resolve() : resp.json()
        }
        return resp.json().then(data => {
            data.status = resp.status
            console.warn(data)
            return Promise.reject(data)
        })
    })
};

export { get, change, cleanUp }