import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchGet } from "./fetch";

const BASE_CONTEXT = { apps: {}, files: [], realname: null, roles: [], username: null, users: {} };

export const useServers = (options = {}) => useQuery(["servers"], () => fetchGet("servers"), { placeholderData: [], ...options });
export const useContext = (server, options = {}) =>
  useQuery(["servers", server || null], () => (server ? fetchGet("servers", { server }) : BASE_CONTEXT), options);

export const useContexts = (servers, options = {}) =>
  useQueries({
    queries: servers.map((server) =>
      server
        ? {
            queryKey: ["servers", server],
            queryFn: () => fetchGet("servers", { server }),
            ...options,
          }
        : { queryKey: ["servers", null], queryFn: () => Promise.resolve(null) }
    ),
  });

export const useConfigs = (columns, files, options = {}) =>
  useQueries({
    queries: files.flatMap((file) =>
      columns.map(({ server, appcontext, usercontext }) =>
        server
          ? {
              queryKey: ["configs", server, file, appcontext, usercontext],
              queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
              ...options,
            }
          : { queryKey: ["configs", null], queryFn: () => Promise.resolve(null) }
      )
    ),
  });
