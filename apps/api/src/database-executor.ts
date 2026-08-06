export type DbExecutor = {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
};
