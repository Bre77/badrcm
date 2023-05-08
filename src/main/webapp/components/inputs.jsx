import { Map, Set } from "immutable";
import React, { useMemo } from "react";

// Splunk UI
import { AnimationToggleProvider } from "@splunk/react-ui/AnimationToggle";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Multiselect from "@splunk/react-ui/Multiselect";
import Number from "@splunk/react-ui/Number";
import Select from "@splunk/react-ui/Select";

// Shared
import { COMMON_FILES, DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../shared/const";
import { isort, latest, wrapSetValue, wrapSetValues } from "../shared/helpers";
import { useQueryContext, useQueriesContext, useQueryServers } from "../shared/hooks";

// Local
import { MAX_COLUMNS } from "../pages/configedit/const";

export default ({ files, setFiles, uifolders, setUiFolders, apps, setApps, count, setCount, columns }) => {
  const servers = [...new Set(columns.map((column) => column?.server).filter((server) => server))];
  return (
    <ColumnLayout divider="vertical">
      <ColumnLayout.Row>
        <ColumnLayout.Column>
          {setFiles && <Files {...{ files, setFiles, servers }} />}
          {setUiFolders && <UiFolders {...{ uifolders, setUiFolders }} />}
          {setApps && <Apps {...{ apps, setApps, servers }} />}
          {setCount && <Count {...{ count, setCount }} />}
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

export const Files = ({ files, setFiles, servers }) => {
  const results = useQueriesContext(servers);
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
      <Multiselect inline values={files} onChange={handleFile} placeholder={`You must select 1 or more file`} error={!files.length}>
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

export const UiFolders = ({ uifolders, setUiFolders }) => {
  const handleUiFolders = wrapSetValues(setUiFolders);

  return (
    <ControlGroup label="UI Component" labelPosition="left">
      <Multiselect inline values={uifolders} onChange={handleUiFolders} placeholder={`You must select 1 or more component`} error={!uifolders.length}>
        {["nav", "views"].map((file) => (
          <Multiselect.Option key={file} label={file} value={file} />
        ))}
      </Multiselect>
    </ControlGroup>
  );
};

export const Apps = ({ apps, setApps, servers }) => {
  const results = useQueriesContext(servers);
  const handleApp = wrapSetValues(setApps);

  const appoptions = useMemo(() => {
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
      <Multiselect
        inline
        values={apps}
        onChange={handleApp}
        //placeholder={`You must select 1 or more app`}
        //error={!apps.length}
        noOptionsMessage="Select at least one server first"
      >
        {appoptions.map((label, id) => <Multiselect.Option key={id} label={label} value={id} />).toList()}
      </Multiselect>
    </ControlGroup>
  );
};

export const Count = ({ count, setCount }) => {
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

  //! There is a bug here where the server changes before the context can be validated. I may need to handle this internally until context is updated

  const servers = useQueryServers();
  const context = useQueryContext(column.server, {
    onSuccess: (data) => {
      if (column.appcontext && ![...Object.keys(data.apps), DEFAULT_APP_CONTEXT.name, SYSTEM_APP_CONTEXT.name].includes(column.appcontext))
        column.setAppContext(null);
      if (column.usercontext && ![...Object.keys(data.users), SYSTEM_USER_CONTEXT.name].includes(column.usercontext)) column.setUserContext(null);
    },
  });

  return (
    <AnimationToggleProvider enabled={false}>
      <ControlGroup label="Server" labelPosition="left">
        <Select
          inline
          appearance="primary"
          value={column.server}
          onChange={handleServer}
          animateLoading={servers.isLoading}
          error={!servers.data || servers.error}
        >
          {servers.data.map(({ name }) => (
            <Select.Option key={name} label={name} value={name} />
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
          error={context.error || !column.appcontext}
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
          error={context.error || !column.usercontext}
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
    </AnimationToggleProvider>
  );
};
