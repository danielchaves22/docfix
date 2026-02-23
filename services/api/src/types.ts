export type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'NEEDS_REVIEW' | 'FAILED';

export interface AuthPrincipal {
  tenantId: string;
  subject: string;
  rawToken: string;
}

export interface ErrorResponse {
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
}
