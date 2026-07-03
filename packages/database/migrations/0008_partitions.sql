BEGIN;

CREATE OR REPLACE FUNCTION core.create_next_message_partition()
RETURNS VOID AS $$
DECLARE
  v_next_month DATE;
  v_partition_name TEXT;
  v_start_date TEXT;
  v_end_date TEXT;
BEGIN
  v_next_month := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
  v_partition_name := 'messages_' || TO_CHAR(v_next_month, 'YYYY_MM');
  v_start_date := TO_CHAR(v_next_month, 'YYYY-MM-DD');
  v_end_date := TO_CHAR(v_next_month + INTERVAL '1 month', 'YYYY-MM-DD');

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS core.%I PARTITION OF core.messages FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    v_start_date,
    v_end_date
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION admin.create_next_audit_log_partition()
RETURNS VOID AS $$
DECLARE
  v_next_month DATE;
  v_partition_name TEXT;
  v_start_date TEXT;
  v_end_date TEXT;
BEGIN
  v_next_month := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
  v_partition_name := 'audit_log_' || TO_CHAR(v_next_month, 'YYYY_MM');
  v_start_date := TO_CHAR(v_next_month, 'YYYY-MM-DD');
  v_end_date := TO_CHAR(v_next_month + INTERVAL '1 month', 'YYYY-MM-DD');

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS admin.%I PARTITION OF admin.audit_log FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    v_start_date,
    v_end_date
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION core.archive_old_message_partition(p_months_old INTEGER DEFAULT 3)
RETURNS VOID AS $$
DECLARE
  v_cutoff_month DATE;
  v_partition_name TEXT;
BEGIN
  v_cutoff_month := DATE_TRUNC('month', NOW() - (p_months_old || ' months')::INTERVAL);
  v_partition_name := 'messages_' || TO_CHAR(v_cutoff_month, 'YYYY_MM');

  IF to_regclass(format('core.%I', v_partition_name)) IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE core.messages DETACH PARTITION core.%I', v_partition_name);
  EXECUTE format('ALTER TABLE core.%I SET SCHEMA archive', v_partition_name);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_month DATE;
  v_partition_name TEXT;
  v_start_date TEXT;
  v_end_date TEXT;
BEGIN
  FOR i IN 0..6 LOOP
    v_month := DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL);
    v_partition_name := 'messages_' || TO_CHAR(v_month, 'YYYY_MM');
    v_start_date := TO_CHAR(v_month, 'YYYY-MM-DD');
    v_end_date := TO_CHAR(v_month + INTERVAL '1 month', 'YYYY-MM-DD');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS core.%I PARTITION OF core.messages FOR VALUES FROM (%L) TO (%L)',
      v_partition_name,
      v_start_date,
      v_end_date
    );
  END LOOP;

  CREATE TABLE IF NOT EXISTS core.messages_default PARTITION OF core.messages DEFAULT;
END $$;

DO $$
DECLARE
  v_month DATE;
  v_partition_name TEXT;
  v_start_date TEXT;
  v_end_date TEXT;
BEGIN
  FOR i IN 0..6 LOOP
    v_month := DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL);
    v_partition_name := 'audit_log_' || TO_CHAR(v_month, 'YYYY_MM');
    v_start_date := TO_CHAR(v_month, 'YYYY-MM-DD');
    v_end_date := TO_CHAR(v_month + INTERVAL '1 month', 'YYYY-MM-DD');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS admin.%I PARTITION OF admin.audit_log FOR VALUES FROM (%L) TO (%L)',
      v_partition_name,
      v_start_date,
      v_end_date
    );
  END LOOP;

  CREATE TABLE IF NOT EXISTS admin.audit_log_default PARTITION OF admin.audit_log DEFAULT;
END $$;

COMMIT;

