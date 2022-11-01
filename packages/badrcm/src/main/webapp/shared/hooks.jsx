import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchGet } from "./fetch";

const BASE_CONTEXT = { apps: {}, files: [], realname: null, roles: [], username: null, users: {} };

export const useServers = (options = {}) =>
  useQuery(
    ["servers"],
    () => {
      return fetchGet("servers");
    },
    { initialData: [], ...options }
  );

export const useServer = (server, options = {}) =>
  useQuery(["server", server], () => fetchGet("servers", { server }), {
    initialData: BASE_CONTEXT,
    ...options,
  });

export const useServerContexts = (servers, options = {}) => {
  return useQueries({
    queries: servers.map((server) => {
      return server
        ? {
            queryKey: ["servers", server],
            queryFn: () => fetchGet("servers", { server }),
            initialData: BASE_CONTEXT,
            ...options,
          }
        : { queryKey: ["servers", "null"], queryFn: () => Promise.resolve(null) };
    }),
  });
};

export const useServerConfigs = (columns, files, options = {}) => {
  return useQueries({
    queries: files.flatMap((file) =>
      columns.map(({ server, appcontext, usercontext }) => {
        return server
          ? {
              queryKey: ["configs", server, file, appcontext, usercontext],
              queryFn: () => fetchGet("configs", { server, app: appcontext, user: usercontext, file }),
              ...options,
            }
          : { queryKey: ["configs", "null"], queryFn: () => Promise.resolve(null) };
      })
    ),
  });
};
