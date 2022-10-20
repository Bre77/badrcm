import React, { useState, useEffect } from 'react';
import layout from '@splunk/react-page';
import { getUserTheme, getThemeOptions } from '@splunk/splunk-utils/themes';
import { SplunkThemeProvider } from '@splunk/themes';

import { StyledContainer } from './Styles';
import { get, change, cleanUp } from '../../shared/badrcm'
import { GlobalStyle } from '../../shared/styles'

import CardLayout from '@splunk/react-ui/CardLayout';
import Card from '@splunk/react-ui/Card';
import DL from '@splunk/react-ui/DefinitionList';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import Button from '@splunk/react-ui/Button';
import Text from '@splunk/react-ui/Text';
import Link from '@splunk/react-ui/Link';
import RadioBar from '@splunk/react-ui/RadioBar';
import ControlGroup from '@splunk/react-ui/ControlGroup';

const Servers = () => {

    const default_name = "splunktrust.splunkcloud.com"
    const default_token = "eyJraWQiOiJzcGx1bmsuc2VjcmV0IiwiYWxnIjoiSFM1MTIiLCJ2ZXIiOiJ2MiIsInR0eXAiOiJzdGF0aWMifQ.eyJpc3MiOiJicmV0dF9hZGFtcyBmcm9tIHNoLWktMGQyMjAyYzJhYjYzNTRiMmYiLCJzdWIiOiJicmV0dF9hZGFtcyIsImF1ZCI6IkJBRFJDTSIsImlkcCI6IlNwbHVuayIsImp0aSI6ImJiMWE4M2QyNGZiMDZjZTY1YjBiY2NjMzE3MzdkOTQ5YTkwYWRkMzg4ZGU1YWIyNmEyZjQxYWJkM2IwYmQ3NWUiLCJpYXQiOjE2NjU0NTIwNjAsImV4cCI6MTY3MzIyODA2MCwibmJyIjoxNjY1NDUyMDYwfQ.59l5P18hB7X7BDf9TVgtnKkA6PpGveTizaiaxPhNYHgOeTaE3fCzUyjIl1w9FzC_UoDuEcLkuT1UovnHShfK8g"
    const default_share = true


    const [servers, setServers] = useState([]);
    const [name, setName] = useState(default_name);
    const [token, setToken] = useState(default_token);
    const [share, setShare] = useState(default_share);
    const [nameerror, setNameError] = useState();
    const [tokenerror, setTokenError] = useState();
    const [running, setRunning] = useState(false);

    const authhelp = (<span>See <Link openInNewContext to={'https://docs.splunk.com/Documentation/Splunk/latest/Security/UseAuthTokens'}>Splunk Docs</Link> for help creating Auth Tokens.</span>)
    const namehelp = (<span>Include splunkd port if it's not :8089.</span>)

    useEffect(() => {
        get('servers', {}, setServers).then(() => { cleanUp() })
    }, []);

    async function addServer() {
        setTokenError()
        if (servers.includes(name)) {
            setNameError("Already exists, please delete existing server first.")
            return Promise.resolve()
        }
        setNameError()
        setRunning(true)
        return change('servers', { 'server': name }, { 'token': token, 'shared': share }).then(() => {
            //Success
            setServers(servers.concat([name]))
            setName(default_name)
            setToken(default_token)
            setShare(default_share)
            return get('servers', {}, setServers, 1) // Fill cache
        }, (data) => {
            if (data.status == 400) {
                if (data.class == "AuthenticationFailed") {
                    setTokenError("Authentication failed, check Splunk Hostname and Auth Token.")
                } else {
                    setNameError(data.args[0])
                }
            } else console.error(data)
        }).then(setRunning(false))
    }

    const removeServer = (e, { value }) => {
        console.log(value)
        return change('servers', { 'server': value }, {}, 'DELETE').then(() => {
            setServers(servers.filter(x => x !== value))
            return get('servers', {}, setServers, 1) // Fill cache
        }, () => {
            // No Catch
        })
    }

    return (
        <CardLayout cardMinWidth={400} wrapCards={true}>
            {servers.map((server) => (
                <Card key={server}>
                    <ServerCard name={server} key={server} onClick={removeServer} />
                </Card>
            ))}
            <Card>
                <Card.Header title="Add New Server" />
                <Card.Body>
                    <ControlGroup label="Splunk Hostname" help={nameerror || namehelp} error={!!nameerror}>
                        <Text placeholder="stack.splunkcloud.com[:8089]" value={name} onChange={(e, { value }) => setName(value)} />
                    </ControlGroup>
                    <ControlGroup label="Auth Token" help={tokenerror || authhelp} error={!!tokenerror}>
                        <Text value={token} onChange={(e, { value }) => setToken(value)} passwordVisibilityToggle />
                    </ControlGroup>
                    <ControlGroup label="Sharing">
                        <RadioBar onChange={(e, { value }) => setShare(value)} value={share} >
                            <RadioBar.Option value={false} label="Private" />
                            <RadioBar.Option value={true} label="Shared" />
                        </RadioBar>
                    </ControlGroup>
                </Card.Body>
                <Card.Footer showBorder={false}>
                    <Button label="Add" appearance="primary" onClick={addServer} disabled={running || name.length < 3 || token.length < 100} />
                </Card.Footer>
            </Card>
        </CardLayout >
    )
}

/*const wrapSet = (func, name = "") => {
    let cancelled = false
    const cancel = () => { cancelled = true; console.warn(name, "YOUR CANCELLED") }
    const run = (x) => { console.warn(name, "WRAPPED", cancelled); return cancelled ? false : func(x) }
    return [run, cancel]
}*/

const ServerCard = (props) => {
    const [details, setDetails] = useState();
    const [running, setRunning] = useState(false);

    useEffect(() => {
        //const [wrappedSet, cancel] = wrapSet(setDetails, props.name)
        setRunning(true)
        get(`servers`, { 'server': props.name }, ([apps, users, files, username, realname, roles]) => {
            setDetails({
                username,
                roles: roles.length <= 4 ? roles.join(', ') : `${roles.slice(0, 3).join(', ')} (+${roles.length - 3} more)`,
                apps: Object.keys(apps).length,
                users: Object.keys(users).length,
                files: Object.keys(files).length,
            })
        }).then(setRunning(false))
        //return cancel
    }, []);

    return <>
        <Card.Header title={props.name} />
        <Card.Body>
            {!!details ?
                (<DL termWidth={100}>
                    <DL.Term>Username</DL.Term>
                    <DL.Description>{details.username}</DL.Description>
                    <DL.Term>Roles</DL.Term>
                    <DL.Description>{details.roles}</DL.Description>
                    <DL.Term>App Count</DL.Term>
                    <DL.Description>{details.apps}</DL.Description>
                    <DL.Term>User Count</DL.Term>
                    <DL.Description>{details.users}</DL.Description>
                    <DL.Term>Conf Types</DL.Term>
                    <DL.Description>{details.files}</DL.Description>
                </DL>) : (<WaitSpinner />)}
        </Card.Body>
        {props.name === "local" ? null : (<Card.Footer showBorder={false}>
            <Button label="Remove" appearance="default" onClick={props.onClick} value={props.name} disabled={running} />
        </Card.Footer>)}
    </>

}


getUserTheme()
    .then((theme) => {
        layout(
            <>
                <GlobalStyle />
                <Servers />
            </>,
            { theme }
        );
    })
    .catch((e) => {
        const errorEl = document.createElement('span');
        errorEl.innerHTML = e;
        document.body.appendChild(errorEl);
    });
