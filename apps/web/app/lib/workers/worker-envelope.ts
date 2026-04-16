export interface WorkerRequestEnvelope {
  requestId: number;
}

export interface WorkerSuccessEnvelope {
  requestId: number;
}

export interface WorkerFailureEnvelope<ErrorCode extends string> {
  requestId: number;
  errorCode: ErrorCode;
  error: string;
}
