/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE extraction_jobs
    DROP CONSTRAINT IF EXISTS extraction_jobs_status_check;

    UPDATE extraction_jobs
    SET status = CASE
      WHEN status = 'PENDING' THEN 'QUEUED'
      WHEN status = 'PROCESSING' THEN 'RUNNING'
      WHEN status = 'COMPLETED' THEN 'DONE'
      ELSE status
    END;

    ALTER TABLE extraction_jobs
    ALTER COLUMN status SET DEFAULT 'QUEUED';

    ALTER TABLE extraction_jobs
    ADD CONSTRAINT extraction_jobs_status_check
    CHECK (status in ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'NEEDS_REVIEW'));
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE extraction_jobs
    DROP CONSTRAINT IF EXISTS extraction_jobs_status_check;

    UPDATE extraction_jobs
    SET status = CASE
      WHEN status = 'QUEUED' THEN 'PENDING'
      WHEN status = 'RUNNING' THEN 'PROCESSING'
      WHEN status = 'DONE' THEN 'COMPLETED'
      ELSE status
    END;

    ALTER TABLE extraction_jobs
    ALTER COLUMN status SET DEFAULT 'PENDING';

    ALTER TABLE extraction_jobs
    ADD CONSTRAINT extraction_jobs_status_check
    CHECK (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW'));
  `);
};
