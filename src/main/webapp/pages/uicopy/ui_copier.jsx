/* eslint-disable */
import { Set } from "immutable";
import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { username } from "@splunk/splunk-utils/config";

// Shared
import { isort0, options, latest } from "../../shared/helpers";
import { AttributeSpan, ShortCell, StanzaSpan, TallCell } from "../../shared/styles";
import { useQueriesUi, useQueriesContext } from "../../shared/hooks";
import { restRaw } from "../../shared/fetch";

// Splunk UI
import Button from "@splunk/react-ui/Button";
import Switch from "@splunk/react-ui/Switch";
import Table from "@splunk/react-ui/Table";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import Code from "@splunk/react-ui/Code";

const sort = options.sort ? isort0 : undefined;

export default ({ apps, uifolders, columns }) => {
  console.log(apps, uifolders);
  const queryClient = useQueryClient();
  // State
  const [selected, setSelected] = useState(Set());

  // Queries
  const contexts = useQueriesContext(columns.map((x) => x.server));
  const folders = useQueriesUi(columns, uifolders);

  const src_context = contexts[0].data;
  const dst_context = contexts[1].data;
  const src_uifolders = useMemo(
    () =>
      uifolders.reduce((src, folder, z) => {
        src[folder] = folders[z * 2].data;
        return src;
      }, {}),
    [uifolders, latest(folders)]
  );
  const dst_uifolders = useMemo(
    () =>
      uifolders.reduce((dst, folder, z) => {
        dst[folder] = folders[z * 2 + 1].data;
        return dst;
      }, {}),
    [uifolders, latest(folders)]
  );

  console.log(src_uifolders, dst_uifolders);

  //! Mutation
  const copyer = useMutation({
    mutationFn: () => {
      const merged = selected
        .toArray()
        .sort()
        .reduce((x, key) => {
          const parts = key.split("|");
          if (parts.length == 2) {
            const [app, folder] = parts;
            x[app] ||= { [folder]: [] };
            x[app][folder] ||= [];
            return x;
          }
          if (parts.length == 3) {
            const [app, folder, file] = parts;
            x[app][folder].push(file);
            return x;
          }
        }, {});
      const tasks = [];
      Object.entries(merged).forEach(([app, folders]) => {
        if (!dst_context.apps[app])
          tasks.push([
            {
              name: app,
              label: src_context.apps[app][0],
              description: "Created by Remote Configuration Manager Config Copy",
              visible: !!src_context.apps[app][1],
              version: src_context.apps[app][2],
              author: username,
            },
          ]);
        Object.entries(folders).forEach(([folder, files]) => {
          files.forEach((file) => {
            let data = { "eai:data": src_uifolders[folder][app][file].attr["eai:data"] };
            if (!dst_uifolders?.[folder]?.[app]?.[file]) {
              data.name = file;
              tasks.push([app, folder, data]);
            } else {
              tasks.push([app, folder, file, data]);
            }
          });
        });
      });

      return restRaw("uibatch", { server: columns[1].server, user: columns[1].usercontext }, tasks);
    },
    onSuccess: () => {
      setSelected(Set());
      //queryClient.invalidateQueries(["servers", columns[1].server]);
      uifolders.forEach((folder) => {
        queryClient.invalidateQueries(["uis", columns[1].server, folder, columns[1].appcontext, columns[1].usercontext]);
      });
    },
  });

  // Memo
  //? Need to add the destination keys, but for time I am ignoring this for now
  const table = useMemo(
    () =>
      Object.entries(src_uifolders)
        //.map(([folder, folderapps], z) => [folder, folderapps, z])
        .flatMap(([folder, folderapps]) =>
          folderapps
            ? Object.entries(folderapps)
                .filter(([app]) => apps.length === 0 || apps.includes(app))
                .map(([app, files]) => [
                  app,
                  folder,
                  Object.entries(files)
                    .sort(sort)
                    .map(([file, _]) => [file, src_uifolders[folder]?.[app]?.[file], dst_uifolders[folder]?.[app]?.[file]]),
                ])
            : []
        )
        .sort(sort),
    [latest(contexts), latest(folders), apps, columns]
  );

  // Methods
  const k = (a) => a.join("|");

  const toggleFile = (_, { value, selected }) => {
    const [app, folder, file] = value;
    setSelected((prev) => {
      return selected ? prev.remove(k([app, folder, file])) : prev.concat([k([app, folder, file]), k([app, folder])]);
    });
  };
  const toggleFolder = (_, { value, selected }) => {
    const [app, folder] = value;
    setSelected((prev) => {
      return selected
        ? prev.filter((_, key) => !key.startsWith(k([app, folder])))
        : prev.concat([k([app, folder]), ...Object.keys(src_uifolders[folder][app]).map((file) => k([app, folder, file]))]);
    });
  };

  const getUiRows = (app, folder, file) => {
    const key = k([app, folder, file, "exp"]);
    const src = src_uifolders[folder]?.[app]?.[file];
    const dst = dst_uifolders[folder]?.[app]?.[file];
    return (
      <Table.Row key={key}>
        <TallCell align="right" truncate>
          <AttributeSpan>Raw Content</AttributeSpan>
        </TallCell>
        <TallCell>{src && <Code language="xml" value={src.attr["eai:data"]} />}</TallCell>
        <ShortCell>{src && dst && src.attr["eai:digest"] === dst.attr["eai:digest"] ? "Same" : "Diff"}</ShortCell>
        <TallCell>{dst && <Code language="xml" value={dst.attr["eai:data"]} />}</TallCell>
      </Table.Row>
    );
  };

  return (
    <>
      <Button inline={false} appearance={selected.isEmpty() ? "secondary" : "primary"} onClick={copyer.mutate} disabled={copyer.isLoading}>
        {copyer.isLoading ? <WaitSpinner /> : "Copy Selected Files"}
      </Button>
      <br />
      <Table stripeRows rowExpansion="multi">
        <Table.Head>
          <Table.HeadCell>UI Copy</Table.HeadCell>
          <Table.HeadCell>Source</Table.HeadCell>
          <Table.HeadCell width={12}>Select</Table.HeadCell>
          <Table.HeadCell>Destination</Table.HeadCell>
        </Table.Head>
        <Table.Body>
          {src_context &&
            dst_context &&
            table.map(([app, folder, files]) => {
              const key = k([app, folder]);
              return [
                // App File Row
                <Table.Row key={key}>
                  <Table.Cell>
                    <b>
                      {app} / data / ui / {folder}
                    </b>
                  </Table.Cell>
                  <Table.Cell>
                    {src_context.apps?.[app]?.[0]} {src_context.apps?.[app]?.[2]}
                  </Table.Cell>
                  <ShortCell>
                    <Switch appearance="toggle" onClick={toggleFolder} value={[app, folder]} selected={selected.has(k([app, folder]))} />
                  </ShortCell>
                  <Table.Cell>{dst_context.apps?.[app] ? dst_context.apps[app]?.[0] + " " + dst_context.apps[app]?.[2] : "App will be created!"}</Table.Cell>
                </Table.Row>,
                ...files.map(([file, src, dst]) => {
                  const key = k([app, folder, file]);
                  const on = selected.has(key);
                  //const src = src_uifolders[folder]?.[app]?.[file];
                  //const dst = dst_uifolders[folder]?.[app]?.[file];

                  return (
                    <Table.Row key={key} expansionRow={getUiRows(app, folder, file)}>
                      <TallCell align="right" truncate>
                        <StanzaSpan>{file}</StanzaSpan>
                      </TallCell>
                      <TallCell>{src?.attr?.label || src?.attr["eai:digest"]}</TallCell>
                      <ShortCell>{src && <Switch appearance="toggle" onClick={toggleFile} value={[app, folder, file]} selected={on} />}</ShortCell>
                      <TallCell>{dst?.attr?.label || dst?.attr["eai:digest"]}</TallCell>
                    </Table.Row>
                  );
                }),
              ];
            })}
        </Table.Body>
      </Table>
    </>
  );
};
