import type { PostgrestError } from "@supabase/supabase-js";

/** PostgREST default max rows per request (Supabase Cloud). */
export const SUPABASE_MAX_ROWS_PER_PAGE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

/**
 * Fetches every row from a paginated Supabase query by advancing `.range()` windows
 * until a short page is returned.
 */
export async function fetchAllSupabaseRows<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(
      offset,
      offset + SUPABASE_MAX_ROWS_PER_PAGE - 1
    );
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < SUPABASE_MAX_ROWS_PER_PAGE) {
      return rows;
    }

    offset += SUPABASE_MAX_ROWS_PER_PAGE;
  }
}
