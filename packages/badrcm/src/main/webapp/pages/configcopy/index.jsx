/* eslint-disable react/no-array-index-key */
/* eslint-disable no-nested-ternary */
import React, { useState, useEffect, useReducer } from 'react';
import layout from '@splunk/react-page';
import { getUserTheme, getThemeOptions } from '@splunk/splunk-utils/themes';
import { Map, OrderedMap, Set } from 'immutable'
import { StyledContainer } from './Styles';
import { restGet, restChange, cleanUp } from '../../shared/fetch'
import { GlobalStyle } from '../../shared/styles'
import { splunkdPath, username } from '@splunk/splunk-utils/config';
import { SplunkThemeProvider } from '@splunk/themes';

import ComboBox from '@splunk/react-ui/ComboBox';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import ColumnLayout from '@splunk/react-ui/ColumnLayout';
import Number from '@splunk/react-ui/Number';
import Multiselect from '@splunk/react-ui/Multiselect';
import Select from '@splunk/react-ui/Select';
import CollapsiblePanel from '@splunk/react-ui/CollapsiblePanel';
import Switch from '@splunk/react-ui/Switch';
import Text from '@splunk/react-ui/Text';
import Table from '@splunk/react-ui/Table';
import Accordion from '@splunk/react-ui/Accordion';

const Configs = () => {
    // Constants
    const MAX_COLUMNS = 4
    const COLUMN_INDEX = Array(MAX_COLUMNS).fill().map((_, i) => i)
    const DEFAULT_APP_CONTEXT = { name: '-', label: "All" }
    const SYSTEM_APP_CONTEXT = { name: 'system', label: "System" }
    const DEFAULT_USER_CONTEXT = { name: 'nobody', realname: "Nobody" }
    const COMMON_FILES = ['props', 'transforms', 'eventtypes', 'inputs', 'outputs', 'server'] //'app', 'authentication', 'authorize', 'collections', 'commands', 'datamodels',  'fields', 'global-banner', 'health', 'indexes', 'limits', 'macros', 'passwords', 'savedsearches', 'serverclass', 'tags', 'web']

    // Helpers
    const isort = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }) // Case insensitive sort 
    const isort0 = (a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
    const isort1 = (a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' })
    const dedup = (a) => Array.from(new Set(a))

    // State - Helpers
    const tupleSplit = (states) => [states.map(x => x[0]), states.map(x => x[1])]
    const wrapSetValue = (f) => (_, { value }) => f(value)
    const wrapSetValues = (f) => (_, { values }) => f(values)

    // State - Page Selectors
    const [filefilter, setFileFilter] = useState(['props', 'transforms']); //
    const handleFileFilter = wrapSetValues(setFileFilter)
    const [appfilter, setAppFilter] = useState([]);
    const handleAppFilter = wrapSetValues(setAppFilter)
    const [columncount, setColumnCount] = useState(2);
    const handleColumnCount = wrapSetValue(setColumnCount)

    const [fileoptions, setFileOptions] = useState(Set());
    const [appoptions, setAppOptions] = useState(Map());
    const [applabels, setAppLabels] = useState({});

    // State - Column Selector
    const [server, setServer] = tupleSplit(COLUMN_INDEX.map(() => useState()))
    const handleServer = setServer.map((x) => wrapSetValue(x))
    const [appcontext, setAppContext] = tupleSplit(COLUMN_INDEX.map(() => useState(DEFAULT_APP_CONTEXT.name)))
    const handleAppContext = setAppContext.map(wrapSetValue)
    const [usercontext, setUserContext] = tupleSplit(COLUMN_INDEX.map(() => useState(DEFAULT_USER_CONTEXT.name)))
    const handleUserContext = setUserContext.map(wrapSetValue)

    const [loading, setLoading] = tupleSplit(COLUMN_INDEX.map(() => useState(false)))
    const handleLoading = setLoading.map(wrapSetValue)

    const [serveroptions, setServerOptions] = useState([]);
    const [servercontext, setServerContext] = tupleSplit(COLUMN_INDEX.map(() => useState()))
    const [serverconfig, setServerConfig] = tupleSplit(COLUMN_INDEX.map(() => useReducer((prev, add) => ({ ...prev, ...add }))))
    //const [appcontextoptions, setAppContextOptions] = tupleSplit(COLUMN_INDEX.map(useState([])))
    //const [usercontextoptions, setUserContextOptions] = tupleSplit(COLUMN_INDEX.map(useState([])))

    const [mergedconfig, setMergedConfig] = useState([]);

    // Startup
    useEffect(() => {
        restGet('servers', {}, setServerOptions).then(() => { cleanUp() })
    }, []);

    // Server Selector
    server.map((s, i) => {
        useEffect(() => {
            if (!s) return // Requirements not met
            console.log(`EFFECT Context of ${s} for ${i}`)
            restGet('servers', { 'server': s }, ([apps, users, files, username, realname, roles]) => {
                for (const [app, [label, visable, version]] of Object.entries(apps)) {
                    apps[app] = { 'label': label, 'visable': Boolean(visable), 'version': version }
                }
                for (const [user, [realname, defaultapp]] of Object.entries(users)) {
                    users[user] = realname
                }
                setServerContext[i]({ apps, users, files })
            })
        }, [s])
    })

    // Get Config Data
    COLUMN_INDEX.map((i) => {
        useEffect(() => {
            if (!server[i] || !appcontext[i] || !usercontext[i]) return // Requirements not met
            console.log(`EFFECT Configs for ${i}`)
            filefilter.map((file) => {
                restGet('configs', { server: server[i], app: appcontext[i], user: usercontext[i], file: file }, (config) => {
                    console.log({ [file]: config })
                    setServerConfig[i]({ [file]: config })
                })
            })
        }, [server[i], appcontext[i], usercontext[i], filefilter])
    })

    // Get Filter Lists
    useEffect(() => {
        console.log('EFFECT Filter Options')
        const files = Set(servercontext
            .slice(0, columncount)
            .filter((context) => context)
            .flatMap((context) => context.files)
            .filter((file) => !COMMON_FILES.includes(file))
        ).sort(isort)

        const apps = Map(servercontext
            .slice(0, columncount)
            .filter((context) => context)
            .flatMap((context) => Object.entries(context.apps))
            .reduce((apps, [name, { label }]) => {
                if (!apps[name]) {
                    apps[name] = label
                } else if (!apps[name].includes(label)) {
                    apps[name] = `${apps[name]} / ${label}`
                }
                return apps
            }, {})
        ).sort(isort)

        setFileOptions(files)
        setAppOptions(apps)
    }, [...servercontext, columncount])

    // Get Config keys
    useEffect(() => {
        console.log('EFFECT Config Keys')
        const configdict = serverconfig
            .slice(0, columncount)
            .filter((config) => config)
            .reduce((output, input) => {
                for (const [file, apps] of Object.entries(input)) {
                    for (const [app, stanzas] of Object.entries(apps)) {
                        if (!output[app]) output[app] = { [file]: {} }
                        else if (!output[app][file]) output[app][file] = {}
                        for (const [stanza, content] of Object.entries(stanzas)) {
                            if (!output[app][file][stanza]) output[app][file][stanza] = new Set(Object.keys(content.attr))
                            else Object.keys(content.attr).forEach((attr) => output[app][file][stanza].add(attr))
                        }
                    }
                }
                return output
            }, {})

        const configarray = Object.entries(configdict)
            .sort(isort0)
            .map(([file, apps]) => {
                return [file, Object.entries(apps)
                    .sort(isort0)
                    .map(([app, stanzas]) => {
                        return [app, Object.entries(stanzas)
                            .sort(isort0)
                            .map(([stanza, content]) => {
                                return [stanza, Array.from(content).sort(isort)]
                            })]
                    })]
            })
        setMergedConfig(configarray)
    }, [...serverconfig, columncount])

    // Handlers
    const check = (obj, path) => {
        try {
            return path.reduce((parent, child) => parent[child], obj) !== undefined
        }
        catch {
            return false
        }
    }

    // Methods

    const getConfigRows = (app, file, stanzas) => {
        return stanzas.flatMap(([stanza, attributes]) => [(
            <Table.Row key={app + file + stanza} onRequestToggle={tick}>
                <Table.Cell align="right" truncate className="conf-stanza">[{stanza.substring(0, 30)}]</Table.Cell>
                {servercontext
                    .slice(0, columncount)
                    .map((context, z) => (
                        <Table.Cell key={z}>ACLS GO HERE</Table.Cell>
                    ))}
            </Table.Row>
        ), ...attributes.map((attribute) => (
            <Table.Row key={app + file + stanza + attribute} onRequestToggle={tick}>
                <Table.Cell align="right" truncate className="conf-attribute">{attribute}</Table.Cell>
                {
                    serverconfig
                        .slice(0, columncount)
                        .map((d, z) => (
                            <Table.Cell key={z} className="conf-value">
                                {check(d, [file, app, stanza, 'attr', attribute]) ?
                                    (typeof d[file][app][stanza].attr[attribute] === "boolean" ?
                                        <Switch appearance="toggle" value={d[file][app][stanza].attr[attribute]} /> :
                                        <Text value={d[file][app][stanza].attr[attribute]} />) :
                                    <Text />
                                }
                            </Table.Cell>
                        ))}
            </Table.Row>
        ))
        ])
    }

    const tick = (data) => {

    }

    return (
        <>
            <ColumnLayout divider="vertical">
                <ColumnLayout.Row>
                    <ColumnLayout.Column>
                        <ControlGroup label="Config Files" labelPosition="left">
                            <Multiselect inline values={filefilter} name="files" onChange={handleFileFilter} placeholder={`All ${fileoptions.size} files`} allowKeyMatching={true} >
                                <Select.Heading>Common Files</Select.Heading>
                                {COMMON_FILES.map((file) => (<Multiselect.Option key={file} label={file} value={file} />))}

                                <Select.Heading>All Files</Select.Heading>
                                {fileoptions.map((file) => (<Multiselect.Option key={file} label={file} value={file} />))}
                            </Multiselect>
                        </ControlGroup>
                        <ControlGroup label="Apps" labelPosition="left">
                            <Multiselect inline values={appfilter} onChange={handleAppFilter} placeholder={`All ${appoptions.size} apps`} allowKeyMatching={true} noOptionsMessage="Select at least one server first">
                                {appoptions.map((label, id) => (<Multiselect.Option key={id} label={label} value={id} />)).toList()}
                            </Multiselect>
                        </ControlGroup>
                    </ColumnLayout.Column>
                    {COLUMN_INDEX.slice(0, columncount).map((z) => (
                        < ColumnLayout.Column key={z} >
                            <ControlGroup label="Server" labelPosition="left">
                                <Select inline appearance="primary" value={server[z]} onChange={handleServer[z]} error={!server[z]}>
                                    {serveroptions.map(s => (<Select.Option key={s} label={s} value={s} />))}
                                </Select>
                            </ControlGroup>
                            <ControlGroup label="App Context" labelPosition="left">
                                <Select inline value={appcontext[z]} onChange={handleAppContext[z]} disabled={!server[z]} animateLoading={!servercontext[z]}>
                                    <Select.Option label="All" value="-" />
                                    <Select.Option label="None" description="system" value="system" />
                                    {servercontext[z] ? Object.entries(servercontext[z].apps).map(([id, { label }]) => (<Select.Option key={id} label={label} description={id} value={id} />)) : null}
                                </Select>
                            </ControlGroup>
                            <ControlGroup label="User Context" labelPosition="left">
                                <Select inline value={usercontext[z]} onChange={handleUserContext[z]} disabled={!server[z]} animateLoading={!servercontext[z]}>
                                    <Select.Option label="Nobody" value="nobody" />
                                    {servercontext[z] ? Object.entries(servercontext[z].users).map(([user, real]) => (<Select.Option key={user} label={real} description={user} value={user} />)) : null}
                                </Select>
                            </ControlGroup>
                        </ColumnLayout.Column>
                    ))}
                </ColumnLayout.Row>
            </ColumnLayout >
        </>
    )
}

getUserTheme()
    .then((theme) => {
        const splunkTheme = getThemeOptions(theme);
        layout(
            <SplunkThemeProvider {...splunkTheme}>
                <StyledContainer>
                    <Configs />
                </StyledContainer>
            </SplunkThemeProvider>,
            splunkTheme
        );
    })
    .catch((e) => {
        const errorEl = document.createElement('span');
        errorEl.innerHTML = e;
        document.body.appendChild(errorEl);
    });
