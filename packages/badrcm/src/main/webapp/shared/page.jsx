import layout from "@splunk/react-page";
import ToastMessages from "@splunk/react-toast-notifications/ToastMessages";
import { AnimationToggleProvider } from "@splunk/react-ui/AnimationToggle";
import Button from "@splunk/react-ui/Button";
import Link from "@splunk/react-ui/Link";
import Modal from "@splunk/react-ui/Modal";
import P from "@splunk/react-ui/Paragraph";
import { getUserTheme } from "@splunk/splunk-utils/themes";
import variables from "@splunk/themes/variables";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient, removeOldestQuery } from "@tanstack/react-query-persist-client";
//import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { compress, decompress } from "lz-string";
import React, { useState } from "react";
import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
    body {
        background-color: ${variables.backgroundColorPage};
        color: blue;
    }
`;

const Disclaimer = () => {
  const [open, setOpen] = useState(!window.localStorage.getItem("BADRCM_disclaimer"));

  const close = () => {
    console.log("Accepted Disclaimer");
    setOpen(false);
    window.localStorage.setItem("BADRCM_disclaimer", Date.now());
  };
  return (
    <Modal open={open} initialFocus="container" style={{ width: "600px" }}>
      <Modal.Header title="Disclaimer" />
      <Modal.Body>
        <P>
          This application is offered under the Splunk general terms for third party applications avaliable at{" "}
          <Link to="https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party" openInNewContext>
            https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party
          </Link>
        </P>
        <P>
          Brett Adams' Dangerous REST Configuration Manager (BADRCM) allows administrators to read, write, and modify Splunk configuration to the fullest extent
          of your account and the authentication tokens it's configured with.
        </P>
        <P>
          Changes can result in serious issues such as platform issues, data loss, or complete outages. You are responsible for the changes you make, and should
          understand the implications.
        </P>
        <P>Splunk are not responsible for outages you cause, and you should always engage Splunk Cloud Support to assist with major changes in Splunk Cloud.</P>
        <P>
          By default all users with the admin or sc_admin role on this Search Head have access to this application, it's tokens, and the level of access they
          provide.
        </P>
        <P>
          The{" "}
          <Link to="https://bre77.au/" openInNewContext>
            developer of this application
          </Link>{" "}
          accepts no responsibility or liability for damages or downtime that you may incur of any kind.
        </P>
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="secondary" label="Get Me Out Of Here" to="/" />
        <Button appearance="primary" onClick={close} label="I Understand" />
      </Modal.Footer>
    </Modal>
  );
};
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: process.env.NODE_ENV === "production",
      refetchOnWindowFocus: process.env.NODE_ENV === "production",
    },
  },
});

persistQueryClient({
  queryClient,
  persister: createSyncStoragePersister({
    storage: window.localStorage,
    key: "BADRCM_cache",
    retry: removeOldestQuery,
    serialize: (data) => compress(JSON.stringify(data)),
    deserialize: (data) => JSON.parse(decompress(data)),
  }),
});

export default (component, animate = false) =>
  getUserTheme()
    .then((theme) => {
      layout(
        <>
          <GlobalStyle />

          <QueryClientProvider client={queryClient}>
            <AnimationToggleProvider enabled={animate}>{component}</AnimationToggleProvider>
          </QueryClientProvider>
          <ToastMessages />
          <Disclaimer />
        </>,
        { theme }
      );
    })
    .catch((e) => {
      const errorEl = document.createElement("span");
      errorEl.innerHTML = e;
      document.body.appendChild(errorEl);
    });
