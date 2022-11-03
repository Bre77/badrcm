import { smartTrim } from "@splunk/ui-utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { debounce } from "lodash";
import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";

// Shared
import { restChange } from "../../shared/fetch";
import { isort0, latest, wrapSetValue } from "../../shared/helpers";
import { useConfig, useConfigs, useContext, useContexts, useMutateConfig } from "../../shared/hooks";
import { Actions, AttributeSpan, CreateLink, ShortCell, StanzaSpan, StyledContainer, SwitchSpinner, TallCell, TextSpinner } from "../../shared/styles";

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
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Dropdown from "@splunk/react-ui/Dropdown";
import Multiselect from "@splunk/react-ui/Multiselect";
import P from "@splunk/react-ui/Paragraph";
import Select from "@splunk/react-ui/Select";
import Switch from "@splunk/react-ui/Switch";
import Table from "@splunk/react-ui/Table";
import Text from "@splunk/react-ui/Text";
import Tooltip from "@splunk/react-ui/Tooltip";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";

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

      return Object.entries(data).reduce((x, [app, stanzas]) => {
        if (!apps.includes(app)) return x;
        const key = `${app}|${file}`;
        x[key] ||= { app, file, cols: Array(count).fill(), stanzas: {} };

        x[key].cols[z] = contexts[z]?.data?.apps?.[app]; // Add app context
        x[key].stanzas = Object.entries(stanzas).reduce((x, [stanza, content]) => {
          x[stanza] ||= {
            cols: Array(count).fill(),
            acl: { cols: Array(count).fill(), diff: { sharing: false, owner: false, readers: false, writers: false } },
            attr: {},
          };
          x[stanza].cols[z] = `${Object.keys(content.attr).length} attributes in ${content.acl.sharing} scope`;
          x[stanza].acl.cols[z] = content.acl;

          x[stanza].acl.diff.sharing ||= !x[stanza].acl.cols.map((acl) => acl?.sharing).includes(content.acl.sharing);
          x[stanza].acl.diff.owner ||= !x[stanza].acl.cols.map((acl) => acl?.owner).includes(content.acl.owner);

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
  }, [latest(contexts), latest(configs), apps]);

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

      {acls.cols.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Select
              inline
              disabled={!acl.change}
              value={acl.sharing}
              onChange={handleAclChangeFactory(acl, z, file, app, stanza, "sharing")}
              error={acls.diff.sharing}
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
      {acls.cols.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Select
              inline
              disabled={!acl.change}
              value={acl.owner}
              onChange={handleAclChangeFactory(acl, z, file, app, stanza, "owner")}
              error={acls.diff.owner}
            >
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

      {acls.cols.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Multiselect
              disabled={!acl.change}
              values={acl.readers}
              onChange={handleAclChangeFactory(acl, z, file, app, stanza, "perms.read")}
              error={acls.diff.readers}
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
      {acls.cols.map((acl, z) => {
        return acl ? (
          <ShortCell key={z}>
            <Multiselect
              disabled={!acl.change}
              values={acl.writers}
              onChange={handleAclChangeFactory(acl, z, file, app, stanza, "perms.write")}
              error={acls.diff.writers}
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
      {acls.cols.map((_, z) => (
        <Table.Cell key={z}></Table.Cell>
      ))}
    </Table.Row>,
    ...attrs.map(([key, attr, cols, diff, text]) => (
      <Table.Row key={key}>
        <TallCell align="right" truncate>
          <AttributeSpan>{attr}</AttributeSpan>
        </TallCell>
        {cols.map((value, z) => {
          if (!acls.cols[z]) return <TallCell key={z}></TallCell>;
          if (value === undefined)
            return (
              <TallCell key={z}>
                <CreateLink onClick={handleConfigChangeFactory(z, file, app, stanza, attr, text ? "" : "false")}>Create Attribute</CreateLink>
              </TallCell>
            );
          return <ConfigInput {...{ key: z, column: columns[z], value, diff, text, file, app, stanza, attr, disabled: !acls.cols[z].write }} />;
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
                  <Actions>
                    <ActionDownload column={columns[z]} app={app} file={file} />
                    <ActionAddStanza column={columns[z]} app={app} file={file} />
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
                      <Actions>
                        <StanzaDeleteStanza column={columns[z]} app={app} file={file} stanza={stanza} />
                        <ActionMoveStanza column={columns[z]} app={app} file={file} stanza={stanza} />
                        <ActionAddAttr column={columns[z]} app={app} file={file} stanza={stanza} />
                      </Actions>
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

const ConfigInput = ({ column: { server, appcontext, usercontext }, value, text, file, app, stanza, attr, disabled }) => {
  const [internalvalue, setInternalValue] = useState(value); //
  const deboundedHandle = useCallback(debounce(change.mutate, 1000), []);
  const inputHandle = (e, { value }) => {
    setInternalValue(value);
    text ? deboundedHandle({ [attr]: value }) : change.mutate({ [attr]: value });
  };

  const change = useMutateConfig(server, usercontext, appcontext, app, file, stanza);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return text ? (
    <ShortCell>
      <Text value={internalvalue} onChange={inputHandle} disabled={disabled} error={change.isError} endAdornment={change.isLoading && <TextSpinner />} />
    </ShortCell>
  ) : (
    <ShortCell>
      <Switch appearance="toggle" selected={internalvalue} value={!internalvalue} onClick={inputHandle} disabled={disabled} error={change.isError}>
        {change.isLoading && <WaitSpinner />} //! Needs CSS work to avoid bumping height and keeping middle
      </Switch>
    </ShortCell>
  );
};

const ActionAddStanza = ({ column: { server, appcontext, usercontext }, app, file }) => {
  const change = useMutateConfig(server, usercontext, appcontext, app, file, "");

  const [stanza, setStanza] = useState("");
  const handleStanza = wrapSetValue(setStanza);
  const handleClick = () => {
    change.mutate({ name: stanza });
  };
  const toggle = (
    <Clickable>
      <Plus screenReaderText="Add Stanza" hideDefaultTooltip />
    </Clickable>
  );
  return (
    <Tooltip content="Add new stanza.">
      <Dropdown toggle={toggle} retainFocus closeReasons={closeReasons}>
        <StyledContainer>
          <P>
            Add a new stanza to{" "}
            <b>
              {app}/{file}.conf
            </b>
          </P>
          <ControlGroup label="Stanza" labelWidth={60}>
            <Text value={stanza} onChange={handleStanza} error={!stanza} />
          </ControlGroup>
          <ControlGroup label="" labelWidth={60}>
            <Button disabled={!stanza} onClick={handleClick} error={change.isError}>
              {change.isLoading ? <WaitSpinner /> : "Create Stanza"}
            </Button>
          </ControlGroup>
        </StyledContainer>
      </Dropdown>
    </Tooltip>
  );
};

const ActionDownload = ({ column, app, file }) => {
  const { data } = useConfig(column, file);

  const toggle = (
    <Clickable>
      <Download screenReaderText="Download config file" hideDefaultTooltip />
    </Clickable>
  );

  const createDownload = () => {
    const config = Object.entries(data[app])
      .map(
        ([stanza, { attr }]) =>
          `[${stanza}]\n${Object.entries(attr)
            .map(([k, v]) => `${k} = ${v}`)
            .join("\n")}`
      )
      .join("\n\n");
    const link = document.createElement("a");
    link.download = `${file}.conf`;
    link.href = URL.createObjectURL(new Blob([config], { type: "text/plain" }));
    link.click();
  };

  return (
    <Tooltip content="Download as file">
      <Dropdown toggle={toggle} retainFocus closeReasons={closeReasons}>
        <StyledContainer>
          <Button appearance="primary" onClick={createDownload} disabled={!data}>
            Download {file}.conf
          </Button>
        </StyledContainer>
      </Dropdown>
    </Tooltip>
  );
};

const ActionAddAttr = ({ column: { server, usercontext, appcontext }, app, file, stanza }) => {
  const [attr, setAttr] = useState("");
  const handleAttr = wrapSetValue(setAttr);
  const [value, setValue] = useState("");
  const handleValue = wrapSetValue(setValue);

  const change = useMutateConfig(server, usercontext, appcontext, app, file, stanza, attr, value, () => {
    setAttr("");
    setValue("");
  });

  const toggle = (
    <Clickable>
      <Plus screenReaderText="Add Attribute" hideDefaultTooltip />
    </Clickable>
  );

  return (
    <Tooltip content="Add new attribute.">
      <Dropdown toggle={toggle} retainFocus closeReasons={closeReasons}>
        <StyledContainer>
          <P>
            Add a new attribute to <StanzaSpan>[{stanza}]</StanzaSpan> in{" "}
            <b>
              {app}/{file}.conf
            </b>
          </P>
          <ControlGroup label="Attribute" labelWidth={60}>
            <Text value={attr} onChange={handleAttr} error={!attr} />
          </ControlGroup>
          <ControlGroup label="Value" labelWidth={60}>
            <Text value={value} onChange={handleValue} error={!value} />
          </ControlGroup>
          <ControlGroup label="" labelWidth={60}>
            <Button disabled={!attr || !value || change.isLoading} onClick={change.mutate} error={!!change.error}>
              {change.isLoading ? <WaitSpinner /> : "Add"}
            </Button>
          </ControlGroup>
        </StyledContainer>
      </Dropdown>
    </Tooltip>
  );
};

const ActionMoveStanza = ({ column: { server, usercontext, appcontext }, app, file, stanza }) => {
  const [target, setTarget] = useState(app);
  const handleTarget = wrapSetValue(setTarget);

  const { data } = useContext(server);
  const move = useMutation({
    mutationFn: (target) => {
      return restChange("move", { server, user: usercontext, app, file, stanza }, { app: target });
    },
    onSuccess: (config) => {
      queryClient.setQueryData(["configs", server, file, appcontext, usercontext], (prev) => {
        delete prev[app][stanza];
        prev[target][stanza] = config[target][stanza];
        return prev;
      });
    },
  });

  const toggle = (
    <Clickable>
      <External screenReaderText="Move" hideDefaultTooltip />
    </Clickable>
  );
  return (
    <Tooltip content="Move stanza to another app.">
      <Dropdown toggle={toggle} retainFocus closeReasons={closeReasons}>
        <StyledContainer>
          <P>
            Move <StanzaSpan>[{stanza}]</StanzaSpan> from <b>{target}</b> to:
          </P>
          <Select onChange={handleTarget}>
            {data && Object.entries(data.apps).map(([name, [label]]) => <Select.Option key={name} label={label} value={name} />)}
          </Select>
          <Button disabled={target !== app} onClick={move.mutate} error={move.isError}>
            {move.isLoading ? <WaitSpinner /> : "Move"}
          </Button>
        </StyledContainer>
      </Dropdown>
    </Tooltip>
  );
};

const StanzaDeleteStanza = ({ column, app, file, stanza }) => {
  const toggle = (
    <Clickable>
      <Remove hideDefaultTooltip />
    </Clickable>
  );

  return (
    <Tooltip content="Remove stanza completely.">
      <Dropdown toggle={toggle} retainFocus closeReasons={closeReasons}>
        <StyledContainer style={{ "text-align": "center" }}>
          <Warning size={2} style={{ padding: "5px" }} />
          <P>
            Are you sure you want to delete stanza <StanzaSpan>[{stanza}]</StanzaSpan>?
          </P>
          <Button>Delete</Button>
        </StyledContainer>
      </Dropdown>
    </Tooltip>
  );
};
