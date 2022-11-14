/* eslint-disable */
import debounce from "lodash.debounce";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Shared
import { restPost } from "../../shared/fetch";
import { useLocal, wrapSetValue, cloudUnsafe } from "../../shared/helpers";
import Page from "../../shared/page";
import { AttributeSpan, StanzaSpan, StyledContainer, ValueSpan } from "../../shared/styles";
import { SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT, COMMON_FILES } from "../../shared/const";
import { useQueryContext, useQueryConfig, useQueryServers } from "../../shared/hooks";

// Splunk UI
import Button from "@splunk/react-ui/Button";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import ComboBox from "@splunk/react-ui/ComboBox";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Multiselect, { Heading } from "@splunk/react-ui/Multiselect";
import Select from "@splunk/react-ui/Select";
import TextArea from "@splunk/react-ui/TextArea";
import Typography from "@splunk/react-ui/Typography";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";

import { username } from "@splunk/splunk-utils/config";
import { useMutation } from "@tanstack/react-query";

const ConfigWrite = () => {
  const queryClient = useQueryClient();

  // Selected Data
  const [server, setServer] = useLocal("BADRCM_writeserver");
  const handleServer = wrapSetValue(setServer);
  const [app, setApp] = useLocal("BADRCM_writeapp", SYSTEM_APP_CONTEXT.name);
  const handleApp = wrapSetValue(setApp);
  const [user, setUser] = useLocal("BADRCM_writeuser", SYSTEM_USER_CONTEXT.name);
  const handleUser = wrapSetValue(setUser);
  const [file, setFile] = useLocal("BADRCM_writefile");
  const handleFile = wrapSetValue(setFile);
  const [stanza, setStanza] = useLocal("BADRCM_writestanza", "");
  const handleStanza = wrapSetValue(setStanza);

  // State - Loaded Data
  const servers = useQueryServers();
  const context = useQueryContext(server, {
    onSuccess: (data) => {
      if (app && ![...Object.keys(data.apps), SYSTEM_APP_CONTEXT.name].includes(app)) setApp(null);
      if (user && ![...Object.keys(data.users), SYSTEM_USER_CONTEXT.name].includes(user)) setUser(null);
      if (file && !data.files.includes(file)) setFile(null);
    },
  });

  const config = useQueryConfig({ server, appcontext: app, usercontext: user }, file, { enabled: !context.isFetching });
  const stanzaOptions = useMemo(() => (config.data?.[app] ? Object.keys(config.data[app]) : []), [config.data]);

  // State - Input
  const [input, setInput] = useState("");
  const handleInput = wrapSetValue(setInput);
  const [inputerror, setInputError] = useState(false);

  // State - Calculated
  const currentConfig = useMemo(() => Object.entries(config.data?.[app]?.[stanza]?.attr || {}), [config, stanza]);
  const [output, setOutput] = useState([]);
  const [changes, setChanges] = useState();

  // Effect - Process Input
  const debouncedInput = useCallback(
    debounce((input, config, app, stanza) => {
      setInputError(false);

      const changes = input
        .split("\n")
        .filter((line) => line)
        .map((line) => {
          const x = line.indexOf("=");
          const attribute = line.slice(0, x).trim();
          const value = line.slice(x + 1).trim() || "";
          if (x > 0 && attribute.length) {
            return [attribute, value];
          } else {
            setInputError(true);
            return null;
          }
        })
        .filter((line) => line);
      setChanges(Object.fromEntries(changes));

      const existing = config?.[app]?.[stanza]?.attr;

      if (existing) {
        const output = changes.reduce(
          (output, [attribute, value]) => {
            output[attribute] = value;
            return output;
          },
          { ...existing }
        );
        setOutput(Object.entries(output));
      } else {
        setOutput(changes);
      }
    }, 500),
    []
  );
  useEffect(() => {
    // Check requirements are met
    debouncedInput(input, config.data, app, stanza);
  }, [input, config.data, app, stanza]);

  // Handlers
  const write = useMutation({
    mutationFn: () =>
      config.data?.[app]?.[stanza]
        ? restPost("configs", { server, file, user, app, stanza }, changes)
        : restPost("configs", { server, file, user, app, stanza: "" }, { ...changes, name: stanza }),
    onSuccess: (config) => {
      queryClient.setQueryData(["configs", server, file, app, user], (prev) =>
        Object.entries(config).reduce(
          (prev, [app, stanzas]) =>
            Object.entries(stanzas).reduce((prev, [stanza, content]) => {
              prev[app][stanza] = content;
              return prev;
            }, prev),
          prev
        )
      );
    },
  });

  // Render
  return (
    <ColumnLayout divider="vertical">
      <ColumnLayout.Row>
        <ColumnLayout.Column>
          <ControlGroup label="Server" labelPosition="left">
            <Select inline appearance="primary" value={server} onChange={handleServer} animateLoading={servers.data.length === 0} error={!server}>
              {servers.data.map((s) => (
                <Select.Option key={s} label={s} value={s} />
              ))}
            </Select>
          </ControlGroup>
          <ControlGroup label="Conf File" labelPosition="left">
            <Select inline filter value={file} onChange={handleFile} disabled={!server} error={!file}>
              <Select.Heading>Common Files</Select.Heading>
              {COMMON_FILES.map((file) => (
                <Multiselect.Option key={file} label={file} value={file} />
              ))}

              <Select.Heading>All Files</Select.Heading>
              {context.data &&
                context.data.files.filter((file) => !COMMON_FILES.includes(file)).map((file) => <Multiselect.Option key={file} label={file} value={file} />)}
            </Select>
          </ControlGroup>
        </ColumnLayout.Column>
        <ColumnLayout.Column>
          <ControlGroup label="App" labelPosition="left">
            <Select inline value={app} onChange={handleApp} disabled={!server} error={!app} filter>
              <Select.Option label={SYSTEM_APP_CONTEXT.label} description={SYSTEM_APP_CONTEXT.name} value={SYSTEM_APP_CONTEXT.name} />
              {context.data && Object.entries(context.data.apps).map(([id, [label]]) => <Select.Option key={id} label={label} description={id} value={id} />)}
            </Select>
          </ControlGroup>
          <ControlGroup label="Owner" labelPosition="left">
            <Select inline filter value={user} onChange={handleUser} disabled={!server} error={!user}>
              <Select.Heading>General</Select.Heading>
              <Select.Option label={SYSTEM_USER_CONTEXT.realname} description={SYSTEM_USER_CONTEXT.realname} value={SYSTEM_USER_CONTEXT.name} />
              {context.data && context.data.users[username] ? <Select.Option label="Your User" value={username} description={username} /> : null}
              <Select.Heading>All Users</Select.Heading>
              {context.data &&
                Object.entries(context.data.users).map(([username, [realname]]) => (
                  <Select.Option key={username} label={realname} description={username} value={username} />
                ))}
            </Select>
          </ControlGroup>
        </ColumnLayout.Column>
        <ColumnLayout.Column>
          <ControlGroup label="Stanza" labelPosition="left">
            <ComboBox
              inline
              value={stanza}
              onChange={handleStanza}
              disabled={!server || !app || !user || !file || !config}
              error={!stanza}
              noOptionsMessage="No Stanzas found, but you can still create a new one"
            >
              {stanzaOptions.map((stanza) => (
                <ComboBox.Option key={stanza} label={stanza} value={stanza} />
              ))}
            </ComboBox>
          </ControlGroup>
          <ControlGroup label="Sharing" labelPosition="left">
            <Select
              inline
              disabled
              value={config.data?.[app]?.[stanza]?.acl?.sharing || app == "system" ? "global" : user == "nobody" ? "app" : "private"}
              //onChange={handleFile}
              //disabled={!stanza || !user}
              error={!stanza}
            >
              <Select.Option label="User" value="user" disabled={user == "nobody" || app == "system"} />
              <Select.Option label="App" value="app" disabled={app == "system"} />
              <Select.Option label="Global" value="global" />
            </Select>
          </ControlGroup>
        </ColumnLayout.Column>
      </ColumnLayout.Row>
      {server && app && user && file && stanza && config ? (
        <ColumnLayout.Row>
          <ColumnLayout.Column>
            <Heading level={3}>Current</Heading>
            <StanzaSpan>[{stanza}]</StanzaSpan>
            <ConfigDisplay value={currentConfig} />
          </ColumnLayout.Column>
          {config.data?.[app]?.[stanza]?.acl?.can_write === false || cloudUnsafe(server, app) ? (
            <ColumnLayout.Column>
              <Heading level={3}>You do not have access to change this stanza</Heading>
            </ColumnLayout.Column>
          ) : (
            <ColumnLayout.Column>
              <Heading level={3}>Changes</Heading>
              <StanzaSpan>[{stanza}]</StanzaSpan>
              <TextArea placeholder="attribute = value" onChange={handleInput} value={input} canClear rowsMin={5} rowsMax={25} error={inputerror}></TextArea>
              <br />
              <Button
                label={write.isLoading ? <WaitSpinner /> : "Write Changes"}
                appearance="primary"
                onClick={write.mutate}
                disabled={write.isLoading || inputerror || !config}
                width="100%"
              />
            </ColumnLayout.Column>
          )}
          <ColumnLayout.Column>
            <Heading level={3}>Preview</Heading>
            <StanzaSpan>[{stanza}]</StanzaSpan>
            <ConfigDisplay value={output} />
          </ColumnLayout.Column>
        </ColumnLayout.Row>
      ) : null}
    </ColumnLayout>
  );
};

const ConfigDisplay = ({ value }) => {
  return value.map(([a, v]) => (
    <Typography as="p" variant="monoBody" key={a}>
      <AttributeSpan>{a}</AttributeSpan> = <ValueSpan>{v}</ValueSpan>
    </Typography>
  ));
};

Page(
  <StyledContainer>
    <ConfigWrite />
  </StyledContainer>
);
