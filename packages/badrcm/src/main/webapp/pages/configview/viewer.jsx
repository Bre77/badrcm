import { smartTrim } from "@splunk/ui-utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { debounce } from "lodash";
import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";

// Shared
import { isort0, latest, nosort, options } from "../../shared/helpers";
import { useQueriesConfig } from "../../shared/hooks";
import { Actions, AttributeSpan, CreateLink, RedFlag, ShortCell, StanzaSpan, StyledContainer, SwitchSpinner, TallCell, TextSpinner } from "../../shared/styles";

// Splunk UI

import Button from "@splunk/react-ui/Button";
import CollapsiblePanel from "@splunk/react-ui/CollapsiblePanel";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
import Typography from "@splunk/react-ui/Typography";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";

const sort = options.sort ? isort0 : undefined;

export default ({ apps, files, columns }) => {
  const configs = useQueriesConfig(columns, files);

  const table = useMemo(() => {
    console.debug("Expensive Config Table");
    const count = columns.length;
    const x = configs.reduce((x, { data }, y) => {
      if (!data) return x;
      const z = y % count; // Column Index
      const file = files[~~(y / count)]; // File

      return Object.entries(data).reduce((x, [app, stanzas]) => {
        if (apps.length !== 0 && !apps.includes(app)) return x;
        const key = `${app}|${file}`;
        x[key] ||= { app, file, stanzas: {} };

        x[key].stanzas = Object.entries(stanzas).reduce((x, [stanza, content]) => {
          x[stanza] ||= { attr: {}, cols: Array(count).fill(false) };
          x[stanza].cols[z] = true;
          x[stanza].key = `${app}|${file}|${stanza}`;
          x[stanza].attr = Object.entries(content.attr).reduce((x, [attr, value]) => {
            x[attr] ||= Array(count).fill(null);
            x[attr][z] = value;
            return x;
          }, x[stanza]);
          return x;
        }, x[key].stanzas);
        return x;
      }, x);
    }, {});

    return Object.entries(x)
      .sort(sort)
      .map(([key, { app, file, stanzas }]) => [
        key,
        app,
        file,
        Object.entries(stanzas)
          .sort(sort)
          .reduce((out, [stanza, { attr, cols, key }]) => {
            const attrs = Object.entries(attr).sort(sort);
            cols.forEach((present, z) => {
              out[z] = out[z].concat(
                present && <StanzaSpan key={key}>[{stanza}]</StanzaSpan>,
                <br key={key + "."} />,
                ...attrs.map(([attr, values]) => [
                  !!present && values[z] !== null && (
                    <>
                      <AttributeSpan key={key + z}>{attr}</AttributeSpan> = {values[z]}
                    </>
                  ),
                  <br />,
                ]),
                <br />
              );
            });
            return out;
          }, Array(count).fill([])),
        //.map((c) => c.join(<br />)),
      ]);
  }, [latest(configs), apps]);

  const download = (_, { value: z }) => {
    const column = columns[z];
    const count = columns.length;
    return files
      .reduce((zip, file, x) => {
        const index = x * count + z;
        return Object.entries(configs[index].data)
          .filter(([app]) => apps.length === 0 || apps.includes(app))
          .reduce((zip, [app, stanzas]) => {
            const content = Object.entries(stanzas)
              .flatMap(([stanza, { attr }]) => {
                return [`[${stanza}]`, ...Object.entries(attr).map(([k, v]) => `${k} = ${v}`), ""];
              })
              .join("\n");
            zip.file(`${app}/${file}.conf`, content);
            return zip;
          }, zip);
      }, new JSZip())
      .generateAsync({ type: "blob" })
      .then((blob) => {
        const link = document.createElement("a");
        link.download = `${column.server}.zip`;
        link.href = URL.createObjectURL(blob);
        link.click();
      });
  };

  return (
    <>
      <ColumnLayout>
        <ColumnLayout.Row>
          <ColumnLayout.Column></ColumnLayout.Column>
          {columns.map((column, z) => (
            <ColumnLayout.Column key={z}>
              <Button inline={false} disabled={configs.isLoading} appearance="primary" value={z} onClick={download}>
                {configs.isLoading ? <WaitSpinner /> : "Download Everything"}
              </Button>
            </ColumnLayout.Column>
          ))}
        </ColumnLayout.Row>
      </ColumnLayout>
      <br />
      {table.map(([key, app, file, cols]) => (
        <CollapsiblePanel key={key} title={`${app} / ${file}.conf`}>
          <ColumnLayout>
            <ColumnLayout.Row>
              <ColumnLayout.Column></ColumnLayout.Column>
              {cols.map((col, z) => (
                <ColumnLayout.Column key={z}>
                  <Typography as="p" variant="monoBody">
                    {col}
                  </Typography>
                </ColumnLayout.Column>
              ))}
            </ColumnLayout.Row>
          </ColumnLayout>
        </CollapsiblePanel>
      ))}
    </>
  );
};
