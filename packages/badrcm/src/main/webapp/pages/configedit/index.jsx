/* eslint-disable */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-array-index-key */
/* eslint-disable no-nested-ternary */

import React, { useState, useEffect, useReducer, useCallback } from "react";
import debounce from "lodash.debounce";
import { Map, Set } from "immutable";

import Page from "../../shared/page";
import { StyledContainer, ShortCell, TallCell, StanzaSpan, AttributeSpan, CreateLink } from "../../shared/styles";
import { isort, isort0, tupleSplit, wrapSetValues, wrapSetValue, localLoad, localSave, localDel } from "../../shared/helpers";
import { restGet, restChange, cleanUp } from "../../shared/fetch";
import { DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT, COMMON_FILES } from "../../shared/const";

import ControlGroup from "@splunk/react-ui/ControlGroup";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import Number from "@splunk/react-ui/Number";
import Multiselect from "@splunk/react-ui/Multiselect";
import Select from "@splunk/react-ui/Select";
import Switch from "@splunk/react-ui/Switch";
import Text from "@splunk/react-ui/Text";
import Table from "@splunk/react-ui/Table";

import Globe from "@splunk/react-icons/Globe";
import Dashboard from "@splunk/react-icons/Dashboard";
import User from "@splunk/react-icons/User";

const ConfigEdit = () => {
  // Constants
  const MAX_COLUMNS = 4;
  const COLUMN_INDEX = Array(MAX_COLUMNS)
    .fill()
    .map((_, i) => i);

  // State - Page Selectors
  const [filefilter, setFileFilter] = useState(localLoad("BADRCM_editfilefilter", ["props", "transforms"])); //
  const handleFileFilter = wrapSetValues(localSave(setFileFilter, "BADRCM_editfilefilter"));
  const [appfilter, setAppFilter] = useState(localLoad("BADRCM_editappfilter", ["search"]));
  const handleAppFilter = wrapSetValues(localSave(setAppFilter, "BADRCM_editappfilter"));
  const [columncount, setColumnCount] = useState(localLoad("BADRCM_editcolumncount", 2));
  const handleColumnCount = wrapSetValue(localSave(setColumnCount, "BADRCM_editcolumncount"));

  const [fileoptions, setFileOptions] = useState(Set());
  const [appoptions, setAppOptions] = useState(Map());

  // State - Column Selector
  const [server, setServer] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_editserver${z}`))));
  const handleServer = setServer.map((f, z) => wrapSetValue(localSave(f, `BADRCM_editserver${z}`)));
  const [appcontext, setAppContext] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_editappcontext${z}`, DEFAULT_APP_CONTEXT.name))));
  const handleAppContext = setAppContext.map((f, z) => wrapSetValue(localSave(f, `BADRCM_editappcontext${z}`)));
  const [usercontext, setUserContext] = tupleSplit(COLUMN_INDEX.map((z) => useState(localLoad(`BADRCM_editusercontext${z}`, SYSTEM_USER_CONTEXT.name))));
  const handleUserContext = setUserContext.map((f, z) => wrapSetValue(localSave(f, `BADRCM_editusercontext${z}`)));
  const [error, setError] = tupleSplit(COLUMN_INDEX.map(() => useState(false)));
  const [loading, setLoading] = tupleSplit(COLUMN_INDEX.map(() => useReducer((prev, change) => prev + change, 0)));
  // const handleLoading = setLoading.map(wrapSetValue)

  const [serveroptions, setServerOptions] = useState([]);
  const [servercontext, setServerContext] = tupleSplit(COLUMN_INDEX.map(() => useState()));
  const [serverconfig, setServerConfig] = tupleSplit(COLUMN_INDEX.map(() => useState(Map())));

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
      restGet("servers", { server: s }, ([apps, users, files, username, realname, roles]) => {
        //
        for (const [app, [label, _, version]] of Object.entries(apps)) {
          apps[app] = {
            label: label,
            //visable: Boolean(visable),
            version: version,
          };
        }
        for (const [user, [realname]] of Object.entries(users)) {
          users[user] = realname;
        }

        // Check App and User contexts are valid before changing context
        if (![...Object.keys(apps), DEFAULT_APP_CONTEXT.name, SYSTEM_APP_CONTEXT.name].includes(appcontext[z])) {
          console.log("Resetting App Context", z, appcontext[z], "didnt exist");
          setAppContext[z](DEFAULT_APP_CONTEXT.name);
          localDel(`BADRCM_editappcontext${z}`);
        }
        if (![...Object.keys(users), SYSTEM_USER_CONTEXT.name].includes(usercontext[z])) {
          console.log("Resetting User Context", z, usercontext[z], "didnt exist");
          setUserContext[z](SYSTEM_USER_CONTEXT.name);
          localDel(`BADRCM_editusercontext${z}`);
        }

        const user_options = Object.entries(users).map(([user, real]) => <Select.Option key={user} label={real} description={user} value={user} />);

        setServerContext[z]({ apps, users, files, username, realname, roles, user_options });
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
      }, 100),
      []
    );
    useEffect(() => {
      // Check requirements are met
      if (server[z] && appcontext[z] && usercontext[z]) debouncedGetConfig(filefilter, z, server, appcontext, usercontext);
    }, [servercontext[z], appcontext[z], usercontext[z], filefilter]);
  });

  // Get Filter Lists
  const debouncedFilterOptions = useCallback(
    debounce((servercontext, columncount) => {
      console.log("EFFECT Filter Options", serverconfig);
      const files = Set(
        servercontext
          .slice(0, columncount)
          .filter((context) => context)
          .flatMap((context) => context.files)
          .filter((file) => !COMMON_FILES.includes(file))
      ).sort(isort);

      const apps = Map(
        servercontext
          .slice(0, columncount)
          .filter((context) => context)
          .flatMap((context) => Object.entries(context.apps))
          .reduce(
            (apps, [name, { label }]) => {
              if (!apps[name]) {
                apps[name] = label;
              } else if (!apps[name].includes(label)) {
                apps[name] = `${apps[name]} / ${label}`;
              }
              return apps;
            },
            { [SYSTEM_APP_CONTEXT.name]: SYSTEM_APP_CONTEXT.label }
          )
      ).sort(isort);

      setFileOptions(files);
      setAppOptions(apps);
    }, 100),
    []
  );
  useEffect(() => {
    debouncedFilterOptions(servercontext, columncount);
  }, [...servercontext, columncount]);

  // Get Config keys
  const debouncedServerContext = useCallback(
    debounce((serverconfig, columncount) => {
      console.log("EFFECT Config Keys", serverconfig);
      const configdict = serverconfig
        .slice(0, columncount)
        .filter((config) => config)
        .reduce((output, input) => {
          for (const [file, apps] of input.entries()) {
            for (const [app, stanzas] of Object.entries(apps)) {
              if (!output[app]) output[app] = { [file]: {} };
              else if (!output[app][file]) output[app][file] = {};
              for (const [stanza, content] of Object.entries(stanzas)) {
                if (!output[app][file][stanza]) output[app][file][stanza] = { acl: {}, attr: {} };
                for (const [attr, value] of Object.entries(content.attr)) {
                  if (!output[app][file][stanza].attr[attr]) output[app][file][stanza].attr[attr] = [value];
                  else output[app][file][stanza].attr[attr].push(value);
                }
                for (const [attr, value] of Object.entries(content.acl)) {
                  if (!output[app][file][stanza].acl[attr]) output[app][file][stanza].acl[attr] = [value];
                  else output[app][file][stanza].acl[attr].push(value);
                }
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
                    .map(([stanza, { attr, acl }]) => {
                      return [
                        stanza,
                        {
                          attr: Object.entries(attr)
                            .sort(isort0)
                            .map(([attribute, values]) => {
                              return [
                                attribute,
                                {
                                  // Use boolean only if all values are boolean
                                  text: values.some((value) => typeof value !== "boolean"),
                                  // 0 if different, 1 if only one value, 2 if all the same
                                  same: values.every((value, _, values) => value == values[0]),
                                },
                              ];
                            }),
                          acl: {
                            sharing: acl.sharing.every((value, _, values) => value == values[0]),
                            owner: acl.owner.every((value, _, values) => value == values[0]),
                            readers: acl.readers.every((array, _, arrays) => {
                              array.length == arrays[0].length && array.every((value) => arrays[0].includes(value));
                            }),
                            writers: acl.writers.every((array, _, arrays) => {
                              array.length == arrays[0].length && array.every((value) => arrays[0].includes(value));
                            }),
                          },
                        },
                      ];
                    }),
                ];
              }),
          ];
        });
      setMergedConfig(configarray);
    }, 100),
    []
  );
  useEffect(() => {
    debouncedServerContext(serverconfig, columncount);
  }, [...serverconfig, columncount]);

  // Handlers
  const check = (obj, path) => {
    try {
      return path.reduce((parent, child) => parent[child], obj) !== undefined;
    } catch (e) {
      //console.warn(e)
      return false;
    }
  };

  // Methods

  const handleConfigChangeFactory = (z, file, app, stanza, key, fixedvalue) => (inputvalue) => {
    restChange("configs", { server: server[z], file, user: usercontext[z], app, stanza }, { [key]: fixedvalue || inputvalue }).then((config) =>
      setServerConfig[z]((prev) => prev.mergeIn([file, app, stanza], config[app][stanza]))
    );
  };

  const handleAclChangeFactory =
    (z, file, app, stanza, key) =>
    (_, { value, values }) => {
      console.log("ACL", z, file, app, stanza, key, value || values);
      const current = serverconfig[z].getIn([file, app, stanza, "acl"]);
      return restChange(
        "acl",
        { server: server[z], file, user: usercontext[z], app, stanza },
        { sharing: current.sharing, owner: current.owner, "perms.read": current.readers, "perms.write": current.writers, [key]: value || values }
      ).then((acls) => {
        setServerConfig[z]((prev) => {
          console.log(prev, file, app, stanza, "acl", acls);
          return prev.setIn([file, app, stanza, "acl"], acls);
        });
      });
    };

  // Table Expansion
  const getConfigRows = (app, file, stanza, attributes, acls) => [
    <Table.Row key={`${app}|${file}|${stanza}|sharing`}>
      <TallCell align="right">Sharing</TallCell>

      {serverconfig.slice(0, columncount).map((config, z) => {
        const acl = config.getIn([file, app, stanza, "acl"]);
        return acl ? (
          <ShortCell key={z}>
            <Select inline disabled={!acl.change} value={acl.sharing} onChange={handleAclChangeFactory(z, file, app, stanza, "sharing")} error={!acls.sharing}>
              <Select.Option disabled={!acl.share[0]} label="Global" value="global" icon={<Globe />} />
              <Select.Option disabled={!acl.share[1]} label="App" value="app" icon={<Dashboard />} />
              <Select.Option disabled={!acl.share[2]} label="Private" value="private" icon={<User />} />
            </Select>
          </ShortCell>
        ) : (
          <ShortCell key={z}></ShortCell>
        );
      })}
    </Table.Row>,
    <Table.Row key={`${app}|${file}|${stanza}|owner`}>
      <TallCell align="right">Owner</TallCell>
      {serverconfig.slice(0, columncount).map((config, z) => {
        const acl = config.getIn([file, app, stanza, "acl"]);
        return acl && servercontext[z] ? (
          <ShortCell key={z}>
            <Select inline disabled={!acl.change} value={acl.owner} onChange={handleAclChangeFactory(z, file, app, stanza, "owner")} error={!acls.owner}>
              <Select.Option label="Nobody" value="nobody" />
              {servercontext[z].user_options}
            </Select>
          </ShortCell>
        ) : (
          <ShortCell key={z}></ShortCell>
        );
      })}
    </Table.Row>,
    <Table.Row key={`${app}|${file}|${stanza}|readers`}>
      <TallCell align="right">Read Roles</TallCell>

      {serverconfig.slice(0, columncount).map((config, z) => {
        const acl = config.getIn([file, app, stanza, "acl"]);
        return acl && servercontext[z] ? (
          <ShortCell key={z}>
            <Multiselect
              disabled={!acl.change}
              values={acl.readers}
              onChange={handleAclChangeFactory(z, file, app, stanza, "perms.read")}
              error={!acls.readers}
            >
              <Multiselect.Option label="Everyone" value="*" />
              {servercontext[z].roles.map((role) => (
                <Multiselect.Option key={role} label={role} value={role} />
              ))}
            </Multiselect>
          </ShortCell>
        ) : (
          <ShortCell key={z}></ShortCell>
        );
      })}
    </Table.Row>,
    <Table.Row key={`${app}|${file}|${stanza}|writers`}>
      <TallCell align="right">Write Roles</TallCell>
      {serverconfig.slice(0, columncount).map((config, z) => {
        const acl = config.getIn([file, app, stanza, "acl"]);
        return acl && servercontext[z] ? (
          <ShortCell key={z}>
            <Multiselect
              disabled={!acl.change}
              values={acl.writers}
              onChange={handleAclChangeFactory(z, file, app, stanza, "perms.write")}
              error={!acls.writers}
            >
              <Multiselect.Option label="Everyone" value="*" />
              {servercontext[z].roles.map((role) => (
                <Multiselect.Option key={role} label={role} value={role} />
              ))}
            </Multiselect>
          </ShortCell>
        ) : (
          <ShortCell key={z}></ShortCell>
        );
      })}
    </Table.Row>,
    <Table.Row key={`${app}|${file}|${stanza}|break`}>
      <Table.Cell></Table.Cell>
      {COLUMN_INDEX.slice(0, columncount).map((z) => (
        <Table.Cell key={z}></Table.Cell>
      ))}
    </Table.Row>,
    ...attributes.map(([attribute, metadata]) => (
      <Table.Row key={`${app}|${file}|${stanza}|attribute`}>
        <TallCell align="right" truncate>
          <AttributeSpan>{attribute}</AttributeSpan>
        </TallCell>
        {serverconfig.slice(0, columncount).map((config, z) => {
          if (!server[z] || !config.hasIn([file, app, stanza])) return <TallCell key={z}></TallCell>;
          const value = config.getIn([file, app, stanza, "attr", attribute]);
          if (value === undefined)
            return (
              <TallCell key={z}>
                <CreateLink onClick={handleConfigChangeFactory(z, file, app, stanza, attribute, metadata.text ? "" : "false")}>Create Attribute</CreateLink>
              </TallCell>
            );
          return (
            <ConfigInput
              key={z}
              value={value}
              metadata={metadata}
              disabled={!config.getIn([file, app, stanza, "acl", "write"])}
              handle={handleConfigChangeFactory(z, file, app, stanza, attribute)}
            />
          );
        })}
      </Table.Row>
    )),
  ];

  //icon={(<img width="20" src={`${splunkdPath}/servicesNS/${username}/${name}/static/appIconAlt.png`} />)}
  return (
    <>
      <ColumnLayout divider="vertical">
        <ColumnLayout.Row>
          <ColumnLayout.Column>
            <ControlGroup label="Config Files" labelPosition="left">
              <Multiselect inline values={filefilter} onChange={handleFileFilter} placeholder={`All ${fileoptions.size} files`}>
                <Select.Heading>Common Files</Select.Heading>
                {COMMON_FILES.map((file) => (
                  <Multiselect.Option key={file} label={file} value={file} />
                ))}

                <Select.Heading>All Files</Select.Heading>
                {fileoptions.map((file) => (
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
                noOptionsMessage="Select at least one server first"
              >
                {appoptions.map((label, id) => <Multiselect.Option key={id} label={label} value={id} />).toList()}
              </Multiselect>
            </ControlGroup>
            <ControlGroup label="Columns" labelPosition="left">
              <Number inline value={columncount} onChange={handleColumnCount} min={1} max={MAX_COLUMNS}></Number>
            </ControlGroup>
          </ColumnLayout.Column>
          {COLUMN_INDEX.slice(0, columncount).map((z) => (
            <ColumnLayout.Column key={z}>
              <ControlGroup label="Server" labelPosition="left">
                <Select
                  inline
                  appearance="primary"
                  value={server[z]}
                  onChange={handleServer[z]}
                  animateLoading={serveroptions.length === 0}
                  error={!server[z] || error[z]}
                >
                  {serveroptions.map((s) => (
                    <Select.Option key={s} label={s} value={s} />
                  ))}
                  <Select.Divider />
                  <Select.Option label="None" value="" />
                </Select>
              </ControlGroup>
              <ControlGroup label="App Context" labelPosition="left" tooltip="Changes which app shared config is shown">
                <Select
                  inline
                  value={appcontext[z]}
                  onChange={handleAppContext[z]}
                  disabled={!server[z]}
                  animateLoading={loading[z] > 0}
                  error={error[z]}
                  filter
                >
                  <Select.Heading>Special</Select.Heading>
                  <Select.Option label="All Apps" value={DEFAULT_APP_CONTEXT.name} />
                  <Select.Option label="None / Global Only" description="system" value={SYSTEM_APP_CONTEXT.name} />
                  <Select.Heading>Apps</Select.Heading>
                  {servercontext[z] &&
                    Object.entries(servercontext[z].apps).map(([id, { label }]) => <Select.Option key={id} label={label} description={id} value={id} />)}
                </Select>
              </ControlGroup>
              <ControlGroup
                label="User Context"
                labelPosition="left"
                tooltip="Changes which user private config is shown, and which user will own any created config"
              >
                <Select
                  inline
                  value={usercontext[z]}
                  onChange={handleUserContext[z]}
                  disabled={!server[z]}
                  animateLoading={loading[z] > 0}
                  error={error[z]}
                  filter
                >
                  <Select.Heading>Special</Select.Heading>
                  <Select.Option label="No Private Config" description="nobody" value={SYSTEM_USER_CONTEXT.name} />
                  {servercontext[z] && (
                    <Select.Option
                      label={`${servercontext[z].realname} (Auth Token User)`}
                      value={servercontext[z].username}
                      description={servercontext[z].username}
                    />
                  )}
                  <Select.Heading>All Users</Select.Heading>
                  {servercontext[z] && servercontext[z].user_options}
                </Select>
              </ControlGroup>
            </ColumnLayout.Column>
          ))}
        </ColumnLayout.Row>
      </ColumnLayout>
      <br />
      <Table stripeRows rowExpansion="multi">
        <Table.Head>
          <Table.HeadCell>Config Editor</Table.HeadCell>
          {server.slice(0, columncount).map((servername, z) => (
            <Table.HeadCell key={z}>{servername || "No Server Selected"}</Table.HeadCell>
          ))}
        </Table.Head>
        <Table.Body>
          {mergedconfig
            .filter(([app]) => appfilter.length === 0 || appfilter.includes(app))
            .flatMap(([app, files]) =>
              files
                .filter(([file]) => filefilter.length === 0 || filefilter.includes(file))
                .map(([file, stanzas]) => [
                  // App File Row
                  <Table.Row key={`${app}|${file}`}>
                    <Table.Cell>
                      <b>
                        {app} / {file}.conf
                      </b>
                    </Table.Cell>
                    {servercontext.slice(0, columncount).map((context, z) => {
                      if (!server[z] || !context || !context.apps[app]) return <Table.Cell key={z}></Table.Cell>;
                      return (
                        <Table.Cell key={z}>
                          {context.apps[app].label} {context.apps[app].version}
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>,
                  ...stanzas.map(
                    (
                      [stanza, { attr, acl }] // Stanza Row with expansion
                    ) => (
                      <Table.Row key={`${app}|${file}|${stanza}`} expansionRow={getConfigRows(app, file, stanza, attr, acl)}>
                        <ShortCell align="right" truncate>
                          <StanzaSpan>[{stanza.substring(0, 30)}]</StanzaSpan>
                        </ShortCell>
                        {serverconfig.slice(0, columncount).map((config, z) => {
                          if (!server[z] || !check(servercontext[z], ["apps", app])) return <ShortCell key={z}></ShortCell>;
                          const content = config.getIn([file, app, stanza]);
                          if (content === undefined)
                            return (
                              <Table.Cell key={z}>
                                <CreateLink onClick={handleConfigChangeFactory(z, file, app, "", "name", stanza)}>Create Stanza</CreateLink>
                              </Table.Cell>
                            );
                          return (
                            <Table.Cell key={z}>
                              <i>
                                {Object.keys(content.attr).length} attributes in {content.acl.sharing} scope
                              </i>
                            </Table.Cell>
                          );
                        })}
                      </Table.Row>
                    )
                  ),
                ])
            )}
        </Table.Body>
      </Table>
    </>
  );
};

const ConfigInput = ({ value, handle, disabled, metadata }) => {
  const [internalvalue, setInternalValue] = useState(value); //
  const deboundedHandle = useCallback(debounce(handle, 1000), []);
  const inputHandle = (e, { value }) => {
    setInternalValue(value);
    deboundedHandle(value);
  };

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  if (metadata.text)
    return (
      <ShortCell>
        <Text value={internalvalue} onChange={inputHandle} disabled={disabled} error={!metadata.same} />
      </ShortCell>
    );
  else
    return (
      <ShortCell>
        <Switch appearance="toggle" selected={internalvalue} value={!internalvalue} onClick={inputHandle} disabled={disabled} error={!metadata.same} />
      </ShortCell>
    );
};

Page(
  <StyledContainer>
    <ConfigEdit />
  </StyledContainer>
);
