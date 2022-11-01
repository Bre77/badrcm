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
      return {
        queryKey: ["servers", server],
        queryFn: () => fetchGet("servers", { server }),
        initialData: BASE_CONTEXT,
        ...options,
      };
    }),
  });
};

export const useServerConfigs = (files, columns, options = {}) => {
  return useQueries({
    queries: columns.flatMap(({ server, appcontext, usercontext }) =>
      files.map((file) => {
        return {
          queryKey: ["configs", server, file, appcontext, usercontext],
          queryFn: () => fetchGet("servers", { server, app: appcontext, user: usercontext, file }),
          initialData: BASE_CONTEXT,
          ...options,
        };
      })
    ),
  });
};
