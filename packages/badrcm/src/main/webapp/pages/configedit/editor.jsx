import { smartTrim } from "@splunk/ui-utils/format";
import { debounce, hasIn } from "lodash";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { COLUMN_INDEX, MAX_COLUMNS } from "./const";

// Shared
import { COMMON_FILES, DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../../shared/const";
import { cleanUp, restChange, restGet } from "../../shared/fetch";
import { isort, isort0, latest, localDel, localLoad, localSave, tupleSplit, wrapSetValue, wrapSetValues } from "../../shared/helpers";
import { useConfigs, useContexts } from "../../shared/hooks";
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
  const contexts = useContexts(columns.map((x) => x.server));
  const configs = useConfigs(columns, files);

  const table = useMemo(() => {
    console.debug("Expensive Config Table");
    const count = columns.length;
    const x = configs.reduce((x, { data }, y) => {
      if (!data) return x;
      const z = ~~(y / count); // Column Index
      const file = files[y % count]; // File

      return Object.entries(data).reduce((x, [app, stanzas]) => {
        if (!apps.includes(app)) return x;
        const key = `${app}|${file}`;
        x[key] ||= { app, file, cols: Array(count).fill(), stanzas: {} };

        x[key].cols[z] = contexts[z]?.data?.apps?.[app]; // Add app context
        x[key].stanzas = Object.entries(stanzas).reduce((x, [stanza, content]) => {
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
            x[attr].text ||= typeof value === "string";
            return x;
          }, x[stanza].attr);
          return x;
        }, x[key].stanzas);
        return x;
      }, x);
    }, {});

    return Object.entries(x)
      .sort(isort0)
      .map(([key, { app, file, cols, stanzas }]) => [
        key,
        app,
        file,
        cols,
        Object.entries(stanzas)
          .sort(isort0)
          .map(([stanza, { cols, acl, attr }]) => [
            `${key}|${stanza}`,
            stanza,
            cols,
            acl,
            Object.entries(attr)
              .sort(isort0)
              .map(([attr, { cols, diff }]) => [`${key}|${stanza}|${attr}`, attr, cols, diff]),
          ]),
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
  }, [latest(contexts), latest(configs)]);

  console.log(table);

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

  //key={`${app}|${file}|${stanza}|sharing`}
  const getConfigRows = (app, file, stanza, attrs, acls) => [
    <Table.Row>
      <TallCell align="right">Sharing</TallCell>

      {acls.map((acl, z) => {
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
      {acls.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Select inline disabled={!acl.change} value={acl.owner} onChange={handleAclChangeFactory(z, file, app, stanza, "owner")} error={!acls.owner}>
              <Select.Option label="Nobody" value="nobody" />
              {contexts[z]?.users?.map((username, realname) => (
                <Select.Option label={realname} value={username} />
              ))}
            </Select>
          </ShortCell>
        ) : (
          <ShortCell key={z}></ShortCell>
        );
      })}
    </Table.Row>,
    <Table.Row key={`${app}|${file}|${stanza}|readers`}>
      <TallCell align="right">Read Roles</TallCell>

      {acls.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Multiselect
              disabled={!acl.change}
              values={acl.readers}
              onChange={handleAclChangeFactory(z, file, app, stanza, "perms.read")}
              error={!acls.readers}
            >
              <Multiselect.Option label="Everyone" value="*" />
              {contexts[z]?.roles?.map((role) => (
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
      {acls.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Multiselect
              disabled={!acl.change}
              values={acl.writers}
              onChange={handleAclChangeFactory(z, file, app, stanza, "perms.write")}
              error={!acls.writers}
            >
              <Multiselect.Option label="Everyone" value="*" />
              {contexts[z]?.roles?.map((role) => (
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
      {acls.map((_, z) => (
        <Table.Cell key={z}></Table.Cell>
      ))}
    </Table.Row>,
    ...attrs.map(([key, attr, cols, diff, type]) => (
      <Table.Row key={key}>
        <TallCell align="right" truncate>
          <AttributeSpan>{attr}</AttributeSpan>
        </TallCell>
        {cols.map((value, z) => {
          const acl = acls[z];
          if (!acl) return <TallCell key={z}></TallCell>;
          if (value === undefined)
            return (
              <TallCell key={z}>
                <CreateLink onClick={handleConfigChangeFactory(z, file, app, stanza, attr, metadata.text ? "" : "false")}>Create Attribute</CreateLink>
              </TallCell>
            );
          return (
            <ConfigInput key={z} value={value} diff={diff} type={type} disabled={!acl.write} handle={handleConfigChangeFactory(z, file, app, stanza, attr)} />
          );
        })}
      </Table.Row>
    )),
  ];

  return (
    <Table stripeRows rowExpansion="multi">
      <Table.Head>
        <Table.HeadCell>Config Editor</Table.HeadCell>
        {columns.map(({ server }, z) => (
          <Table.HeadCell key={z}>{server || "No Server Selected"}</Table.HeadCell>
        ))}
      </Table.Head>
      <Table.Body>
        {table.map(([key, app, file, appcols, stanzas]) => [
          // App File Row
          <Table.Row key={key}>
            <Table.Cell>
              <b>
                {app} / {file}.conf
              </b>
            </Table.Cell>
            {appcols.map((appcol, z) => {
              console.log(appcol);
              return appcol ? (
                <Table.Cell key={z}>
                  {appcol[0]} {appcol[2]}
                  <Actions>
                    <Tooltip content="Download file contents">
                      <Download />
                    </Tooltip>
                  </Actions>
                </Table.Cell>
              ) : (
                <Table.Cell key={z}></Table.Cell>
              );
            })}
          </Table.Row>,
          stanzas.map(
            (
              [key, stanza, stanzacols, acl, attr] // Stanza Row with expansion
            ) => (
              <Table.Row key={key} expansionRow={getConfigRows(app, file, stanza, attr, acl)}>
                <Table.Cell align="right" truncate>
                  <StanzaSpan>[{smartTrim(stanza, 30)}]</StanzaSpan>
                </Table.Cell>
                {stanzacols.map((summary, z) => {
                  if (!appcols[z]) return <Table.Cell key={z}></Table.Cell>;
                  if (!summary)
                    return (
                      <Table.Cell key={z}>
                        <CreateLink onClick={handleConfigChangeFactory(z, file, app, "", "name", stanza)}>Create Stanza</CreateLink>
                      </Table.Cell>
                    );
                  return (
                    <Table.Cell key={z}>
                      <i>{summary}</i>
                      <StanzaActions server={columns[z].server} app={app} file={file} stanza={stanza} />
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            )
          ),
        ])}
      </Table.Body>
    </Table>
  );
};

const ConfigInput = ({ value, handle, disabled, diff, text }) => {
  const [internalvalue, setInternalValue] = useState(value); //
  const deboundedHandle = useCallback(debounce(handle, 1000), []);
  const inputHandle = (e, { value }) => {
    setInternalValue(value);
    deboundedHandle(value);
  };

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return text ? (
    <ShortCell>
      <Text value={internalvalue} onChange={inputHandle} disabled={disabled} error={diff} />
    </ShortCell>
  ) : (
    <ShortCell>
      <Switch appearance="toggle" selected={internalvalue} value={!internalvalue} onClick={inputHandle} disabled={disabled} error={diff} />
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
