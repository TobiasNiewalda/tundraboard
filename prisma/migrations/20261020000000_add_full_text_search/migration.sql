-- Add search_vector column as a generated column
ALTER TABLE "tasks" 
ADD COLUMN "search_vector" tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, (COALESCE(title, ''::character varying))::text), 'A'::"char") || 
  setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char")
) STORED;

-- Create GIN index for full-text search
CREATE INDEX "tasks_search_vector_idx" ON "tasks" USING GIN ("search_vector");
