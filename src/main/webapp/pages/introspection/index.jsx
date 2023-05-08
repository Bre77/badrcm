/* eslint-disable */
import React from "react";

// Shared
import { useLocal, wrapSetValues } from "../../shared/helpers";
import Page from "../../shared/page";
import { StyledContainer } from "../../shared/styles";
import { useQueryServers } from "../../shared/hooks";
import { fetchGet } from "../../shared/fetch";
import { useQuery } from "@tanstack/react-query";

// Splunk UI
import DL from "@splunk/react-ui/DefinitionList";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import Heading from "@splunk/react-ui/Heading";
import Chip from "@splunk/react-ui/Chip";
import Multiselect from "@splunk/react-ui/Multiselect";

const Introspection = () => {
  // Selected Data
  const [columns, setColumns] = useLocal("BADRCM_introspection", []);
  const handleColumns = wrapSetValues(setColumns);

  const servers = useQueryServers();
  console.log(servers);

  // Render
  return (
    <>
      <Multiselect inline={false} appearance="primary" values={columns} onChange={handleColumns} animateLoading={servers.isLoading} error={servers.error}>
        {servers.data.map(({ name }) => (
          <Multiselect.Option key={name} label={name} value={name} />
        ))}
      </Multiselect>
      <ColumnLayout divider="vertical">
        <ColumnLayout.Row>
          {columns.map((server) => (
            <ColumnLayout.Column key={server}>
              <IntrospectionColumn server={server} />
            </ColumnLayout.Column>
          ))}
        </ColumnLayout.Row>
      </ColumnLayout>
    </>
  );
};

const health = { green: "success", yellow: "warning", red: "error" };

const IntrospectionColumn = ({ server }) => {
  const options = {
    notifyOnChangeProps: ["data", "isLoading", "isError"],
    refetchInterval: 10000,
    staleTime: 1000,
  };
  const infoquery = useQuery({
    queryKey: ["introspection", "info", server],
    queryFn: () => fetchGet("proxy", { server, path: "server/info" }),
    notifyOnChangeProps: ["data", "isLoading", "isError"],
    staleTime: 300000,
  });
  const info = infoquery.data?.["server-info"];

  const searchquery = useQuery({
    queryKey: ["introspection", "search", server],
    queryFn: () => fetchGet("proxy", { server, path: "server/introspection/search/scheduler" }),
    ...options,
  });
  const search = searchquery.data?.["scheduler-statistics"];
  const queuesquery = useQuery({
    queryKey: ["introspection", "queues", server],
    queryFn: () => fetchGet("proxy", { server, path: "server/introspection/queues" }),
    ...options,
  });
  const queues = queuesquery.data;

  const resourcesquery = useQuery({
    queryKey: ["introspection", "resources", server],
    queryFn: () => fetchGet("proxy", { server, path: "server/status/resource-usage/hostwide" }),
    ...options,
  });
  const resources = resourcesquery.data?.result;

  return (
    <>
      <Heading level={1}>{server}</Heading>
      {info?.serverName}
      <Heading level={2}>Server</Heading>
      <DL termWidth={150}>
        <DL.Term>Version</DL.Term>
        <DL.Description>{info?.version}</DL.Description>
        <DL.Term>License Type</DL.Term>
        <DL.Description>
          {info?.activeLicenseGroup} {info?.activeLicenseSubgroup}
        </DL.Description>
        <DL.Term>Premium Apps</DL.Term>
        <DL.Description>{Object.keys(info?.addOns || { "n/a": 0 }).join(", ")}</DL.Description>
        <DL.Term>OS</DL.Term>
        <DL.Description>
          {info?.os_name_extended} {info?.os_version}
        </DL.Description>
        <DL.Term>CPU Cores</DL.Term>
        <DL.Description>
          {info?.numberOfCores} / {info?.numberOfVirtualCores}
        </DL.Description>
        <DL.Term>Memory</DL.Term>
        <DL.Description>{info?.physicalMemoryMB} MB</DL.Description>
        <DL.Term>Health</DL.Term>
        <DL.Description>{info?.health_info && <Chip appearance={health[info?.health_info]}>{info?.health_info}</Chip>}</DL.Description>
      </DL>
      <Heading level={2}>Resources</Heading>
      <DL termWidth={150}>
        <DL.Term>CPU</DL.Term>
        <DL.Description>{Math.round(100 - resources?.cpu_idle_pct)}%</DL.Description>
        <DL.Term>Memory</DL.Term>
        <DL.Description>{Math.round((resources?.mem_used / resources?.mem) * 100)}%</DL.Description>
        <DL.Term>Swap</DL.Term>
        <DL.Description>{Math.round((resources?.swap_used / resources?.swap) * 100)}%</DL.Description>
        <DL.Term>Forks</DL.Term>
        <DL.Description>{resources?.forks}</DL.Description>
      </DL>
      <Heading level={2}>Search</Heading>
      <DL termWidth={150}>
        <DL.Term>Concurrent</DL.Term>
        <DL.Description>{search?.avg_conc_util}</DL.Description>
        <DL.Term>Dispatch</DL.Term>
        <DL.Description>{search?.searches_dispatched}</DL.Description>
        <DL.Term>Lag</DL.Term>
        <DL.Description>{search?.avg_lag}</DL.Description>
        <DL.Term>Skip</DL.Term>
        <DL.Description>{search?.searches_skipped}</DL.Description>
      </DL>
      <Heading level={2}>Queue Averages</Heading>
      {queues && (
        <DL termWidth={150}>
          <DL.Term>TCP In</DL.Term>
          <DL.Description>{queue(queues.tcpin_queue)}%</DL.Description>
          <DL.Term>Parsing</DL.Term>
          <DL.Description>{queue(queues.parsingQueue)}%</DL.Description>
          <DL.Term>Aggregation</DL.Term>
          <DL.Description>{queue(queues.aggQueue)}%</DL.Description>
          <DL.Term>Typing</DL.Term>
          <DL.Description>{queue(queues.typingQueue)}%</DL.Description>
          <DL.Term>Ruleset</DL.Term>
          <DL.Description>{queue(queues.rulesetQueue)}%</DL.Description>
          <DL.Term>Indexing</DL.Term>
          <DL.Description>{queue(queues.indexQueue)}%</DL.Description>
        </DL>
      )}
    </>
  );
};

const queue = (data) => Math.round((data.value_cntr1_size_bytes_lookback / data.max_size_bytes) * 10000) / 100;

Page(
  <StyledContainer>
    <Introspection />
  </StyledContainer>
);
