/* eslint-disable */
import { Map } from "immutable";
import debounce from "lodash.debounce";
import React, { useCallback, useEffect, useReducer, useState } from "react";

// Shared
import { restChange, restGet } from "../../shared/fetch";
import { useLocal, wrapSetValue } from "../../shared/helpers";
import Page from "../../shared/page";
import { AttributeSpan, StanzaSpan, StyledContainer, ValueSpan } from "../../shared/styles";

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

import { config, username } from "@splunk/splunk-utils/config";

const ConfigWrite = () => {
  const SYSTEM_APP_CONTEXT = { name: "system", label: "System" };
  const SYSTEM_USER_CONTEXT = { name: "nobody", realname: "Nobody" };
  const COMMON_FILES = ["props", "transforms", "eventtypes", "inputs", "outputs", "server"]; //'app', 'authentication', 'authorize', 'collections', 'commands', 'datamodels',  'fields', 'global-banner', 'health', 'indexes', 'limits', 'macros', 'passwords', 'savedsearches', 'serverclass', 'tags', 'web']

  const confString = (entities) => entities.map(([a, v]) => `${a} = ${v}`).join("\n");

  // Selected Data
  const [server, setServer] = useLocal("BADRCM_writeserver");
  const handleServer = wrapSetValue(setServer);
  const [app, setApp] = useLocal("BADRCM_writeapp");
  const handleApp = wrapSetValue(setApp);
  const [user, setUser] = useLocal("BADRCM_writeuser");
  const handleUser = wrapSetValue(setUser);
  const [file, setFile] = useLocal("BADRCM_writefile");
  const handleFile = wrapSetValue(setFile);
  const [stanza, setStanza] = useLocal("BADRCM_writestanza", "");
  const handleStanza = wrapSetValue(setStanza);

  // State - Loaded Data
  const [serveroptions, setServerOptions] = useState([]);
  const [servercontext, setServerContext] = useState();
  const [config, setConfig] = useState(Map());
  const [stanzaOptions, setStanzaOptions] = useState([]);

  // State - Status
  const [error, setError] = useState(false);
  const [loading, setLoading] = useReducer((prev, change) => prev + change, 0);

  // State - Input
  const [input, setInput] = useState("");
  const handleInput = wrapSetValue(setInput);
  const [inputerror, setInputError] = useState(false);

  // State - Calculated
  const [currentConfig, setCurrentConfig] = useState([]);
  const [output, setOutput] = useState([]);
  const [changes, setChanges] = useState();

  // Effect - Startup
  useEffect(() => {
    restGet("servers", {}, setServerOptions);
  }, []);

  // Effect - Get Server Contexts
  useEffect(() => {
    if (!server) return; // Requirements not met
    console.log(`EFFECT Get Context for ${server}`);
    setError(false);
    setLoading(1);
    setServerContext(null);
    setConfig(Map());
    restGet("servers", { server }, ({ apps, users, files }) => {
      // , username, realname, roles
      for (const [app, [label]] of Object.entries(apps)) {
        apps[app] = label;
      }
      for (const [user, [realname]] of Object.entries(users)) {
        users[user] = realname;
      }

      // Check App and User contexts are valid before changing context
      if (app && ![...Object.keys(apps), SYSTEM_APP_CONTEXT.name].includes(app)) {
        console.log("Resetting App Context", app, "didnt exist");
        setApp(null);
      }
      if (user && ![...Object.keys(users), SYSTEM_USER_CONTEXT.name].includes(user)) {
        console.log("Resetting User Context", user, "didnt exist");
        setUser(null);
      }
      if (file && !files.includes(file)) {
        console.log("Resetting File Context", file, "didnt exist");
        setFile(null);
      }

      setServerContext({ apps, users, files });
    }).then(
      () => {
        setLoading(-1);
      },
      (e) => {
        setError(true);
        setLoading(-1);
        console.warn(e);
      }
    );
  }, [server]);

  // Effect - Get Config
  const debouncedGetConfig = useCallback(
    debounce((server, app, user, file) => {
      console.log(`EFFECT Config`);
      setError(false);
      setLoading(1);

      restGet("configs", { server, app, user, file }, (config) => {
        setConfig(Map(config));
        const stanzas = Object.keys(config[app] || {});
        /*if (!stanzas.includes(stanza)) {
          console.log("Clearing Stanza");
          setStanza("");
        }*/
        setStanzaOptions(stanzas);
      }).then(
        () => {
          setLoading(-1);
        },
        (e) => {
          setError(true);
          setLoading(-1);
        }
      );
    }, 100),
    []
  );
  useEffect(() => {
    // Check requirements are met
    if (server && servercontext && app && user && file) debouncedGetConfig(server, app, user, file);
  }, [servercontext, app, user, file]);

  // Effect - Process Input
  const debouncedInput = useCallback(
    debounce((input, config, app, stanza) => {
      setInputError(false);
      console.log(`EFFECT Input`);

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

      const existing = config.getIn([app, stanza, "attr"]);

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
    }, 100),
    []
  );
  useEffect(() => {
    // Check requirements are met
    debouncedInput(input, config, app, stanza);
  }, [input, config, app, stanza]);

  // Effect - Current Config
  useEffect(() => setCurrentConfig(Object.entries(config.getIn([app, stanza, "attr"]) || {})), [config, stanza]);

  // Handlers
  const handleWrite = () => {
    setLoading(1);
    return (
      config.hasIn([app, stanza, "attr"])
        ? restChange("configs", { server, file, user, app, stanza }, changes)
        : restChange("configs", { server, file, user, app, stanza: "" }, { ...changes, name: stanza })
    )
      .then((newdata) => setConfig(config.mergeDeep(newdata)))
      .then(() => {
        setLoading(-1);
      });
  };

  // Render
  return (
    <ColumnLayout divider="vertical">
      <ColumnLayout.Row>
        <ColumnLayout.Column>
          <ControlGroup label="Server" labelPosition="left">
            <Select inline appearance="primary" value={server} onChange={handleServer} animateLoading={serveroptions.length === 0} error={!server}>
              {serveroptions.map((s) => (
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
              {servercontext
                ? servercontext.files.filter((file) => !COMMON_FILES.includes(file)).map((file) => <Multiselect.Option key={file} label={file} value={file} />)
                : null}
            </Select>
          </ControlGroup>
        </ColumnLayout.Column>
        <ColumnLayout.Column>
          <ControlGroup label="App" labelPosition="left">
            <Select inline value={app} onChange={handleApp} disabled={!server} error={!app} filter>
              <Select.Option label={SYSTEM_APP_CONTEXT.label} description={SYSTEM_APP_CONTEXT.name} value={SYSTEM_APP_CONTEXT.name} />
              {servercontext
                ? Object.entries(servercontext.apps).map(([id, label]) => <Select.Option key={id} label={label} description={id} value={id} />)
                : null}
            </Select>
          </ControlGroup>
          <ControlGroup label="Owner" labelPosition="left">
            <Select inline filter value={user} onChange={handleUser} disabled={!server} error={!user}>
              <Select.Heading>General</Select.Heading>
              <Select.Option label={SYSTEM_USER_CONTEXT.realname} description={SYSTEM_USER_CONTEXT.realname} value={SYSTEM_USER_CONTEXT.name} />
              {servercontext && servercontext.users[username] ? <Select.Option label="Your User" value={username} description={username} /> : null}
              <Select.Heading>All Users</Select.Heading>
              {servercontext
                ? Object.entries(servercontext.users).map(([user, real]) => <Select.Option key={user} label={real} description={user} value={user} />)
                : null}
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
              value={config.getIn([app, stanza, "acl", "sharing"]) || app == "system" ? "global" : user == "nobody" ? "app" : "private"}
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
          {config.getIn([app, stanza, "acl", "can_write"]) === false ? (
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
                label={loading ? <WaitSpinner /> : "Write Changes"}
                appearance="primary"
                onClick={handleWrite}
                disabled={!!loading || error || !config}
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
