// Values the integration global setup hands to test files via `inject()`.
export {};

declare module "vitest" {
  export interface ProvidedContext {
    supabaseUrl: string;
    supabaseAnonKey: string;
    dbUrl: string;
    baseUrl: string;
  }
}
