/* eslint-disable */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-array-index-key */
/* eslint-disable no-nested-ternary */

import React, { useState, useEffect, useReducer, useCallback } from 'react';

import debounce from 'lodash.debounce';

import { Map, Set } from 'immutable'
import { StyledContainer, StanzaSpan, AttributeSpan, InfoCell, AttributeCell, InputCell } from './Styles';
import Page from '../../shared/page'
import { isort, isort0, tupleSplit, wrapSetValues, wrapSetValue, localLoad, localSave } from '../../shared/helpers'
import { restGet, restChange, cleanUp } from '../../shared/fetch'
import { LOCAL_filefilter, LOCAL_appfilter, LOCAL_columncount } from '../../shared/const'

import { username } from '@splunk/splunk-utils/config';

import Button from '@splunk/react-ui/Button';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import ColumnLayout from '@splunk/react-ui/ColumnLayout';
import Number from '@splunk/react-ui/Number';
import Multiselect from '@splunk/react-ui/Multiselect';
import Select from '@splunk/react-ui/Select';
import Switch from '@splunk/react-ui/Switch';
import Text from '@splunk/react-ui/Text';
import Table from '@splunk/react-ui/Table';
import Link from '@splunk/react-ui/Link';

//import Globe from '@splunk/react-icons/Globe';
//import Dashboard from '@splunk/react-icons/Dashboard';
//import User from '@splunk/react-icons/User';

const Configs = () => {
    // Constants
    const MAX_COLUMNS = 4
    const COLUMN_INDEX = Array(MAX_COLUMNS).fill().map((_, i) => i)
    const DEFAULT_APP_CONTEXT = { name: '-', label: "All" }
    const SYSTEM_APP_CONTEXT = { name: 'system', label: "System" }
    const DEFAULT_USER_CONTEXT = { name: 'nobody', realname: "Nobody" }
    const COMMON_FILES = ['props', 'transforms', 'eventtypes', 'inputs', 'outputs', 'server'] //'app', 'authentication', 'authorize', 'collections', 'commands', 'datamodels',  'fields', 'global-banner', 'health', 'indexes', 'limits', 'macros', 'passwords', 'savedsearches', 'serverclass', 'tags', 'web']
    /*const SHARING_ICON = {
        'global': <Globe size={1} screenReaderText="Global" />,
        'app': <Dashboard size={1} screenReaderText="App" />,
        'user': <User size={1} screenReaderText="User" />
    }*/

    // Helpers



    // State - Page Selectors
    const [filefilter, setFileFilter] = useState(localLoad(LOCAL_filefilter, ['props', 'transforms'])); //
    const handleFileFilter = wrapSetValues(localSave(setFileFilter, LOCAL_filefilter))
    const [appfilter, setAppFilter] = useState(localLoad(LOCAL_appfilter, []));
    const handleAppFilter = wrapSetValues(localSave(setAppFilter, LOCAL_appfilter))
    const [columncount, setColumnCount] = useState(localLoad(LOCAL_columncount, 2));
    const handleColumnCount = wrapSetValue(localSave(setColumnCount, LOCAL_columncount))

    const [fileoptions, setFileOptions] = useState(Set());
    const [appoptions, setAppOptions] = useState(Map());

    // State - Column Selector
    const [server, setServer] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_server${z}`))))
    const handleServer = setServer.map((f, z) => wrapSetValue(localSave(f, `BADRCM_server${z}`)))
    const [appcontext, setAppContext] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_appcontext${z}`, DEFAULT_APP_CONTEXT.name))))
    const handleAppContext = setAppContext.map((f, z) => wrapSetValue(localSave(f, `BADRCM_appcontext${z}`)))
    const [usercontext, setUserContext] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_usercontext${z}`, DEFAULT_USER_CONTEXT.name))))
    const handleUserContext = setUserContext.map((f, z) => wrapSetValue(localSave(f, `BADRCM_usercontext${z}`)))

    const [loading, setLoading] = tupleSplit(COLUMN_INDEX.map(() => useState(0)))
    // const handleLoading = setLoading.map(wrapSetValue)

    const [serveroptions, setServerOptions] = useState([]);
    const [servercontext, setServerContext] = tupleSplit(COLUMN_INDEX.map(() => useState()))
    const [serverconfig, mergeServerConfig] = tupleSplit(COLUMN_INDEX.map((z) => useReducer((prev, update) => {
        const x = prev.mergeDeep(update)
        console.log("MERGE", z)
        return x
    }, Map())))
    // const [appcontextoptions, setAppContextOptions] = tupleSplit(COLUMN_INDEX.map(useState([])))
    // const [usercontextoptions, setUserContextOptions] = tupleSplit(COLUMN_INDEX.map(useState([])))

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
                    mergeServerConfig[i]({ [file]: config })
                })
            })
        }, [server[i], appcontext[i], usercontext[i], filefilter])
    })

    // Get Filter Lists
    const debouncedFilterOptions = useCallback(debounce((servercontext, columncount) => {
        console.log('EFFECT Filter Options', serverconfig)
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
    }, 100), [])
    useEffect(() => { debouncedFilterOptions(servercontext, columncount) }, [...servercontext, columncount])

    // Get Config keys
    const debouncedServerContext = useCallback(debounce((serverconfig, columncount) => {
        console.log('EFFECT Config Keys', serverconfig)
        const configdict = serverconfig
            .slice(0, columncount)
            .filter((config) => config)
            .reduce((output, input) => {
                for (const [file, apps] of input.entries()) {
                    for (const [app, stanzas] of Object.entries(apps)) {
                        if (!output[app]) output[app] = { [file]: {} }
                        else if (!output[app][file]) output[app][file] = {}
                        for (const [stanza, content] of Object.entries(stanzas)) {
                            if (!output[app][file][stanza]) output[app][file][stanza] = {}
                            for (const [attr, value] of Object.entries(content.attr)) {
                                if (!output[app][file][stanza][attr]) output[app][file][stanza][attr] = [value]
                                else output[app][file][stanza][attr].push(value)
                            }
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
                            .map(([stanza, attributes]) => {
                                return [stanza, Object.entries(attributes)
                                    .sort(isort0)
                                    .map(([attribute, values]) => {
                                        return [attribute, {
                                            // Use boolean only if all values are boolean
                                            text: values.some(value => typeof value !== "boolean"),
                                            // 0 if different, 1 if only one value, 2 if all the same
                                            same: values.every(value => value == values[0]) * 2 - (values.length === 1)
                                        }]
                                    })]
                            })]
                    })]
            })
        setMergedConfig(configarray)
    }, 100), [])
    useEffect(() => { debouncedServerContext(serverconfig, columncount) }, [...serverconfig, columncount])

    // Handlers
    const check = (obj, path) => {
        try {
            return path.reduce((parent, child) => parent[child], obj) !== undefined
        }
        catch (e) {
            //console.warn(e)
            return false
        }
    }

    // Methods

    const handleConfigChangeFactory = (z, file, app, stanza, attr) => (e, { value }) => {
        console.log("Changing", attr)
        restChange('configs', { 'server': server[z], file, user: usercontext[z], app, stanza }, { [attr]: value }).then((resp) => {
            console.log("Changed", attr)
            mergeServerConfig[z]({ [file]: resp })
        })
    }

    const getConfigRows = (app, file, stanzas) => {
        console.log("GET CONFIG ROWS", app, file, stanzas)
        return stanzas.flatMap(([stanza, attributes]) => [(
            <Table.Row key={app + file + stanza} >
                <InfoCell align="right" truncate><StanzaSpan>[{stanza.substring(0, 30)}]</StanzaSpan></InfoCell>
                {serverconfig
                    .slice(0, columncount)
                    .map((config, z) => {
                        /*if (!server[z] || !config.hasIn([file, app, stanza])) return (
                            <InfoCell key={z}></InfoCell>
                        )*/
                        const acl = config.getIn([file, app, stanza, 'acl'])
                        if (acl === undefined) return (
                            <InfoCell key={z}></InfoCell>
                        )
                        return (
                            <InfoCell key={z}>Sharing: <b>{acl.sharing}</b> - Owner: <b>{acl.owner}</b></InfoCell>
                        )
                    })}
            </Table.Row>
        ), ...attributes.map(([attribute, metadata]) => (
            <Table.Row key={app + file + stanza + attribute} >
                <AttributeCell align="right" truncate>{attribute}</AttributeCell>
                {
                    serverconfig
                        .slice(0, columncount)
                        .map((config, z) => {
                            const value = config.getIn([file, app, stanza, 'attr', attribute])
                            if (!server[z] || !config.hasIn([file, app, stanza])) return (
                                <InputCell key={z}></InputCell>
                            )
                            if (value === undefined) return (
                                <InputCell key={z}>
                                    <Button
                                        appearance="pill"
                                        value={metadata.text ? "" : false}
                                        onClick={handleConfigChangeFactory(z, file, app, stanza, attribute)}
                                        label="Create Attribute"
                                    />
                                </InputCell>
                            )
                            return (
                                <ConfigInput
                                    key={z}
                                    value={value}
                                    metadata={metadata}
                                    disabled={!config.getIn([file, app, stanza, 'acl', 'can_write'])}
                                    handle={handleConfigChangeFactory(z, file, app, stanza, attribute)}
                                />
                            )
                        })
                }
            </Table.Row >
        ))
        ])
    }

    //icon={(<img width="20" src={`${splunkdPath}/servicesNS/${username}/${name}/static/appIconAlt.png`} />)}
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
                        <ControlGroup label="Columns" labelPosition="left">
                            <Number inline value={columncount} onChange={handleColumnCount} min={1} max={MAX_COLUMNS}></Number>
                        </ControlGroup>
                    </ColumnLayout.Column>
                    {COLUMN_INDEX.slice(0, columncount).map((z) => (
                        < ColumnLayout.Column key={z} >
                            <ControlGroup label="Server" labelPosition="left">

                                <Select inline appearance="primary" value={server[z]} onChange={handleServer[z]} error={!server[z]}>

                                    {serveroptions.map(s => (<Select.Option key={s} label={s} value={s} />))}
                                    <Select.Divider />
                                    <Select.Option label="None" value="" />
                                </Select>
                            </ControlGroup>
                            <ControlGroup label="App Context" labelPosition="left">
                                <Select inline value={appcontext[z]} onChange={handleAppContext[z]} disabled={!server[z]} animateLoading={!servercontext[z]}>
                                    <Select.Heading>Special</Select.Heading>
                                    <Select.Option label="All Apps" value="-" />
                                    <Select.Option label="None / Global" description="system" value="system" />
                                    <Select.Heading>Apps</Select.Heading>
                                    {servercontext[z] ? Object.entries(servercontext[z].apps).map(([id, { label }]) => (<Select.Option key={id} label={label} description={id} value={id} />)) : null}
                                </Select>
                            </ControlGroup>
                            <ControlGroup label="User Context" labelPosition="left">
                                <Select inline value={usercontext[z]} onChange={handleUserContext[z]} disabled={!server[z]} animateLoading={!servercontext[z]}>

                                    <Select.Heading>Special</Select.Heading>
                                    <Select.Option label="Nobody" value="nobody" />
                                    {servercontext[z] && servercontext[z].users[username] ? <Select.Option label="Your User" value={username} description={username} /> : null}
                                    <Select.Heading>All Users</Select.Heading>
                                    {servercontext[z] ? Object.entries(servercontext[z].users).map(([user, real]) => (<Select.Option key={user} label={real} description={user} value={user} />)) : null}
                                </Select>
                            </ControlGroup>
                        </ColumnLayout.Column>
                    ))}
                </ColumnLayout.Row>
            </ColumnLayout >
            <br />
            <Table stripeRows rowExpansion="multi">
                <Table.Head>
                    <Table.HeadCell >Config Editor</Table.HeadCell>
                    {server
                        .slice(0, columncount)
                        .map((servername, z) => (
                            <Table.HeadCell key={z}>{servername || "No Server Selected"}</Table.HeadCell>
                        ))}
                </Table.Head>
                <Table.Body>
                    {
                        mergedconfig
                            .filter(([app]) => (appfilter.length === 0 || appfilter.includes(app)))
                            .flatMap(([app, files]) =>
                                files
                                    .filter(([file]) => (filefilter.length === 0 || filefilter.includes(file)))
                                    .map(([file, stanzas]) => (
                                        <Table.Row key={app + file} expansionRow={getConfigRows(app, file, stanzas)} >
                                            <Table.Cell><b>{app} / {file}.conf</b></Table.Cell>
                                            {servercontext
                                                .slice(0, columncount)
                                                .map((context, z) => {
                                                    if (!server[z] || !serverconfig[z].hasIn([file, app])) return (
                                                        <Table.Cell key={z}></Table.Cell>
                                                    )
                                                    return (
                                                        <Table.Cell key={z}>{check(context, ['apps', app, 'label']) ? context.apps[app].label : null} {check(context, ['apps', app, 'version']) ? context.apps[app].version : null}</Table.Cell>
                                                    )


                                                })}

                                        </Table.Row>
                                    )))
                    }
                </Table.Body>
            </Table>
        </>
    )
}

const ConfigInput = ({ value, handle, disabled, metadata }) => {
    const [internalvalue, setInternalValue] = useState(value); //
    const deboundedHandle = useCallback(debounce(handle, 1000), [])
    const inputHandle = (e, data) => {
        setInternalValue(data.value)
        deboundedHandle(e, data)
    }

    useEffect(() => {
        setInternalValue(value)
    }, [value])

    if (metadata.text)
        return (
            <InputCell>
                <Text
                    value={internalvalue}
                    onChange={inputHandle}
                    disabled={disabled}
                    error={metadata.same === 0}
                />
            </InputCell>
        )
    else return (
        <InputCell>
            <Switch
                appearance="toggle"
                selected={internalvalue}
                value={!internalvalue}
                onClick={inputHandle}
                disabled={disabled}
                error={metadata.same === 0}
            />
        </InputCell>
    )
}

Page(
    <StyledContainer>
        <Configs />
    </StyledContainer>
)