// Re-export API client and config so existing imports from '../lib/api' keep working.
export { getApiUrl } from './apiConfig';
export type { ApiResponse } from './apiClient';
export {
  apiClient,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiRequest,
} from './apiClient';
