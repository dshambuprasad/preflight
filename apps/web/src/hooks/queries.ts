import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCampaignBody, CreateVersionBody } from '@preflight/api-types';
import { api, unwrap } from '../api';

export const meQuery = queryOptions({ queryKey: ['me'], queryFn: async () => unwrap(await api.GET('/me')), staleTime: 5 * 60_000, retry: false });
export const campaignsQuery = (filters: { state?: string; mode?: string } = {}) =>
  queryOptions({
    queryKey: ['campaigns', filters],
    queryFn: async () => unwrap(await api.GET('/campaigns', { params: { query: { state: filters.state as never, mode: filters.mode as never, limit: 100 } } })),
  });
export const campaignQuery = (id: string) => queryOptions({ queryKey: ['campaign', id], queryFn: async () => unwrap(await api.GET('/campaigns/{id}', { params: { path: { id } } })) });
export const versionQuery = (id: string) => queryOptions({ queryKey: ['version', id], queryFn: async () => unwrap(await api.GET('/versions/{id}', { params: { path: { id } } })) });
export const evaluationsQuery = (versionId: string) => queryOptions({ queryKey: ['evaluations', versionId], queryFn: async () => unwrap(await api.GET('/versions/{id}/evaluations', { params: { path: { id: versionId } } })) });
export const evaluationQuery = (id: string) => queryOptions({ queryKey: ['evaluation', id], queryFn: async () => unwrap(await api.GET('/evaluations/{id}', { params: { path: { id } } })), staleTime: Infinity });
export const rulesQuery = queryOptions({ queryKey: ['rules'], queryFn: async () => unwrap(await api.GET('/rulebook/rules')), staleTime: Infinity });

export function useMe() {
  return useQuery(meQuery);
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCampaignBody) => unwrap(await api.POST('/campaigns', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, body }: { campaignId: string; body: CreateVersionBody }) => unwrap(await api.POST('/campaigns/{id}/versions', { params: { path: { id: campaignId } }, body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useEvaluate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, asOf }: { versionId: string; asOf?: string }) => unwrap(await api.POST('/versions/{id}/evaluate', { params: { path: { id: versionId } }, body: asOf ? { asOf } : {} })),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['version', v.versionId] });
      void qc.invalidateQueries({ queryKey: ['evaluations', v.versionId] });
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const r = await api.POST('/auth/session', { body });
      if (r.response.status !== 204) unwrap(r);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { await api.DELETE('/auth/session'); },
    onSuccess: () => qc.clear(),
  });
}

/** Data types as the client actually infers them (openapi-fetch drops null-only members such as summary.verdict). */
type Data<Q> = Q extends { queryFn?: infer F } ? Awaited<ReturnType<Extract<F, (...a: never[]) => unknown>>> : never;
export type VersionDetailData = Data<ReturnType<typeof versionQuery>>;
export type EvaluationDetailData = Data<ReturnType<typeof evaluationQuery>>;
