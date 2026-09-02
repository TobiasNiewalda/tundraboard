# Workflow: Draft ETL for a New Dataset

## Trigger
Use this workflow when a new raw dataset needs to be loaded, profiled, cleaned, and transformed from bronze to silver.

## Prerequisites/Context
- Representative source files or rows
- The expected raw file pattern or directory pattern
- The target schema and output shape
- Existing pipeline and helper examples
- A sample input/output pair for validation

## Prompt sequence
1. **Data profiling** — **Tool slot:** Slot 3. **Pattern:** CoT
   Prompt: `Think step by step about the data patterns in <SAMPLE_ROWS_OR_FILES>. Identify types, null/empty values, leading or trailing zeros, malformed fields, and any cleanup rules that appear necessary.`

2. **Schema and loader drafting** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Here is a similar ingestion pipeline: <PASTE EXAMPLE>. Generate the schema and loading code for <DATASET_NAME> using the same conventions, helpers, and naming style.`

3. **Transformation implementation** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Using this example transformation: <PASTE EXAMPLE>, implement the cleanup and transformation logic for <DATASET_NAME>. Reuse the project helpers and keep the code aligned with existing pipeline structure.`

4. **Test design and review** — **Tool slot:** Slot 3. **Pattern:** CoT
   Prompt: `Design the minimum test from <INPUT_EXAMPLE> to <OUTPUT_EXAMPLE>. Verify that the cleanup rules are correctly applied and call out any edge cases the test should cover.`

## Verification checklist
- [ ] The dataset loads from the intended path or pattern
- [ ] The schema matches the actual source structure
- [ ] Cleanup rules are implemented in the transformation stage
- [ ] A representative input produces the expected output
- [ ] The pipeline test passes
