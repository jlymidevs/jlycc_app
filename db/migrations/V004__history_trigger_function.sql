-- Generic trigger to record a history row when watched columns change.
-- Configured per-table via trigger arguments:
--   TG_ARGV[0] = history table (e.g. 'membership.lifecycle_stage_history')
--   TG_ARGV[1] = parent FK column on history table (e.g. 'member_id')
--   TG_ARGV[2] = comma-separated list of "watched_col:from_col:to_col" mappings
--                (e.g. 'current_stage:from_stage:to_stage')
--
-- Each trigger creation specifies which columns to watch and where to write the
-- before/after values in the history table.
CREATE OR REPLACE FUNCTION public.record_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  history_table text := TG_ARGV[0];
  parent_fk_col text := TG_ARGV[1];
  mappings text := TG_ARGV[2];
  mapping text;
  parts text[];
  watched_col text;
  from_col text;
  to_col text;
  old_val text;
  new_val text;
  cols text := parent_fk_col;
  vals text;
  parent_pk_value text;
BEGIN
  -- Resolve parent PK value from NEW
  EXECUTE format('SELECT ($1).%I::text', TG_TABLE_NAME || '_id')
    INTO parent_pk_value
    USING NEW;
  vals := quote_literal(parent_pk_value);

  FOREACH mapping IN ARRAY string_to_array(mappings, ',')
  LOOP
    parts := string_to_array(mapping, ':');
    watched_col := parts[1];
    from_col := parts[2];
    to_col := parts[3];

    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', watched_col, watched_col)
      INTO old_val, new_val
      USING OLD, NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      cols := cols || ', ' || from_col || ', ' || to_col || ', changed_at';
      vals := vals || ', '
              || COALESCE(quote_literal(old_val), 'NULL') || ', '
              || COALESCE(quote_literal(new_val), 'NULL') || ', '
              || quote_literal(now()::text);
      EXECUTE format('INSERT INTO %s (%s) VALUES (%s)', history_table, cols, vals);
      cols := parent_fk_col;
      vals := quote_literal(parent_pk_value);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.record_history() IS
  'Generic AFTER UPDATE trigger; emits a row into a history table when watched columns change. Wire it up via CREATE TRIGGER ... EXECUTE FUNCTION public.record_history(history_table, parent_fk_col, mappings).';
