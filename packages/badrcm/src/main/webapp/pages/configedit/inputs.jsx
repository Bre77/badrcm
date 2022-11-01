import { QueryClient, QueryClientProvider, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Map, Set } from "immutable";
import { debounce, filter, hasIn } from "lodash";
import React, { useMemo, useState } from "react";

import { COLUMN_INDEX, MAX_COLUMNS } from "./const";

// Shared
import { COMMON_FILES, DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../../shared/const";
import { isort, isort0, latest, localDel, localLoad, localSave, tupleSplit, wrapSetValue, wrapSetValues } from "../../shared/helpers";
import { useContext, useContexts, useServers } from "../../shared/hooks";

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

export default ({ files, setFiles, apps, setApps, count, setCount, columns }) => {
  const servers = [...new Set(columns.map((column) => column?.server).filter((server) => server))];
  return (
    <ColumnLayout divider="vertical">
      <ColumnLayout.Row>
        <ColumnLayout.Column>
          <Files {...{ files, setFiles, servers }} />
          <Apps {...{ apps, setApps, servers }} />
          <Count {...{ count, setCount }} />
        </ColumnLayout.Column>
        {columns.map((column, z) => (
          <ColumnLayout.Column key={z}>
            <Column column={column} />
          </ColumnLayout.Column>
        ))}
      </ColumnLayout.Row>
    </ColumnLayout>
  );
};

const Files = ({ files, setFiles, servers }) => {
  const results = useContexts(servers);
  const handleFile = wrapSetValues(setFiles);

  const fileoptions = useMemo(() => {
    console.debug("MEMO FILES");
    return Set(
      results
        .filter((result) => result.data)
        .flatMap((result) => result.data.files)
        .filter((file) => !COMMON_FILES.includes(file))
    ).sort(isort);
  }, [latest(results)]);

  return (
    <ControlGroup label="Config Files" labelPosition="left">
      <Multiselect inline values={files} onChange={handleFile} placeholder={`You must select 1 or more files`} error={!files.length}>
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
  );
};

const Apps = ({ apps, setApps, servers }) => {
  const results = useContexts(servers);
  const handleApp = wrapSetValues(setApps);

  const appoptions = useMemo(() => {
    console.debug("MEMO APPS");
    return Map(
      results
        .filter((result) => result.data)
        .flatMap((result) => Object.entries(result.data.apps))
        .reduce(
          (apps, [name, [label]]) => {
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
  }, [latest(results)]); //[...results.map((x) => x.data)]

  return (
    <ControlGroup label="Apps" labelPosition="left">
      <Multiselect inline values={apps} onChange={handleApp} placeholder={`All ${appoptions.size} apps`} noOptionsMessage="Select at least one server first">
        {appoptions.map((label, id) => <Multiselect.Option key={id} label={label} value={id} />).toList()}
      </Multiselect>
    </ControlGroup>
  );
};

const Count = ({ count, setCount }) => {
  const handleCount = wrapSetValue(setCount);

  return (
    <ControlGroup label="Columns" labelPosition="left">
      <Number inline value={count} onChange={handleCount} min={1} max={MAX_COLUMNS}></Number>
    </ControlGroup>
  );
};

export const Column = ({ column }) => {
  const handleServer = wrapSetValue(column.setServer);
  const handleAppContext = wrapSetValue(column.setAppContext);
  const handleUserContext = wrapSetValue(column.setUserContext);

  const servers = useServers();
  const context = useContext(column.server, {
    onSuccess: (data) => {
      console.log("Check Context");
      if (![...Object.keys(data.apps), DEFAULT_APP_CONTEXT.name, SYSTEM_APP_CONTEXT.name].includes(column.appcontext)) {
        console.log("Resetting App Context", column.appcontext, "didnt exist");
        column.setAppContext(DEFAULT_APP_CONTEXT.name);
      }
      if (![...Object.keys(data.users), SYSTEM_USER_CONTEXT.name].includes(column.usercontext)) {
        console.log("Resetting User Context", column.usercontext, "didnt exist");
        column.setUserContext(SYSTEM_USER_CONTEXT.name);
      }
    },
  });

  return (
    <>
      <ControlGroup label="Server" labelPosition="left">
        <Select
          inline
          appearance="primary"
          value={column.server}
          onChange={handleServer}
          animateLoading={servers.isLoading}
          error={!servers.data || servers.error}
        >
          {servers.data.map((s) => (
            <Select.Option key={s} label={s} value={s} />
          ))}
          <Select.Divider />
          <Select.Option label="None" value={false} />
        </Select>
      </ControlGroup>
      <ControlGroup label="App Context" labelPosition="left" tooltip="Changes which app shared config is shown">
        <Select
          inline
          value={column.appcontext}
          onChange={handleAppContext}
          disabled={!column.server}
          animateLoading={context.isLoading}
          error={context.error}
          filter
        >
          <Select.Heading>General</Select.Heading>
          <Select.Option label="All Apps" description="-" value={DEFAULT_APP_CONTEXT.name} />
          <Select.Option label="None / Global Only" description="system" value={SYSTEM_APP_CONTEXT.name} />
          <Select.Heading>Specific App (Not Recommended)</Select.Heading>
          {context.data?.apps && Object.entries(context.data.apps).map(([id, [label]]) => <Select.Option key={id} label={label} description={id} value={id} />)}
        </Select>
      </ControlGroup>
      <ControlGroup label="User Context" labelPosition="left" tooltip="Changes which private user config is shown, and which user will own any created config">
        <Select
          inline
          value={column.usercontext}
          onChange={handleUserContext}
          disabled={!column.server}
          animateLoading={context.isLoading}
          error={context.error}
          filter
        >
          <Select.Heading>General</Select.Heading>
          <Select.Option label="No Private Config" description="nobody" value={SYSTEM_USER_CONTEXT.name} />
          {context.data?.username && <Select.Option label={context.data.realname} value={context.data.username} description={context.data.username} />}
          <Select.Heading>All Users</Select.Heading>
          {context.data?.users &&
            Object.entries(context.data.users).map(([username, [realname]]) => (
              <Select.Option key={username} label={realname} description={username} value={username} />
            ))}
        </Select>
      </ControlGroup>
    </>
  );
};
