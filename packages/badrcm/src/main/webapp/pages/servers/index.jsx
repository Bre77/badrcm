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
import { fetchGet, restChange } from "../../shared/fetch";
import Page from "../../shared/page";

const Servers = () => {
  const { data } = useQuery(
    ["servers"],
    () => {
      return fetchGet("servers");
    },
    { initialData: [] }
  );

  return (
    <CardLayout cardMinWidth={400} wrapCards>
      {data.map((server) => (
        <Card key={server}>
          <ServerCard name={server} key={server} />
        </Card>
      ))}{" "}
      <Card>
        <AddServerCard servers={data} />
      </Card>
    </CardLayout>
  );
};

const ServerCard = ({ name }) => {
  const queryClient = useQueryClient();

  const { isLoading, data } = useQuery(["server", name], () =>
    fetchGet("servers", { server: name }).then(([apps, users, files, username, , roles]) => ({
      username,
      roles: roles.length <= 4 ? roles.join(", ") : `${roles.slice(0, 3).join(", ")} (+${roles.length - 3} more)`,
      apps: Object.keys(apps).length,
      users: Object.keys(users).length,
      files: Object.keys(files).length,
    }))
  );

  const removeServer = (e, { value }) => {
    return restChange("servers", { server: value }, {}, "DELETE").then(
      () => {
        queryClient.setQueryData(
          ["servers"],
          datafilter((server) => server !== value)
        );
        queryClient.invalidateQueries(["servers"]);
      },
      () => {
        // No Catch
      }
    );
  };

  return (
    <>
      <Card.Header title={name} />
      <Card.Body>
        {isLoading ? (
          <WaitSpinner />
        ) : (
          <DL termWidth={100}>
            <DL.Term>Username</DL.Term>
            <DL.Description>{data.username}</DL.Description>
            <DL.Term>Roles</DL.Term>
            <DL.Description>{data.roles}</DL.Description>
            <DL.Term>App Count</DL.Term>
            <DL.Description>{data.apps}</DL.Description>
            <DL.Term>User Count</DL.Term>
            <DL.Description>{data.users}</DL.Description>
            <DL.Term>Conf Types</DL.Term>
            <DL.Description>{data.files}</DL.Description>
          </DL>
        )}
      </Card.Body>
      {name === "local" ? null : (
        <Card.Footer showBorder={false}>
          <Button label="Remove" appearance="default" onClick={removeServer} value={name} />
        </Card.Footer>
      )}
    </>
  );
};

// Seperate out the add server card here
const AddServerCard = ({ servers }) => {
  const queryClient = useQueryClient();

  const DEFAULT_NAME = "";
  const DEFAULT_TOKEN = "";
  const DEFAULT_SHARE = false;

  const [name, setName] = useState(DEFAULT_NAME);
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [share, setShare] = useState(DEFAULT_SHARE);
  const [nameerror, setNameError] = useState();
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
  const namehelp = <span>Include splunkd port if it's not :8089.</span>;

  async function addServer() {
    setTokenError();
    if (servers.includes(name)) {
      setNameError("Already exists, please delete existing server first.");
      return Promise.resolve();
    }
    setNameError();
    setRunning(true);
    return restChange("servers", { server: name }, { token, share })
      .then(
        () => {
          // Success
          queryClient.setQueryData(["servers"], servers.concat([name]));
          queryClient.invalidateQueries(["servers"]);
          setName(DEFAULT_NAME);
          setToken(DEFAULT_TOKEN);
          setShare(DEFAULT_SHARE);
        },
        (data) => {
          if (data.status === 400) {
            if (data.class === "AuthenticationFailed") {
              setTokenError("Authentication failed, check Splunk Hostname and Auth Token.");
            } else {
              setNameError(data.args[0]);
            }
          } else {
            console.error(data);
          }
        }
      )
      .then(setRunning(false));
  }

  return (
    <>
      <Card.Header title="Add New Server" />
      <Card.Body>
        <ControlGroup label="Splunk Hostname" help={nameerror || namehelp} error={!!nameerror}>
          <Text placeholder="stack.splunkcloud.com[:8089]" value={name} onChange={(e, { value }) => setName(value)} />
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
        <Button label="Add" appearance="primary" onClick={addServer} disabled={running || name.length < 3 || token.length < 100} />
      </Card.Footer>
    </>
  );
};

Page(<Servers />, true);
