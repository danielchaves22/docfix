export type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "NEEDS_REVIEW" | "FAILED";

export type RequestedBy = {
  userId?: string;
  email?: string;
  displayName?: string;
  sourceApp?: string;
};

export type CreateJobResponse = {
  jobId: string; // uuid
  status: JobStatus;
};

export type JobInfoResponse = {
  jobId: string; // uuid
  status: JobStatus;
  schemaId: string;
  schemaVersion: number;
  confidenceScore?: number | null;
  selectedTemplate?: { templateId: string; templateVersion: number } | null;
  createdAt: string; // date-time
  finishedAt?: string | null;
  links?: { result?: string | null; exportXlsx?: string | null };
};
