# Workflow: Create ETL for bronze to silver conversion of new dataset

## Trigger

Use this flow when cleaning up and transforming a new dataset from raw (bronze) into silver.

## Prerequisites

There's a new file or set of files structured by a directory or naming pattern which can be used to load the new data and create a Dagster pipeline defining a schemas (classes) in python with pydantic, and appling common cleanup steps.

## Steps

1. Data loading:
   Load data with this pattern [pattern] for the following stages. Use these files [copy list of files] as representative examples to build the data classes and schema definitions.

2. Data analysis and feedback loop with engineer:
   Analyise the representative examples to determine data patterns (leading and trailing zeros, empty/NaN/Null fields) and data types to perform common cleanup activities.

3. Data transformation:
   Implement cleanup stages in file `transformations.py`. Take inspirection from this implementation [copy example] and use the methods defined in `/helpers` to perform standardized data manipulation.

4. Data Test Implementation:
   Use this example output [copy output] for this input file [copy input], to validate that the pipeline correctly loads and transforms the data.

## Verification Checklist

- [ ] Execute the test and ensure that the example input leads to the example output
