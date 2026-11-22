declare module 'node:sqlite' {
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    all(...namedOrPositionalParams: unknown[]): Record<string, unknown>[];
    get(...namedOrPositionalParams: unknown[]): Record<string, unknown> | undefined;
    run(...namedOrPositionalParams: unknown[]): StatementResultingChanges;
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean; allowExtension?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
