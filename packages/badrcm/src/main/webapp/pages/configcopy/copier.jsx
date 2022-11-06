/* eslint-disable */
import { smartTrim } from "@splunk/ui-utils/format";
import { Set } from "immutable";
import React, { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

// Shared
import { COMMON_FILES, DEFAULT_APP_CONTEXT, SYSTEM_APP_CONTEXT, SYSTEM_USER_CONTEXT } from "../../shared/const";
import { isort0, options } from "../../shared/helpers";
import { AttributeSpan, ShortCell, StanzaSpan, StyledContainer, TallCell } from "../../shared/styles";
import { useQueriesConfig, useQueriesContext } from "../../shared/hooks";
import { restRaw } from "../../shared/fetch";

// Splunk UI
import Button from "@splunk/react-ui/Button";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Multiselect from "@splunk/react-ui/Multiselect";
import Select from "@splunk/react-ui/Select";
import Switch from "@splunk/react-ui/Switch";
import Table from "@splunk/react-ui/Table";
import Typography from "@splunk/react-ui/Typography";
import Play from "@splunk/react-icons/Play";

const sort = options.sort ? isort0 : undefined;

export default ({ apps, files, columns }) => {
  // State
  const [selected, setSelected] = useState(Set());

  // Queries
  const contexts = useQueriesContext(columns.map((x) => x.server));
  const configs = useQueriesConfig(columns, files);

  const src_context = contexts[0].data;
  const dst_context = contexts[1].data;
  const src_config = useMemo(
    () =>
      files.reduce((src, file, z) => {
        src[file] = configs[z * 2].data;
        return src;
      }, {}),
    [files]
  );
  const dst_config = useMemo(
    () =>
      files.reduce((dst, file, z) => {
        dst[file] = configs[z * 2 + 1].data;
        return dst;
      }, {}),
    [files]
  );

  // Mutation
  const copyer = useMutation({
    mutationFn: () => {
      console.log(selected);
      const tasks = selected
        .toArray()
        .sort()
        .map((key) => {
          parts = key.split("|");
          if (parts.length == 2) {
            const [app, file] = parts;
            return app;
          }
          if (parts.length == 3) {
            //const [app,file, stanza] = parts
            return parts;
          }
          if (parts.length == 4) {
            //const [app,file, stanza] = parts
            return parts;
          }
        });
      return restRaw("batch", { server: columns[1].server, user: columns[1].usercontext }, tasks);
    },
  });

  // Memo
  const table = useMemo(() => {
    console.debug("EFFECT Config Merge");

    const configdict = files.reduce((x, file, z) => {
      if (!x[file] || !dst_config[file]) {
        delete x[file];
        return x;
      }
      for (const [app, stanzas] of Object.entries(dst_config[file])) {
        if (!x[file][app]) continue;
        for (const [stanza, content] of Object.entries(stanzas)) {
          if (!x[file][app][stanza]) x[file][app][stanza] = { attr: content.attr };
          else Object.keys(content.attr).forEach((attr) => (x[file][app][stanza].attr[attr] ||= undefined));
        }
      }
      return x;
    }, structuredClone(src_config));

    return Object.entries(configdict)
      .map(([file, fileapps], z) => [file, fileapps, z])
      .sort(sort)
      .flatMap(([file, fileapps, z]) => {
        console.log(file, fileapps, z);
        return Object.entries(fileapps)
          .filter(([app]) => apps.length === 0 || apps.includes(app))
          .sort(sort)
          .map(([app, stanzas]) => [
            app,
            file,
            Object.entries(stanzas)
              .sort(sort)
              .map(([stanza, content]) => [
                stanza,
                Object.entries(content.attr)
                  .sort(sort)
                  .map(([attr, value]) => [attr, value, dst_config[file]?.[app]?.[stanza]?.attr?.[attr]]),
              ]),
          ]);
      });
  });

  // Methods
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
        : prev.concat([k([app, file]), k([app, file, stanza]), ...Object.keys(src_config[file][app][stanza].attr).map((attr) => k([app, file, stanza, attr]))]);
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
            ...Object.keys(src_config[file][app]).flatMap((stanza) => [
              k([app, file, stanza]),
              ...Object.keys(src_config[file][app][stanza].attr).map((attr) => k([app, file, stanza, attr])),
            ]),
          ]);
    });
  };

  const getConfigRows = (app, file, stanza, attrs) => {
    return attrs.map(([attr, src, dst]) => {
      const src_text = src !== undefined ? `${src}` : "";
      const dst_test = dst !== undefined ? `${dst}` : "";
      const key = k([app, file, stanza, attr]);
      const on = selected.has(key);
      return (
        <Table.Row key={key}>
          <TallCell align="right" truncate>
            <AttributeSpan>{attr}</AttributeSpan>
          </TallCell>
          <TallCell truncate>
            <Typography as="p" variant="monoBody">
              {src_text}
            </Typography>
          </TallCell>
          <ShortCell>{src !== undefined && <Switch appearance="toggle" onClick={toggleAttribute} value={[app, file, stanza, attr]} selected={on} />}</ShortCell>
          <TallCell truncate>
            <Typography as="p" variant="monoBody">
              {on ? <b>{src_text}</b> : dst_test}
            </Typography>
          </TallCell>
        </Table.Row>
      );
    });
  };

  return (
    <>
      <Button>Copy Selected Configuration</Button>
      <br />
      <Table stripeRows rowExpansion="multi">
        <Table.Head>
          <Table.HeadCell>Config Copy</Table.HeadCell>
          <Table.HeadCell>Source</Table.HeadCell>
          <Table.HeadCell width={12}>Select</Table.HeadCell>
          <Table.HeadCell>Destination</Table.HeadCell>
        </Table.Head>
        <Table.Body>
          {src_context &&
            dst_context &&
            table.map(([app, file, stanzas]) => {
              const key = k([app, file]);
              return [
                // App File Row
                <Table.Row key={key}>
                  <Table.Cell>
                    <b>
                      {app} / {file}.conf
                    </b>
                  </Table.Cell>
                  <Table.Cell>
                    {src_context.apps[app][0]} {src_context.apps[app][2]}
                  </Table.Cell>
                  <ShortCell>
                    <Switch appearance="toggle" onClick={toggleParent} value={[app, file]} selected={selected.has(k([app, file]))} />
                  </ShortCell>
                  <Table.Cell>
                    {dst_context.apps[app][0]} {dst_context.apps[app][2]}
                  </Table.Cell>
                </Table.Row>,
                ...stanzas.map(
                  (
                    [stanza, attrs] // Stanza Row with expansion
                  ) => {
                    const key = k([app, file, stanza]);
                    const on = selected.has(key);
                    const src = src_config[file]?.[app]?.[stanza];
                    const dst = dst_config[file]?.[app]?.[stanza];

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
