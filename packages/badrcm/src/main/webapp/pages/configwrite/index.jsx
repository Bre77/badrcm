/* eslint-disable */
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
} from "react";
import debounce from "lodash.debounce";
import { Map } from "immutable";

import Page from "../../shared/page";
import { AsyncButton } from "../../shared/components";
import {
  StyledContainer,
  ShortCell,
  TallCell,
  StanzaSpan,
  AttributeSpan,
  CreateLink,
} from "../../shared/styles";
import {
  wrapSetValue,
  localLoad,
  localSave,
  localDel,
} from "../../shared/helpers";
import { restGet, restChange, cleanUp } from "../../shared/fetch";
import {
  LOCAL_filefilter,
  LOCAL_appfilter,
  LOCAL_columncount,
} from "../../shared/const";

import ControlGroup from "@splunk/react-ui/ControlGroup";
import Multiselect, { Heading } from "@splunk/react-ui/Multiselect";
import Select from "@splunk/react-ui/Select";
import TextArea from "@splunk/react-ui/TextArea";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import ComboBox from "@splunk/react-ui/ComboBox";
import Code from "@splunk/react-ui/Code";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";

import { username } from "@splunk/splunk-utils/config";
import Button from "@splunk/react-ui/Button";

const ConfigWrite = () => {
  const SYSTEM_APP_CONTEXT = { name: "system", label: "System" };
  const SYSTEM_USER_CONTEXT = { name: "nobody", realname: "Nobody" };
  const COMMON_FILES = [
    "props",
    "transforms",
    "eventtypes",
    "inputs",
    "outputs",
    "server",
  ]; //'app', 'authentication', 'authorize', 'collections', 'commands', 'datamodels',  'fields', 'global-banner', 'health', 'indexes', 'limits', 'macros', 'passwords', 'savedsearches', 'serverclass', 'tags', 'web']

  const confString = (entities) =>
    entities.map(([a, v]) => `${a} = ${v}`).join("\n");

  // Selected Data
  const [server, setServer] = useState(localLoad("BADRCM_configwriteserver"));
  const handleServer = wrapSetValue(
    localSave(setServer, "BADRCM_configwriteserver")
  );
  const [app, setApp] = useState(localLoad("BADRCM_configwriteapp"));
  const handleApp = wrapSetValue(localSave(setApp, "BADRCM_configwriteapp"));
  const [user, setUser] = useState(localLoad("BADRCM_configwriteuser"));
  const handleUser = wrapSetValue(localSave(setUser, "BADRCM_configwriteuser"));
  const [file, setFile] = useState(localLoad("BADRCM_configwritefile"));
  const handleFile = wrapSetValue(localSave(setFile, "BADRCM_configwritefile"));
  const [stanza, setStanza] = useState(
    localLoad("BADRCM_configwritestanza", "")
  );
  const handleStanza = wrapSetValue(
    localSave(setStanza, "BADRCM_configwritestanza")
  );

  // Loaded Data
  const [serveroptions, setServerOptions] = useState([]);
  const [servercontext, setServerContext] = useState();
  const [config, setConfig] = useState(Map());
  const [stanzaOptions, setStanzaOptions] = useState([]);

  const [error, setError] = useState(false);
  const [loading, setLoading] = useReducer((prev, change) => prev + change, 0);

  const [input, setInput] = useState("");
  const handleInput = wrapSetValue(setInput);
  const [inputerror, setInputError] = useState(false);
  const [output, setOutput] = useState([]);
  const [changes, setChanges] = useState();

  // Startup
  useEffect(() => {
    restGet("servers", {}, setServerOptions).then(() => {
      cleanUp();
    });
  }, []);

  // Get Server Contexts
  useEffect(() => {
    if (!server) return; // Requirements not met
    console.log(`EFFECT Get Context for ${server}`);
    setError(false);
    setLoading(1);
    setServerContext(null);
    setConfig(Map());
    restGet(
      "servers",
      { server },
      ([apps, users, files, username, realname, roles]) => {
        for (const [app, [label, visable, version]] of Object.entries(apps)) {
          apps[app] = label;
        }
        for (const [user, [realname, defaultapp]] of Object.entries(users)) {
          users[user] = realname;
        }

        // Check App and User contexts are valid before changing context
        if (
          app &&
          ![...Object.keys(apps), SYSTEM_APP_CONTEXT.name].includes(app)
        ) {
          console.log("Resetting App Context", app, "didnt exist");
          setApp();
          localDel(`BADRCM_configwriteapp`);
        }
        if (
          user &&
          ![...Object.keys(users), SYSTEM_USER_CONTEXT.name].includes(user)
        ) {
          console.log("Resetting User Context", user, "didnt exist");
          setUser();
          localDel(`BADRCM_configwriteuser`);
        }
        if (file && !files.includes(file)) {
          console.log("Resetting File Context", file, "didnt exist");
          setFile();
          localDel(`BADRCM_configwritefile`);
        }

        setServerContext({ apps, users, files });
      }
    ).then(
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

  // Get Config Data
  const debouncedGetConfig = useCallback(
    debounce((server, app, user, file) => {
      console.log(`EFFECT Config`);
      setError(false);
      setLoading(1);

      restGet("configs", { server, app, user, file }, (config) => {
        setConfig(Map(config));
        const stanzas = Object.keys(config[app] || {});
        if (!stanzas.includes(stanza)) {
          console.log("Clearing Stanza");
          setStanza("");
        }
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
    if (server && servercontext && app && user && file)
      debouncedGetConfig(server, app, user, file);
  }, [servercontext, app, user, file]);

  // Process Input
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
          const value = line.slice(x + 1).trim();
          if (x > 0 && attribute.length && value.length) {
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
        setOutput(confString(Object.entries(output)));
      } else {
        setOutput(confString(changes));
      }
    }, 100),
    []
  );
  useEffect(() => {
    // Check requirements are met
    debouncedInput(input, config, app, stanza);
  }, [input, config, app, stanza]);

  const [currentConfig, setCurrentConfig] = useState();
  useEffect(
    () =>
      setCurrentConfig(
        confString(Object.entries(config.getIn([app, stanza, "attr"]) || {}))
      ),
    [config, stanza]
  );

  // Handlers
  const handleWrite = () => {
    setLoading(1);
    return (
      config.hasIn([app, stanza, "attr"])
        ? Promise.resolve()
        : restChange(
            "configs",
            { server, file, user, app, stanza: "" },
            { name: stanza }
          )
    )
      .then(() =>
        restChange("configs", { server, file, user, app, stanza }, changes)
      )
      .then((newdata) => setConfig(config.mergeDeep(newdata)))
      .then(() => {
        setLoading(-1);
      });
  };

  return (
    <ColumnLayout divider="vertical">
      <ColumnLayout.Row>
        <ColumnLayout.Column></ColumnLayout.Column>
        <ColumnLayout.Column>
          <ControlGroup label="Server" labelPosition="left">
            <Select
              inline
              appearance="primary"
              value={server}
              onChange={handleServer}
              animateLoading={serveroptions.length === 0}
              error={!server}
            >
              {serveroptions.map((s) => (
                <Select.Option key={s} label={s} value={s} />
              ))}
            </Select>
          </ControlGroup>
          <ControlGroup label="App" labelPosition="left">
            <Select
              inline
              value={app}
              onChange={handleApp}
              disabled={!server}
              error={!app}
              filter
            >
              <Select.Option
                label={SYSTEM_APP_CONTEXT.label}
                description={SYSTEM_APP_CONTEXT.label}
                value={SYSTEM_APP_CONTEXT.name}
              />
              {servercontext
                ? Object.entries(servercontext.apps).map(([id, label]) => (
                    <Select.Option
                      key={id}
                      label={label}
                      description={id}
                      value={id}
                    />
                  ))
                : null}
            </Select>
          </ControlGroup>
          <ControlGroup label="Owner" labelPosition="left">
            <Select
              inline
              filter
              value={user}
              onChange={handleUser}
              disabled={!server}
              error={!user}
            >
              <Select.Heading>Special</Select.Heading>
              <Select.Option
                label={SYSTEM_USER_CONTEXT.realname}
                description={SYSTEM_USER_CONTEXT.realname}
                value={SYSTEM_USER_CONTEXT.name}
              />
              {servercontext && servercontext.users[username] ? (
                <Select.Option
                  label="Your User"
                  value={username}
                  description={username}
                />
              ) : null}
              <Select.Heading>All Users</Select.Heading>
              {servercontext
                ? Object.entries(servercontext.users).map(([user, real]) => (
                    <Select.Option
                      key={user}
                      label={real}
                      description={user}
                      value={user}
                    />
                  ))
                : null}
            </Select>
          </ControlGroup>
          <ControlGroup label="Conf File" labelPosition="left">
            <Select
              inline
              filter
              value={file}
              onChange={handleFile}
              disabled={!server}
              error={!file}
            >
              <Select.Heading>Common Files</Select.Heading>
              {COMMON_FILES.map((file) => (
                <Multiselect.Option key={file} label={file} value={file} />
              ))}

              <Select.Heading>All Files</Select.Heading>
              {servercontext
                ? servercontext.files
                    .filter((file) => !COMMON_FILES.includes(file))
                    .map((file) => (
                      <Multiselect.Option
                        key={file}
                        label={file}
                        value={file}
                      />
                    ))
                : null}
            </Select>
          </ControlGroup>
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
        </ColumnLayout.Column>
        <ColumnLayout.Column></ColumnLayout.Column>
      </ColumnLayout.Row>
      {server && app && user && file && stanza && config ? (
        <ColumnLayout.Row>
          <ColumnLayout.Column>
            <Heading level={3}>Current</Heading>
            <StanzaSpan>[{stanza}]</StanzaSpan>
            <TextArea value={currentConfig} rowsMin={5} rowsMax={25}></TextArea>
          </ColumnLayout.Column>
          <ColumnLayout.Column>
            <Heading level={3}>Changes</Heading>
            <StanzaSpan>[{stanza}]</StanzaSpan>
            <TextArea
              placeholder="attribute = value"
              onChange={handleInput}
              value={input}
              canClear
              rowsMin={5}
              rowsMax={25}
              error={inputerror}
            ></TextArea>
            <br />
            <Button
              inline
              label={loading ? <WaitSpinner /> : "Write Changes"}
              appearance="primary"
              onClick={handleWrite}
              disabled={!!loading || error || !config}
            />
          </ColumnLayout.Column>
          <ColumnLayout.Column>
            <Heading level={3}>Preview</Heading>
            <StanzaSpan>[{stanza}]</StanzaSpan>
            <TextArea value={output} rowsMin={5} rowsMax={25}></TextArea>
          </ColumnLayout.Column>
        </ColumnLayout.Row>
      ) : null}
    </ColumnLayout>
  );
};

Page(
  <StyledContainer>
    <ConfigWrite />
  </StyledContainer>
);
