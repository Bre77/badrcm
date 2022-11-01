import { Map, Set } from "immutable";
import { debounce, hasIn } from "lodash";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { COLUMN_INDEX, MAX_COLUMNS } from "./const";

// Shared
import { COMMON_FILES, DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../../shared/const";
import { cleanUp, restChange, restGet } from "../../shared/fetch";
import { isort, isort0, localDel, localLoad, localSave, tupleSplit, wrapSetValue, wrapSetValues } from "../../shared/helpers";
import { useServerConfigs, useServerContexts } from "../../shared/hooks";
import { Actions, AttributeSpan, CreateLink, ShortCell, StanzaSpan, StyledContainer, TallCell } from "../../shared/styles";

// Splunk UI
import Dashboard from "@splunk/react-icons/Dashboard";
import Download from "@splunk/react-icons/Download";
import External from "@splunk/react-icons/External";
import Globe from "@splunk/react-icons/Globe";
import Remove from "@splunk/react-icons/Remove";
import User from "@splunk/react-icons/User";
import Warning from "@splunk/react-icons/Warning";
import Button from "@splunk/react-ui/Button";
import Clickable from "@splunk/react-ui/Clickable";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Dropdown from "@splunk/react-ui/Dropdown";
import Multiselect from "@splunk/react-ui/Multiselect";
import Number from "@splunk/react-ui/Number";
import P from "@splunk/react-ui/Paragraph";
import Select from "@splunk/react-ui/Select";
import Switch from "@splunk/react-ui/Switch";
import Table from "@splunk/react-ui/Table";
import Text from "@splunk/react-ui/Text";
import Tooltip from "@splunk/react-ui/Tooltip";

export default ({ apps, files, columns }) => {
  console.log(apps, files, columns);
  const contexts = useServerContexts(columns.map((x) => x.server));
  const configs = useServerConfigs(columns, files);

  console.log(contexts, configs);

  //const [serverconfig, setServerConfig] = tupleSplit(COLUMN_INDEX.map(() => useState(Map())));
  //const [mergedconfig, setMergedConfig] = useState([]);

  const table = useMemo(() => {
    console.log("Expensive Config Table");
    const count = columns.length;
    const x = configs.reduce((x, { data }, y) => {
      if (!data) return x;
      const z = ~~(y / count); // Column Index
      const file = files[y % count]; // File

      return Object.entries(data).reduce((x, [app, stanzas]) => {
        if (!apps.includes(app)) return x;
        const appfile = `${app} / ${file}.conf`;
        x[appfile] ||= { cols: Array(count).fill(), stanzas: {} };

        x[appfile].cols[z] = contexts[z]?.data?.apps?.[app]; // Add app context
        x[appfile].stanzas = Object.entries(stanzas).reduce((x, [stanza, content]) => {
          x[stanza] ||= {
            cols: Array(count).fill(),
            acl: Array(count).fill(),
            attr: {},
          };
          x[stanza].cols[z] = `${Object.keys(content.attr).length} attributes in ${content.acl.sharing} scope`;
          x[stanza].acl[z] = content.acl;
          x[stanza].attr = Object.entries(content.attr).reduce((x, [attr, value]) => {
            x[attr] ||= {
              cols: Array(count).fill(),
              diff: false,
            };
            x[attr].cols[z] = value;
            x[attr].diff ||= !x[attr].cols.includes(value);
            return x;
          }, x[stanza].attr);
          return x;
        }, x[appfile].stanzas);
        return x;
      }, x);
    }, {});

    return Object.entries(x)
      .sort(isort0)
      .map(([parent, { cols, stanzas }]) => [
        parent,
        cols,
        Object.entries(stanzas)
          .sort(isort0)
          .map(([stanza, { cols, acl, attr }]) => [stanza, cols, acl, Object.entries(attr).sort(isort0)]),
      ]);

    /*return Object.entries(x)
      .sort(isort0)
      .map(([parent, { cols, stanzas }]) => ({
        parent,
        cols,
        stanzas: Object.entries(stanzas)
          .sort(isort0)
          .map(([stanza, { cols, acl, attr }]) => ({ stanza, cols, acl, attr: Object.entries(attr).sort(isort0) })),
      }));*/
  }, [contexts, configs]);

  console.log(table);

  // Get Config keys
  /*const debouncedServerContext = useCallback(
    debounce((serverconfig, columncount, appfilter, filefilter) => {
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

      console.log(filefilter);
      console.log(Object.entries(configdict).filter(([file]) => filefilter.length === 0 || filefilter.includes(file)));

      const configarray = Object.entries(configdict)
        .filter(([app]) => appfilter.length === 0 || appfilter.includes(app))
        .sort(isort0)
        .map(([app, files]) => {
          return [
            app,
            Object.entries(files)
              .filter(([file]) => filefilter.length === 0 || filefilter.includes(file))
              .sort(isort0)
              .map(([file, stanzas]) => {
                return [
                  file,
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
    debouncedServerContext(serverconfig, columncount, appfilter, filefilter);
  }, [...serverconfig, columncount, appfilter, filefilter]);

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
              <Select.Option disabled={!acl.share[2]} label="User" value="user" icon={<User />} />
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
    <Table stripeRows rowExpansion="multi">
      <Table.Head>
        <Table.HeadCell>Config Editor</Table.HeadCell>
        {server.slice(0, columncount).map((servername, z) => (
          <Table.HeadCell key={z}>{servername || "No Server Selected"}</Table.HeadCell>
        ))}
      </Table.Head>
      <Table.Body>
        {mergedconfig.flatMap(([app, files]) =>
          files.map(([file, stanzas]) => [
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
                    {context.apps[app].label} {context.apps[app].version}{" "}
                    <Actions>
                      <Tooltip content="Download file contents">
                        <Download />
                      </Tooltip>
                    </Actions>
                  </Table.Cell>
                );
              })}
            </Table.Row>,
            ...stanzas.map(
              (
                [stanza, { attr, acl }] // Stanza Row with expansion
              ) => (
                <Table.Row key={`${app}|${file}|${stanza}`} expansionRow={getConfigRows(app, file, stanza, attr, acl)}>
                  <Table.Cell align="right" truncate>
                    <StanzaSpan>[{stanza.substring(0, 30)}]</StanzaSpan>
                  </Table.Cell>
                  {serverconfig.slice(0, columncount).map((config, z) => {
                    if (!server[z] || !hasIn(servercontext[z], ["apps", app])) return <Table.Cell key={z}></Table.Cell>;
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
                        <StanzaActions server={server[z]} app={app} file={file} stanza={stanza} />
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
  );*/
  return <>{JSON.stringify(table)}</>;
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

const StanzaActions = ({ server, app, file, stanza, appcontext, usercontext, setConfig }) => {
  const [moveopen, setMoveOpen] = useState(false);
  const [deleteopen, setDeleteOpen] = useState(false);

  const move = (
    <Clickable>
      <External screenReaderText="Move" hideDefaultTooltip />
    </Clickable>
  );

  const remove = (
    <Clickable>
      <Remove hideDefaultTooltip />
    </Clickable>
  );

  return (
    <Actions>
      <Tooltip content="Move stanza to another app.">
        <Dropdown toggle={move} retainFocus>
          <StyledContainer>Select App</StyledContainer>
        </Dropdown>
      </Tooltip>
      <Tooltip content="Remove stanza completely.">
        <Dropdown toggle={remove} retainFocus>
          <StyledContainer>
            <Warning size={2} />
            <br />
            <P>Are you sure you want to delete stanza [{stanza}]?</P>
            <Button>Delete</Button>
          </StyledContainer>
        </Dropdown>
      </Tooltip>
    </Actions>
  );
};
