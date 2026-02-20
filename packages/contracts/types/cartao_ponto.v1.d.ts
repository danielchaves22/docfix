export type CartaoPontoV1 = {
  schemaId: "CARTAO_PONTO";
  schemaVersion: 1;
  jobId: string; // uuid
  extractedAt: string; // date-time
  timezone?: string;

  employee?: {
    name?: string;
    documentId?: string;
    employerName?: string;
  };

  period?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
  };

  days: Day[];

  summary?: {
    totalDays?: number;
    daysWithIssues?: number;
  };
};

export type Day = {
  date: string; // YYYY-MM-DD
  punches: Punch[];
  notes?: string;
  dayConfidence?: number; // 0..1
  issues?: Issue[];
};

export type Punch = {
  time: string; // HH:MM
  type: "IN" | "OUT" | "UNKNOWN";
  source?: Source;
};

export type Source = {
  page?: number;
  bbox?: [number, number, number, number];
  textSnippet?: string;
};

export type Issue = {
  code: string;
  severity: "ERROR" | "WARN";
  message: string;
};
