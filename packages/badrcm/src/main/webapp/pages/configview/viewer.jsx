import { smartTrim } from "@splunk/ui-utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { debounce } from "lodash";
import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";

// Shared
import { restChange } from "../../shared/fetch";
import { isort0, latest, wrapSetValue } from "../../shared/helpers";
import { useConfig, useConfigs, useContext, useContexts, useMutateConfig } from "../../shared/hooks";
import { Actions, AttributeSpan, CreateLink, RedFlag, ShortCell, StanzaSpan, StyledContainer, SwitchSpinner, TallCell, TextSpinner } from "../../shared/styles";

// Splunk UI

import Clickable from "@splunk/react-ui/Clickable";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";
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

export default ({ apps, files, columns }) => {
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
        if (apps.length !== 0 && !apps.includes(app)) return x;
        const key = `${app}|${file}`;
        x[key] ||= { app, file, stanzas: {} }; //! WIP HERE

        x[key].stanzas = Object.entries(stanzas).reduce((x, [stanza, content]) => {
          x[stanza] ||= {}

          x[stanza].attr = Object.entries(content.attr).reduce((x, [attr, value]) => {
            x[attr] ||= {
              cols: Array(count).fill(),
              diff: false,
              text: false,
            };

            x[attr].cols[z] = value;
            x[attr].text ||= typeof value === "string";
            return x;
          }, x[stanza].attr);
          return x;
        }, x[key].stanzas);
        return x;
      }, x);
    }, {});

  return (
    <ColumnLayout divider="vertical">
      <ColumnLayout.Row>
        <ColumnLayout.Column>A</ColumnLayout.Column>
      </ColumnLayout.Row>
    </ColumnLayout>
  );
};
