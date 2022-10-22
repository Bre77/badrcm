import React, { useState, useEffect } from 'react';


// Components
import CardLayout from '@splunk/react-ui/CardLayout';
import Card from '@splunk/react-ui/Card';
import DL from '@splunk/react-ui/DefinitionList';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import Button from '@splunk/react-ui/Button';
import Text from '@splunk/react-ui/Text';
import Link from '@splunk/react-ui/Link';
import RadioBar from '@splunk/react-ui/RadioBar';
import ControlGroup from '@splunk/react-ui/ControlGroup';

// Shared
import { restGet, restChange, cleanUp } from '../../shared/fetch'
import Page from '../../shared/page'

const Servers = () => {

    const DEFAULT_NAME = ""
    const DEFAULT_TOKEN = ""
    const DEFAULT_SHARED = false

    const [servers, setServers] = useState([]);
    const [name, setName] = useState(DEFAULT_NAME);
    const [token, setToken] = useState(DEFAULT_TOKEN);
    const [share, setShare] = useState(DEFAULT_SHARED);
    const [nameerror, setNameError] = useState();
    const [tokenerror, setTokenError] = useState();
    const [running, setRunning] = useState(false);

    const authhelp = (<span>See <Link openInNewContext to={'https://docs.splunk.com/Documentation/Splunk/latest/Security/UseAuthTokens'}>Splunk Docs</Link> for help creating Auth Tokens.</span>)
    const namehelp = (<span>Include splunkd port if it's not :8089.</span>)

    useEffect(() => {
        restGet('servers', {}, setServers).then(() => { cleanUp() })
    }, []);

    async function addServer() {
        setTokenError()
        if (servers.includes(name)) {
            setNameError("Already exists, please delete existing server first.")
            return Promise.resolve()
        }
        setNameError()
        setRunning(true)
        return restChange('servers', { 'server': name }, { 'token': token, 'shared': share }).then(() => {
            //Success
            setServers(servers.concat([name]))
            setName(DEFAULT_NAME)
            setToken(DEFAULT_TOKEN)
            setShare(DEFAULT_SHARED)
            return restGet('servers', {}, setServers, 1) // Fill cache
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
        return restChange('servers', { 'server': value }, {}, 'DELETE').then(() => {
            setServers(servers.filter(x => x !== value))
            return restGet('servers', {}, setServers, 1) // Fill cache
        }, () => {
            // No Catch
        })
    }

    return (
        <CardLayout cardMinWidth={400} wrapCards>
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

const ServerCard = ({ name, onClick }) => {
    const [details, setDetails] = useState();
    const [running, setRunning] = useState(false);

    useEffect(() => {
        setRunning(true)
        restGet(`servers`, { 'server': name }, ([apps, users, files, username, , roles]) => {
            setDetails({
                username,
                roles: roles.length <= 4 ? roles.join(', ') : `${roles.slice(0, 3).join(', ')} (+${roles.length - 3} more)`,
                apps: Object.keys(apps).length,
                users: Object.keys(users).length,
                files: Object.keys(files).length,
            })
        }).then(setRunning(false))
    }, []);

    return <>
        <Card.Header title={name} />
        <Card.Body>
            {details ?
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
        {name === "local" ? null : (<Card.Footer showBorder={false}>
            <Button label="Remove" appearance="default" onClick={onClick} value={name} disabled={running} />
        </Card.Footer>)}
    </>

}


Page(<Servers />)