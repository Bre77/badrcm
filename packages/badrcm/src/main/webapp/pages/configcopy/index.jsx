/* eslint-disable */
import React, { useState, useEffect, useReducer, useCallback } from "react";
import { Map, Set } from "immutable";

import Page from "../../shared/page";
import { StyledContainer } from "./Styles";
import { isort, isort0, tupleSplit, wrapSetValues, wrapSetValue, localLoad, localSave, localDel } from "../../shared/helpers";
import { restGet, restChange, cleanUp } from "../../shared/fetch";
import { DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT, COMMON_FILES } from "../../shared/const";

import ComboBox from "@splunk/react-ui/ComboBox";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import Multiselect from "@splunk/react-ui/Multiselect";
import Select from "@splunk/react-ui/Select";
import Table from "@splunk/react-ui/Table";

const ConfigCopy = () => {
  const COLUMN_INDEX = [0, 1];

  // State - Page Selectors
  const [filefilter, setFileFilter] = useState(localLoad("BADRCM_copyfilefilter", ["props", "transforms"])); //
  const handleFileFilter = wrapSetValues(localSave(setFileFilter, "BADRCM_copyfilefilter"));
  const [appfilter, setAppFilter] = useState(localLoad("BADRCM_copyappfilter", ["search"]));
  const handleAppFilter = wrapSetValues(localSave(setAppFilter, "BADRCM_copyappfilter"));

  const [fileoptions, setFileOptions] = useState(Set());
  const [appoptions, setAppOptions] = useState(Map());

  // State - Column Selector
  const [server, setServer] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_copyserver${z}`))));
  const handleServer = setServer.map((f, z) => wrapSetValue(localSave(f, `BADRCM_copyserver${z}`)));
  const [appcontext, setAppContext] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_copyappcontext${z}`, DEFAULT_APP_CONTEXT.name))));
  const handleAppContext = setAppContext.map((f, z) => wrapSetValue(localSave(f, `BADRCM_copyappcontext${z}`)));
  const [usercontext, setUserContext] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_copyusercontext${z}`, SYSTEM_USER_CONTEXT.name))));
  const handleUserContext = setUserContext.map((f, z) => wrapSetValue(localSave(f, `BADRCM_copyusercontext${z}`)));
  const [error, setError] = tupleSplit(COLUMN_INDEX.map(() => useState(false)));
  const [loading, setLoading] = tupleSplit(COLUMN_INDEX.map(() => useReducer((prev, change) => prev + change, 0)));

  const [serveroptions, setServerOptions] = useState([]);
  const [servercontext, setServerContext] = tupleSplit(COLUMN_INDEX.map(() => useState()));
  const [serverconfig, setServerConfig] = tupleSplit(COLUMN_INDEX.map(() => useReducer((prev, add) => ({ ...prev, ...add }))));

  const [mergedconfig, setMergedConfig] = useState([]);

  // Startup
  useEffect(() => {
    restGet("servers", {}, setServerOptions).then(() => {
      cleanUp();
    });
  }, []);

  // Server Selector
  server.map((s, z) => {
    useEffect(() => {
      if (!s) return; // Requirements not met
      console.log(`EFFECT Context of ${s} for ${z}`);
      setError[z](false);
      setLoading[z](1);
      setServerContext[z](null);
      setServerConfig[z](Map());
      restGet("servers", { server: s }, ([apps, users, files]) => {
        //username, realname, roles
        for (const [app, [label]] of Object.entries(apps)) {
          apps[app] = label;
        }
        for (const [user, [realname]] of Object.entries(users)) {
          users[user] = realname;
        }

        // Check App and User contexts are valid before changing context
        if (![...Object.keys(apps), DEFAULT_APP_CONTEXT.name, SYSTEM_APP_CONTEXT.name].includes(appcontext[z])) {
          console.log("Resetting App Context", z, appcontext[z], "didnt exist");
          setAppContext[z](DEFAULT_APP_CONTEXT.name);
          localDel(`BADRCM_copyappcontext${z}`);
        }
        if (![...Object.keys(users), SYSTEM_USER_CONTEXT.name].includes(usercontext[z])) {
          console.log("Resetting User Context", z, usercontext[z], "didnt exist");
          setUserContext[z](SYSTEM_USER_CONTEXT.name);
          localDel(`BADRCM_copyusercontext${z}`);
        }

        setServerContext[z]({ apps, users, files });
      }).then(
        () => {
          setLoading[z](-1);
        },
        (e) => {
          setError[z](true);
          setLoading[z](-1);
        }
      );
    }, [s]);
  });

  // Get Config Data
  COLUMN_INDEX.map((z) => {
    const debouncedGetConfig = useCallback(
      debounce((filefilter, z, server, appcontext, usercontext) => {
        console.log(`EFFECT Configs for ${z}`);
        setError[z](false);
        setLoading[z](1);

        filefilter.map((file) => {
          restGet(
            "configs",
            {
              server: server[z],
              app: appcontext[z],
              user: usercontext[z],
              file: file,
            },
            (config) => setServerConfig[z]((prev) => prev.merge({ [file]: config }))
          ).then(
            () => setLoading[z](-1),
            (e) => {
              setError[z](true);
              setLoading[z](-1);
              console.warn(e);
            }
          );
        });
      }, 500),
      []
    );
    useEffect(() => {
      // Check requirements are met
      if (server[z] && appcontext[z] && usercontext[z]) debouncedGetConfig(filefilter, z, server, appcontext, usercontext);
    }, [servercontext[z], appcontext[z], usercontext[z], filefilter]);
  });


  // Get Config keys
  useEffect(() => {
    console.log("EFFECT Config Keys");
    const configdict = serverconfig

      .filter((config) => config)
      .reduce((output, input) => {
        for (const [file, apps] of Object.entries(input)) {
          for (const [app, stanzas] of Object.entries(apps)) {
            if (!output[app]) output[app] = { [file]: {} };
            else if (!output[app][file]) output[app][file] = {};
            for (const [stanza, content] of Object.entries(stanzas)) {
              if (!output[app][file][stanza]) output[app][file][stanza] = new Set(Object.keys(content.attr));
              else Object.keys(content.attr).forEach((attr) => output[app][file][stanza].add(attr));
            }
          }
        }
        return output;
      }, {});

    const configarray = Object.entries(configdict)
      .sort(isort0)
      .map(([file, apps]) => {
        return [
          file,
          Object.entries(apps)
            .sort(isort0)
            .map(([app, stanzas]) => {
              return [
                app,
                Object.entries(stanzas)
                  .sort(isort0)
                  .map(([stanza, content]) => {
                    return [stanza, Array.from(content).sort(isort)];
                  }),
              ];
            }),
        ];
      });
    setMergedConfig(configarray);
  }, [...serverconfig]);


  // Methods

  const getConfigRows = (app, file, stanzas) => {
    return stanzas.flatMap(([stanza, attributes]) => [
      <Table.Row key={app + file + stanza} onRequestToggle={tick}>
        <Table.Cell align="right" truncate className="conf-stanza">
          [{stanza.substring(0, 30)}]
        </Table.Cell>
        {servercontext.map((context, z) => (
          <Table.Cell key={z}>ACLS GO HERE</Table.Cell>
        ))}
      </Table.Row>,
      ...attributes.map((attribute) => (
        <Table.Row key={app + file + stanza + attribute} onRequestToggle={tick}>
          <Table.Cell align="right" truncate className="conf-attribute">
            {attribute}
          </Table.Cell>
          {serverconfig.map((d, z) => (
            <Table.Cell key={z} className="conf-value">
              {check(d, [file, app, stanza, "attr", attribute]) ? (
                typeof d[file][app][stanza].attr[attribute] === "boolean" ? (
                  <Switch appearance="toggle" value={d[file][app][stanza].attr[attribute]} />
                ) : (
                  <Text value={d[file][app][stanza].attr[attribute]} />
                )
              ) : (
                <Text />
              )}
            </Table.Cell>
          ))}
        </Table.Row>
      )),
    ]);
  };

  const tick = (data) => {};

  return (
    <>
      <ColumnLayout divider="vertical">
        <ColumnLayout.Row>
        <ColumnLayout.Column>
              <ControlGroup label="Source Server" labelPosition="left">
                <Select inline appearance="primary" value={server[0]} onChange={handleServer[0]} error={!server[0]}>
                  {serveroptions.map((s) => (
                    <Select.Option key={s} label={s} value={s} />
                  ))}
                </Select>
              </ControlGroup>
              <ControlGroup label="Source App Context" labelPosition="left">
                <Select inline value={appcontext[0]} onChange={handleAppContext[0]} disabled={!server[0]} animateLoading={!servercontext[0]}>
                  <Select.Option label="All" value="-" />
                  <Select.Option label="None" description="system" value="system" />
                  {servercontext[0]
                    ? Object.entries(servercontext[z].apps).map(([id, label]) => <Select.Option key={id} label={label} description={id} value={id} />)
                    : null}
                </Select>
              </ControlGroup>
              <ControlGroup label="Source User Context" labelPosition="left">
                <Select inline value={usercontext[0]} onChange={handleUserContext[0]} disabled={!server[0]} animateLoading={!servercontext[0]}>
                  <Select.Option label="Nobody" value="nobody" />
                  {servercontext[0]
                    ? Object.entries(servercontext[0].users).map(([user, real]) => <Select.Option key={user} label={real} description={user} value={user} />)
                    : null}
                </Select>
              </ControlGroup>
            </ColumnLayout.Column>
          <ColumnLayout.Column>
            <ControlGroup label="Config Files" labelPosition="left">
              <Multiselect
                inline
                values={filefilter}
                onChange={handleFileFilter}
                placeholder={`All ${fileoptions.size} files`}
                allowKeyMatching={true}
              >
                <Select.Heading>Common Files</Select.Heading>
                {COMMON_FILES.map((file) => (
                  <Multiselect.Option key={file} label={file} value={file} />
                ))}

                <Select.Heading>All Files</Select.Heading>
                {servercontext[0] && servercontext[0].apps.map((file) => (
                  <Multiselect.Option key={file} label={file} value={file} />
                ))}
              </Multiselect>
            </ControlGroup>
            <ControlGroup label="Apps" labelPosition="left">
              <Multiselect
                inline
                values={appfilter}
                onChange={handleAppFilter}
                placeholder={`All ${appoptions.size} apps`}
                allowKeyMatching={true}
                noOptionsMessage="Select at least one server first"
              >
                {appoptions.map((label, id) => <Multiselect.Option key={id} label={label} value={id} />).toList()}
              </Multiselect>
            </ControlGroup>
          </ColumnLayout.Column>
          {COLUMN_INDEX.map((z) => (
            <ColumnLayout.Column key={z}>
              <ControlGroup label="Server" labelPosition="left">
                <Select inline appearance="primary" value={server[z]} onChange={handleServer[z]} error={!server[z]}>
                  {serveroptions.map((s) => (
                    <Select.Option key={s} label={s} value={s} />
                  ))}
                </Select>
              </ControlGroup>
              <ControlGroup label="App Context" labelPosition="left">
                <Select inline value={appcontext[z]} onChange={handleAppContext[z]} disabled={!server[z]} animateLoading={!servercontext[z]}>
                  <Select.Option label="All" value="-" />
                  <Select.Option label="None" description="system" value="system" />
                  {servercontext[z]
                    ? Object.entries(servercontext[z].apps).map(([id, { label }]) => <Select.Option key={id} label={label} description={id} value={id} />)
                    : null}
                </Select>
              </ControlGroup>
              <ControlGroup label="User Context" labelPosition="left">
                <Select inline value={usercontext[z]} onChange={handleUserContext[z]} disabled={!server[z]} animateLoading={!servercontext[z]}>
                  <Select.Option label="Nobody" value="nobody" />
                  {servercontext[z]
                    ? Object.entries(servercontext[z].users).map(([user, real]) => <Select.Option key={user} label={real} description={user} value={user} />)
                    : null}
                </Select>
              </ControlGroup>
            </ColumnLayout.Column>
          ))}
        </ColumnLayout.Row>
      </ColumnLayout>
    </>
  );
};

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
    const errorEl = document.createElement("span");
    errorEl.innerHTML = e;
    document.body.appendChild(errorEl);
  });
