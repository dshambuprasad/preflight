// Typed client over the generated OpenAPI types. apps/web never builds a URL by hand (16 §2.6).
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { components, paths } from './openapi.js';

export type { components, paths };
export type Schemas = components['schemas'];

export type VersionSummary = Schemas['VersionSummary'];
export type VersionDetail = paths['/versions/{id}']['get']['responses']['200']['content']['application/json'];
export type EvaluationDetail = paths['/evaluations/{id}']['get']['responses']['200']['content']['application/json'];
export type Finding = EvaluationDetail['findings'][number];
export type Campaign = paths['/campaigns']['post']['responses']['201']['content']['application/json'];
export type CampaignListItem = paths['/campaigns']['get']['responses']['200']['content']['application/json']['items'][number];
export type CampaignDetail = paths['/campaigns/{id}']['get']['responses']['200']['content']['application/json'];
export type CreateVersionBody = NonNullable<paths['/campaigns/{id}/versions']['post']['requestBody']>['content']['application/json'];
export type CreateCampaignBody = NonNullable<paths['/campaigns']['post']['requestBody']>['content']['application/json'];
export type Me = paths['/me']['get']['responses']['200']['content']['application/json'];
export type Problem = Schemas['Problem'];
export type RulebookInfo = paths['/rulebook']['get']['responses']['200']['content']['application/json'];
export type RuleListItem = paths['/rulebook/rules']['get']['responses']['200']['content']['application/json']['items'][number];

export function createApiClient(options: ClientOptions = {}) {
  return createClient<paths>({
    baseUrl: '/v1',
    credentials: 'include',
    headers: { 'x-requested-with': 'preflight' },
    ...options,
  });
}
export type ApiClient = ReturnType<typeof createApiClient>;
