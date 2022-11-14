import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

// Components
import Button from "@splunk/react-ui/Button";
import Card from "@splunk/react-ui/Card";
import CardLayout from "@splunk/react-ui/CardLayout";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import DL from "@splunk/react-ui/DefinitionList";
import Link from "@splunk/react-ui/Link";
import RadioBar from "@splunk/react-ui/RadioBar";
import Text from "@splunk/react-ui/Text";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";

// Shared
import { restPost, restDelete } from "../../shared/fetch";
import { useQueryContext, useQueryServers } from "../../shared/hooks";
import Page from "../../shared/page";

const Servers = () => {
  const { data } = useQueryServers();

  return (
    <CardLayout cardMinWidth={400} wrapCards>
      {data.map((server) => (
        <Card key={server}>
          <ServerCard server={server} key={server} />
        </Card>
      ))}
      <Card>
        <AddServerCard />
      </Card>
    </CardLayout>
  );
};

const ServerCard = ({ server }) => {
  const queryClient = useQueryClient();

  const { isLoading, data } = useQueryContext(server);

  const removeServer = (e, { value }) => {
    return restDelete("servers", { server: value }).then(
      () => {
        queryClient.setQueryData(["servers"], (prev) => prev.filter((server) => server !== value));
      },
      () => {
        // No Catch
      }
    );
  };
  return (
    <>
      <Card.Header title={server} />
      <Card.Body>
        {isLoading || !data ? (
          <WaitSpinner />
        ) : (
          <DL termWidth={100}>
            <DL.Term>Username</DL.Term>
            <DL.Description>{data.username}</DL.Description>
            <DL.Term>Roles</DL.Term>
            <DL.Description>
              {data.roles.length <= 4 ? data.roles.join(", ") : `${data.roles.slice(0, 3).join(", ")} (+${data.roles.length - 3} more)`}
            </DL.Description>
            <DL.Term>App Count</DL.Term>
            <DL.Description>{Object.keys(data.apps).length}</DL.Description>
            <DL.Term>User Count</DL.Term>
            <DL.Description>{Object.keys(data.users).length}</DL.Description>
            <DL.Term>Conf Types</DL.Term>
            <DL.Description>{Object.keys(data.files).length}</DL.Description>
          </DL>
        )}
      </Card.Body>
      {server === "local" ? null : (
        <Card.Footer showBorder={false}>
          <Button label="Remove" appearance="default" onClick={removeServer} value={server} />
        </Card.Footer>
      )}
    </>
  );
};

// Seperate out the add server card here
const AddServerCard = () => {
  const queryClient = useQueryClient();
  const { data: servers } = useQueryServers();

  const DEFAULT_SERVER = "";
  const DEFAULT_TOKEN = "";
  const DEFAULT_SHARE = false;

  const [server, setServer] = useState(DEFAULT_SERVER);
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [share, setShare] = useState(DEFAULT_SHARE);
  const [servererror, setServerError] = useState();
  const [tokenerror, setTokenError] = useState();
  const [running, setRunning] = useState(false);

  const authhelp = (
    <span>
      See{" "}
      <Link openInNewContext to="https://docs.splunk.com/Documentation/Splunk/latest/Security/UseAuthTokens">
        Splunk Docs
      </Link>{" "}
      for help creating Auth Tokens.
    </span>
  );
  const serverhelp = <span>Include splunkd port if it's not :8089.</span>;

  async function addServer() {
    setTokenError();
    if (servers.includes(server)) {
      setServerError("Already exists, please delete existing server first.");
      return Promise.resolve();
    }
    setServerError();
    setRunning(true);
    return restPost("servers", { server }, { token, share })
      .then(
        (data) => {
          if (data === undefined) {
            queryClient.setQueryData(["servers"], (prev) => prev.concat([server]));
            queryClient.invalidateQueries(["servers"]);
            setServer(DEFAULT_SERVER);
            setToken(DEFAULT_TOKEN);
            setShare(DEFAULT_SHARE);
          } else {
            data.class === "AuthenticationFailed" ? setTokenError("Authentication failed, check Splunk Hostname and Auth Token.") : setServerError(data.args);
          }
        },
        (data) => {
          console.error(data);
        }
      )
      .then(setRunning(false));
  }

  return (
    <>
      <Card.Header title="Add New Server" />
      <Card.Body>
        <ControlGroup label="Splunk Hostname" help={servererror || serverhelp} error={!!servererror}>
          <Text placeholder="stack.splunkcloud.com[:8089]" value={server} onChange={(e, { value }) => setServer(value)} />
        </ControlGroup>
        <ControlGroup label="Auth Token" help={tokenerror || authhelp} error={!!tokenerror}>
          <Text value={token} onChange={(e, { value }) => setToken(value)} passwordVisibilityToggle />
        </ControlGroup>
        <ControlGroup label="Sharing">
          <RadioBar onChange={(e, { value }) => setShare(value)} value={share}>
            <RadioBar.Option value={false} label="Private" />
            <RadioBar.Option value label="Shared" />
          </RadioBar>
        </ControlGroup>
      </Card.Body>
      <Card.Footer showBorder={false}>
        <Button label="Add" appearance="primary" onClick={addServer} disabled={running || server.length < 3 || token.length < 100} />
      </Card.Footer>
    </>
  );
};

Page(<Servers />, true);
