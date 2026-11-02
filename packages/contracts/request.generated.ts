// Generated from request.schema.json. Run pnpm contracts.
export interface RequestRow {
  request_id: string;
  title: string;
  department: "operations" | "finance" | "support";
  amount: number;
}
