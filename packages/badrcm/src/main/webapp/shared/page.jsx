import React, { useState } from "react";
import { createGlobalStyle } from "styled-components";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { persistQueryClient, removeOldestQuery } from "@tanstack/react-query-persist-client";
import { compress, decompress } from "lz-string";

// Shared
import { options } from "./helpers";

// Splunk UI
import layout from "@splunk/react-page";
import ToastMessages from "@splunk/react-toast-notifications/ToastMessages";
import Button from "@splunk/react-ui/Button";
import Link from "@splunk/react-ui/Link";
import Modal from "@splunk/react-ui/Modal";
import P from "@splunk/react-ui/Paragraph";
import { getUserTheme } from "@splunk/splunk-utils/themes";
import variables from "@splunk/themes/variables";
import Progress from "@splunk/react-ui/Progress";

// Theme based background colour
const GlobalStyle = createGlobalStyle`
    body {
        background-color: ${variables.backgroundColorPage};
    }
`;

// The disclaimer to make Splunk happy
const Disclaimer = () => {
  const [open, setOpen] = useState(!window.localStorage.getItem("BADRCM_disclaimer"));

  const close = () => {
    console.log("Accepted Disclaimer");
    setOpen(false);
    window.localStorage.setItem("BADRCM_disclaimer", Date.now());
  };
  // prettier-ignore
  return (
    <Modal open={open} initialFocus="container" style={{ width: "600px" }}>
      <Modal.Header title="Disclaimer" />
      <Modal.Body>
        <P>
          This application is offered under the Splunk general terms for third party applications avaliable at <Link to="https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party" openInNewContext>https://www.splunk.com/en_us/legal/splunk-general-terms.html#third-party</Link>
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
          The <Link to="https://bre77.au/" openInNewContext>developer of this application</Link> accepts no responsibility or liability for damages or downtime that you may incur of any kind.
        </P>
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="secondary" label="Get Me Out Of Here" to="/" />
        <Button appearance="primary" onClick={close} label="I Understand" />
      </Modal.Footer>
    </Modal>
  );
};

// Global isFetching bar
const Loading = () => {
  const isFetching = useIsFetching();
  return isFetching ? <Progress percentage={100} /> : <div style={{ height: "3px" }}></div>;
};

// Setup the query client with defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: false, //process.env.NODE_ENV === "production",
      refetchOnMount: true,
      staleTime: 15000,
      //refetchOnWindowFocus: process.env.NODE_ENV === "production",
    },
  },
});

// If enabled, setup LocalStorage cache with compression
if (options.localcache) {
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
}

// Return the page
export default (component) =>
  getUserTheme()
    .then((theme) => {
      layout(
        <>
          <GlobalStyle />
          <QueryClientProvider client={queryClient}>
            <Loading />
            {component}
            <ReactQueryDevtools />
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
