import { smartTrim } from "@splunk/ui-utils/format";
import { useQueryClient } from "@tanstack/react-query";
import { debounce } from "lodash";
import React, { useCallback, useEffect, useMemo, useState } from "react";

// Shared
import { restChange } from "../../shared/fetch";
import { isort0, latest } from "../../shared/helpers";
import { useConfigs, useContext, useContexts } from "../../shared/hooks";
import { Actions, AttributeSpan, CreateLink, ShortCell, StanzaSpan, StyledContainer, TallCell } from "../../shared/styles";

// Splunk UI
import Dashboard from "@splunk/react-icons/Dashboard";
import Download from "@splunk/react-icons/Download";
import External from "@splunk/react-icons/External";
import Globe from "@splunk/react-icons/Globe";
import Plus from "@splunk/react-icons/Plus";
import Remove from "@splunk/react-icons/Remove";
import User from "@splunk/react-icons/User";
import Warning from "@splunk/react-icons/Warning";
import Button from "@splunk/react-ui/Button";
import Clickable from "@splunk/react-ui/Clickable";
import Dropdown from "@splunk/react-ui/Dropdown";
import Multiselect from "@splunk/react-ui/Multiselect";
import Number from "@splunk/react-ui/Number";
import P from "@splunk/react-ui/Paragraph";
import Select from "@splunk/react-ui/Select";
import Switch from "@splunk/react-ui/Switch";
import Table from "@splunk/react-ui/Table";
import Text from "@splunk/react-ui/Text";
import Tooltip from "@splunk/react-ui/Tooltip";

const closeReasons = ["clickAway", "escapeKey", "toggleClick"];

export default ({ apps, files, columns }) => {
  const queryClient = useQueryClient();
  const contexts = useContexts(columns.map((x) => x.server));
  const configs = useConfigs(columns, files);

  const table = useMemo(() => {
    console.debug("Expensive Config Table");
    const count = columns.length;
    const x = configs.reduce((x, { data }, y) => {
      if (!data) return x;
      const z = y % count; // Column Index
      const file = files[~~(y / count)]; // File
      console.log(x, y, z, file, files, configs, contexts);

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
              text: false,
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
              .map(([attr, { cols, diff, text }]) => [`${key}|${stanza}|${attr}`, attr, cols, diff, text]),
          ]),
      ]);
  }, [latest(contexts), latest(configs)]);

  const users = useMemo(() => {
    return contexts.map(
      (context) =>
        context.data && Object.entries(context.data.users).map(([username, [realname]]) => <Select.Option key={username} label={realname} value={username} />)
    );
  }, [latest(contexts)]);

  const roles = useMemo(() => {
    return contexts.map((context) => context.data && context.data.roles.map((role) => <Multiselect.Option key={role} label={role} value={role} />));
  }, [latest(contexts)]);

  // Methods
  const handleConfigChangeFactory = (z, file, app, stanza, key, fixedvalue) => (inputvalue) => {
    const { server, usercontext, appcontext } = columns[z];
    restChange("configs", { server, file, user: usercontext, app, stanza }, { [key]: fixedvalue !== null ? fixedvalue : inputvalue }).then((config) => {
      queryClient.setQueryData(["configs", server, file, appcontext, usercontext], (prev) => {
        prev[app][stanza] = config[app][stanza];
        return prev;
      });
      //queryClient.invalidateQueries(["configs", server, file, appcontext, usercontext]);
    });
  };

  const handleAclChangeFactory =
    (current, z, file, app, stanza, key) =>
    (_, { value, values }) => {
      const { server, usercontext, appcontext } = columns[z];
      return restChange(
        "acl",
        { server, file, user: usercontext, app, stanza },
        { sharing: current.sharing, owner: current.owner, "perms.read": current.readers, "perms.write": current.writers, [key]: value || values }
      ).then((acls) => {
        queryClient.setQueryData(["configs", server, file, appcontext, usercontext], (prev) => {
          console.log(prev[app][stanza].acl, acls);
          prev[app][stanza].acl = acls;
          return prev;
        });
        //queryClient.invalidateQueries(["configs", server, file, appcontext, usercontext]);
      });
    };

  //key={`${app}|${file}|${stanza}|sharing`}
  const getConfigRows = (app, file, stanza, attrs, acls) => [
    <Table.Row>
      <TallCell align="right">Sharing</TallCell>

      {acls.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Select
              inline
              disabled={!acl.change}
              value={acl.sharing}
              onChange={handleAclChangeFactory(acl, z, file, app, stanza, "sharing")}
              error={!acls.sharing}
            >
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
            <Select inline disabled={!acl.change} value={acl.owner} onChange={handleAclChangeFactory(acl, z, file, app, stanza, "owner")} error={!acls.owner}>
              <Select.Option label="Nobody" value="nobody" />
              {users[z]}
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
              onChange={handleAclChangeFactory(acl, z, file, app, stanza, "perms.read")}
              error={!acls.readers}
            >
              <Multiselect.Option label="Everyone" value="*" />
              {roles[z]}
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
              onChange={handleAclChangeFactory(acl, z, file, app, stanza, "perms.write")}
              error={!acls.writers}
            >
              <Multiselect.Option label="Everyone" value="*" />
              {roles[z]}
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
    ...attrs.map(([key, attr, cols, diff, text]) => (
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
                <CreateLink onClick={handleConfigChangeFactory(z, file, app, stanza, attr, text ? "" : "false")}>Create Attribute</CreateLink>
              </TallCell>
            );
          return (
            <ConfigInput key={z} value={value} diff={diff} text={text} disabled={!acl.write} handle={handleConfigChangeFactory(z, file, app, stanza, attr)} />
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
              return appcol ? (
                <Table.Cell key={z}>
                  {appcol[0]} {appcol[2]}
                  <ParentActions column={columns[z]} app={app} file={file} />
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
                      <StanzaActions column={columns[z]} app={app} file={file} stanza={stanza} />
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

const StanzaActions = ({ column, app, file, stanza }) => {
  const { data } = useContext(column.server);

  const add = (
    <Clickable>
      <Plus screenReaderText="Add Attribute" hideDefaultTooltip />
    </Clickable>
  );

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
      <Tooltip content="Add new attribute.">
        <Dropdown toggle={add} retainFocus closeReasons={closeReasons}>
          <StyledContainer>
            <P>
              Add a new attribute to <StanzaSpan>[{stanza}]</StanzaSpan> in{" "}
              <b>
                {app}/{file}.conf
              </b>
            </P>
            <Text inline placeholder="Attribute (required)" />
            <Text inline placeholder="Value (optional)" />
            <Button inline>Add</Button>
          </StyledContainer>
        </Dropdown>
      </Tooltip>
      <Tooltip content="Move stanza to another app.">
        <Dropdown toggle={move} retainFocus closeReasons={closeReasons}>
          <StyledContainer>
            <P>
              Move <StanzaSpan>[{stanza}]</StanzaSpan> from <b>{app}</b> to:
            </P>
            <Multiselect>
              {data && Object.entries(data.apps).map(([name, [label]]) => <Multiselect.Option key={name} label={label} value={name} />)}
            </Multiselect>
          </StyledContainer>
        </Dropdown>
      </Tooltip>
      <Tooltip content="Remove stanza completely.">
        <Dropdown toggle={remove} retainFocus closeReasons={closeReasons}>
          <StyledContainer>
            <Warning size={2} />
            <br />
            <P>
              Are you sure you want to delete stanza <StanzaSpan>[{stanza}]</StanzaSpan>?
            </P>
            <Button>Delete</Button>
          </StyledContainer>
        </Dropdown>
      </Tooltip>
    </Actions>
  );
};

const ParentActions = ({ column, app, file }) => {
  const { data } = useContext(column.server);
  const add = (
    <Clickable>
      <Plus screenReaderText="Add Attribute" hideDefaultTooltip />
    </Clickable>
  );
  return (
    <Actions>
      <Tooltip content="Add new stanza.">
        <Dropdown toggle={add} retainFocus closeReasons={closeReasons}>
          <StyledContainer>
            <P>
              Add a new stanza to {app}/{file}.conf
            </P>
            <Text inline placeholder="Stanza Name (required)" />
            <Button inline>Create Stanza</Button>
          </StyledContainer>
        </Dropdown>
      </Tooltip>
      <Tooltip content="Download file contents">
        <Download />
      </Tooltip>
    </Actions>
  );
};
