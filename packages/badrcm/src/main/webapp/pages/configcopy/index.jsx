/* eslint-disable */
import { smartTrim } from "@splunk/ui-utils/format";
import { Map, Set } from "immutable";
import debounce from "lodash.debounce";
import React, { useCallback, useEffect, useReducer, useState } from "react";

// Shared
import { COMMON_FILES, DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../../shared/const";
import { restChange, restGet } from "../../shared/fetch";
import { isort, isort0, tupleSplit, useLocal, wrapSetValue, wrapSetValues } from "../../shared/helpers";
import Page from "../../shared/page";
import { AttributeSpan, CreateLink, ShortCell, StanzaSpan, StyledContainer, TallCell } from "../../shared/styles";

// Splunk UI
import Button from "@splunk/react-ui/Button";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Multiselect from "@splunk/react-ui/Multiselect";
import Select from "@splunk/react-ui/Select";
import Switch from "@splunk/react-ui/Switch";
import Table from "@splunk/react-ui/Table";
import Typography from "@splunk/react-ui/Typography";

const ConfigCopy = () => {
  const COLUMN_INDEX = [0, 1];

  // State - Page Selectors
  const [filefilter, setFileFilter] = useLocal("BADRCM_copyfilefilter", ["props", "transforms"]); //
  const handleFileFilter = wrapSetValues(setFileFilter);
  const [appfilter, setAppFilter] = useLocal("BADRCM_copyappfilter", ["search"]);
  const handleAppFilter = wrapSetValues(setAppFilter);

  const [fileoptions, setFileOptions] = useState(Set());
  const [appoptions, setAppOptions] = useState(Map());

  // State - Column Selector
  const [server, setServer] = tupleSplit(COLUMN_INDEX.map((z) => useLocal(`BADRCM_copyserver${z}`)));
  const handleServer = setServer.map((f, z) => wrapSetValue(f));
  const [appcontext, setAppContext] = tupleSplit(COLUMN_INDEX.map((z) => useLocal(`BADRCM_copyappcontext${z}`, DEFAULT_APP_CONTEXT.name)));
  const handleAppContext = setAppContext.map((f, z) => wrapSetValue(f));
  const [usercontext, setUserContext] = tupleSplit(COLUMN_INDEX.map((z) => useLocal(`BADRCM_copyusercontext${z}`, SYSTEM_USER_CONTEXT.name)));
  const handleUserContext = setUserContext.map((f, z) => wrapSetValue(f));
  const [error, setError] = tupleSplit(COLUMN_INDEX.map(() => useState(false)));
  const [loading, setLoading] = tupleSplit(COLUMN_INDEX.map(() => useReducer((prev, change) => prev + change, 0)));

  const [serveroptions, setServerOptions] = useState([]);
  const [servercontext, setServerContext] = tupleSplit(COLUMN_INDEX.map(() => useState()));
  const [serverconfig, setServerConfig] = tupleSplit(COLUMN_INDEX.map(() => useState(Map())));

  const [mergedconfig, setMergedConfig] = useState([]);
  const [selected, setSelected] = useState(Set());

  // Startup
  useEffect(() => {
    restGet("servers", {}, setServerOptions);
    console.log(Set());
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
      restGet("servers", { server: s }, ({ apps, users, files, username, realname }) => {
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
        }
        if (![...Object.keys(users), SYSTEM_USER_CONTEXT.name].includes(usercontext[z])) {
          console.log("Resetting User Context", z, usercontext[z], "didnt exist");
          setUserContext[z](SYSTEM_USER_CONTEXT.name);
        }

        setServerContext[z]({ apps, users, files, username, realname });
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
            (config) => setServerConfig[z]((prev) => prev.merge({ [file]: config })),
            15
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

  // Get Config
  const debouncedServerContext = useCallback(
    debounce((serverconfig, appfilter, filefilter) => {
      console.debug("EFFECT Config Merge");

      const configdict = serverconfig[1].reduce((src, apps, file) => {
        for (const [app, stanzas] of Object.entries(apps)) {
          if (!src[file] || !src[file][app]) continue;
          for (const [stanza, content] of Object.entries(stanzas)) {
            if (!src[file][app][stanza]) src[file][app][stanza] = content;
            else Object.keys(content.attr).forEach((attr) => (src[file][app][stanza].attr[attr] = null));
          }
        }
        return src;
      }, serverconfig[0]);

      //const selects = {};
      const configarray = configdict
        .toArray()
        .filter(([file]) => filefilter.length === 0 || filefilter.includes(file))
        .sort(isort0)
        .flatMap(([file, apps]) => {
          return Object.entries(apps)
            .filter(([app]) => appfilter.length === 0 || appfilter.includes(app))
            .sort(isort0)
            .map(([app, stanzas]) => {
              const key = k([app, file]);
              //selects[key] = selected.get(key, false);
              return [
                [app, file],
                Object.entries(stanzas)
                  .sort(isort0)
                  .map(([stanza, content]) => {
                    const key = k([app, file, stanza]);
                    /*selects[key] = selected.get(key, false);
                    Object.keys(content.attr).forEach((attr) => {
                      const key = k([app, file, stanza, attr]);
                      selects[key] = selected.get(key, false);
                    });*/
                    return [stanza, Object.keys(content.attr).sort(isort)];
                  }),
              ];
            });
        });
      //setSelected((prev) => prev.merge(selects));
      setMergedConfig(configarray);

      //setTicks
    }, 100),
    []
  );
  useEffect(() => {
    if (!serverconfig[0].isEmpty() && !serverconfig[1].isEmpty()) debouncedServerContext(serverconfig, appfilter, filefilter);
  }, [...serverconfig, appfilter, filefilter]);

  // Methods

  /*
  Toggle, set parents to partial 
  parents toggle except partial goes off
  */

  const k = (a) => a.join("|");

  const toggleAttribute = (_, { value, selected }) => {
    console.log(value, selected);
    const [app, file, stanza, attr] = value;
    setSelected((prev) => {
      console.log(prev);
      return selected ? prev.remove(k([app, file, stanza, attr])) : prev.concat([k([app, file, stanza, attr]), k([app, file, stanza]), k([app, file])]);
    });
  };
  const toggleStanza = (_, { value, selected }) => {
    console.log(value, selected);
    const [app, file, stanza] = value;
    setSelected((prev) => {
      console.log(prev);
      return selected
        ? prev.filter((_, key) => !key.startsWith(k([app, file, stanza])))
        : prev.concat([
            k([app, file]),
            k([app, file, stanza]),
            ...Object.keys(serverconfig[0].getIn([file, app, stanza, "attr"])).map((attr) => k([app, file, stanza, attr])),
          ]);
    });
  };
  const toggleParent = (_, { value, selected }) => {
    console.log(value, selected);
    const [app, file] = value;

    setSelected((prev) => {
      console.log(prev);
      return selected
        ? prev.filter((_, key) => !key.startsWith(k([app, file])))
        : prev.merge([
            k([app, file]),
            ...Object.keys(serverconfig[0].getIn([file, app])).flatMap((stanza) => [
              k([app, file, stanza]),
              ...Object.keys(serverconfig[0].getIn([file, app, stanza, "attr"])).map((attr) => k([app, file, stanza, attr])),
            ]),
          ]);
    });
  };

  const getConfigRows = (app, file, stanza, attrs) => {
    return attrs.map((attr) => {
      const src = serverconfig[0].getIn([file, app, stanza, "attr", attr], "");
      const dst = serverconfig[1].getIn([file, app, stanza, "attr", attr], "");
      const key = k([app, file, stanza, attr]);
      const on = selected.has(k([app, file, stanza, attr]));
      return (
        <Table.Row key={key}>
          <TallCell align="right" truncate>
            <AttributeSpan>{attr}</AttributeSpan>
          </TallCell>
          <TallCell truncate>
            <Typography as="p" variant="monoBody">
              {`${src}`}
            </Typography>
          </TallCell>
          <ShortCell>{src !== undefined && <Switch appearance="toggle" onClick={toggleAttribute} value={[app, file, stanza, attr]} selected={on} />}</ShortCell>
          <TallCell truncate>
            <Typography as="p" variant="monoBody">
              {on ? <b>{`${src}`}</b> : `${dst}`}
            </Typography>
          </TallCell>
        </Table.Row>
      );
    });
  };

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
            <ControlGroup label="App Context" labelPosition="left">
              <Select inline value={appcontext[0]} onChange={handleAppContext[0]} disabled={!server[0]} animateLoading={!servercontext[0]}>
                <Select.Heading>General</Select.Heading>
                <Select.Option label="All" description="-" value="-" />
                <Select.Option label="None / Global Only" description="system" value="system" />
                <Select.Heading>Specific App (Not Recommended)</Select.Heading>
                {servercontext[0] &&
                  Object.entries(servercontext[0].apps).map(([id, label]) => <Select.Option key={id} label={label} description={id} value={id} />)}
              </Select>
            </ControlGroup>
            <ControlGroup label="User Context" labelPosition="left">
              <Select inline value={usercontext[0]} onChange={handleUserContext[0]} disabled={!server[0]} animateLoading={!servercontext[0]}>
                <Select.Option label="Nobody" value="nobody" />
                {servercontext[0] &&
                  Object.entries(servercontext[0].users).map(([user, real]) => <Select.Option key={user} label={real} description={user} value={user} />)}
              </Select>
            </ControlGroup>
          </ColumnLayout.Column>
          <ColumnLayout.Column>
            <ControlGroup label="Config Files" labelPosition="left">
              <Multiselect inline values={filefilter} onChange={handleFileFilter} placeholder={`All ${fileoptions.size} files`} allowKeyMatching={true}>
                <Select.Heading>Common Files</Select.Heading>
                {COMMON_FILES.map((file) => (
                  <Multiselect.Option key={file} label={file} value={file} />
                ))}

                <Select.Heading>All Files</Select.Heading>
                {servercontext[0] && servercontext[0].files.map((file) => <Multiselect.Option key={file} label={file} value={file} />)}
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
                {servercontext[0] && Object.entries(servercontext[0].apps).map(([id, label]) => <Multiselect.Option key={id} label={label} value={id} />)}
              </Multiselect>
            </ControlGroup>
          </ColumnLayout.Column>

          <ColumnLayout.Column>
            <ControlGroup label="Destination Server" labelPosition="left">
              <Select inline appearance="primary" value={server[1]} onChange={handleServer[1]} error={!server[1]}>
                {serveroptions.map((s) => (
                  <Select.Option key={s} label={s} value={s} />
                ))}
              </Select>
            </ControlGroup>
            <ControlGroup label="Destination User" labelPosition="left">
              <Select inline value={usercontext[1]} onChange={handleUserContext[1]} disabled={!server[1]} animateLoading={!servercontext[1]}>
                <Select.Option label="Nobody" value="nobody" />
                {servercontext[1]
                  ? Object.entries(servercontext[1].users).map(([user, real]) => <Select.Option key={user} label={real} description={user} value={user} />)
                  : null}
              </Select>
            </ControlGroup>
            <Button apperance="primary" disabled={selected.size === 0}>
              Copy Selected
            </Button>
          </ColumnLayout.Column>
        </ColumnLayout.Row>
      </ColumnLayout>
      <Table stripeRows rowExpansion="multi">
        <Table.Head>
          <Table.HeadCell>Config Copy</Table.HeadCell>
          <Table.HeadCell>Source</Table.HeadCell>
          <Table.HeadCell width={12}></Table.HeadCell>
          <Table.HeadCell>Destination</Table.HeadCell>
        </Table.Head>
        <Table.Body>
          {servercontext[0] &&
            servercontext[1] &&
            mergedconfig.map(([[app, file], stanzas]) => {
              const key = k([app, file]);
              return [
                // App File Row
                <Table.Row key={key}>
                  <Table.Cell>
                    <b>
                      {app} / {file}.conf
                    </b>
                  </Table.Cell>
                  <Table.Cell>{servercontext[0].apps[app].label}</Table.Cell>
                  <ShortCell>
                    <Switch appearance="toggle" onClick={toggleParent} value={[app, file]} selected={selected.has(k([app, file]))} />
                  </ShortCell>
                  <Table.Cell>{servercontext[1].apps[app].label}</Table.Cell>
                </Table.Row>,
                ...stanzas.map(
                  (
                    [stanza, attrs] // Stanza Row with expansion
                  ) => {
                    const key = k([app, file, stanza]);
                    const src = serverconfig[0].getIn([file, app, stanza]);
                    const dst = serverconfig[1].getIn([file, app, stanza]);
                    return (
                      <Table.Row key={key} expansionRow={getConfigRows(app, file, stanza, attrs)}>
                        <TallCell align="right" truncate>
                          <StanzaSpan>[{smartTrim(stanza, 30)}]</StanzaSpan>
                        </TallCell>
                        <TallCell>
                          {src && (
                            <i>
                              {Object.keys(src.attr).length} attributes in {src.acl.sharing} scope
                            </i>
                          )}
                        </TallCell>
                        <ShortCell>
                          <Switch appearance="toggle" onClick={toggleStanza} value={[app, file, stanza]} selected={selected.has(k([app, file, stanza]))} />
                        </ShortCell>
                        <TallCell>
                          {dst && (
                            <i>
                              {Object.keys(dst.attr).length} attributes in {dst.acl.sharing} scope
                            </i>
                          )}
                        </TallCell>
                      </Table.Row>
                    );
                  }
                ),
              ];
            })}
        </Table.Body>
      </Table>
    </>
  );
};

Page(
  <StyledContainer>
    <ConfigCopy />
  </StyledContainer>
);
