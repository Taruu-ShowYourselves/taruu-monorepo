export { ApiClient, ApiError, initializeApiClient, getApiClient } from './client';
export type { ApiClientConfig } from './client';

// Functional, contract-validated client — preferred for new code.
export { createApi } from './create-api';
export type { Api, ApiFailure, CreateApiConfig } from './create-api';

export { votesApi } from './votes';
export { usersApi } from './users';
export { paymentsApi } from './payments';
export { authApi } from './auth';
export { verificationApi } from './verification';
export { bagsApi } from './bags';
export { notificationsApi } from './notifications';
export { newsletterApi } from './newsletter';
export { nftApi } from './nft';
export { phoneApi } from './phone';
