/** Formato único de error de la API. */
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly issues?: readonly { field: string; message: string }[];
  readonly requestId: string;
}
