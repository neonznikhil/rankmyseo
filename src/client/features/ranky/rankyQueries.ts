import { queryOptions } from "@tanstack/react-query";
import { queryClient } from "@/client/tanstack-db";
import { listRankySessions } from "@/serverFunctions/ranky";

export const rankySessionsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: ["rankySessions", projectId],
    queryFn: () => listRankySessions({ data: { projectId } }),
  });

export function invalidateRankySessions(projectId: string) {
  void queryClient.invalidateQueries({
    queryKey: ["rankySessions", projectId],
  });
}
