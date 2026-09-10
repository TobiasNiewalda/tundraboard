# Workflow: Requirement test generation

## Trigger

A team of risk management experts, customer experts and system expert defines and refines system, sub-system and requirement tests for the application. The new requirement can be queried from our requirement management system's API. When there is a new requirement item, the a couple of end-to-end test scenarios should be implemented as guardrails (TDD logic) for the following design and development stages.

## Prerequisites

The requirement item must exist and be in status approved. This means that the item has moved from a suggestion or review into a "ready for development" phase. The management team has then then agreed on the exact requirement and set the context within the "description" field of the API response.
These requirements are always written as "something that should be working in a specific way from the user's perspective" and not as "how something should be implemented". Furthermore, it is important that the test is implemented with a GIVEN-WHEN-THEN logic in the local `tests/e2e` directory with the there defined playwright and cucumber frameworks. There are helpers and hooks which simplify recurring test complexity.
! A detailled list will be added here once the tools have been refined.
It is important to state that this test is expected to fail at this stage, as the implementation will only start after the test has been created.

## Steps

    Requirements specification (Slot 3, CoT): "Think about what solutions are imaginable, common and secure to solve the stated requirement. Consider: fields, validation, error cases, authorisation, response format. Context: []."

    Solution match (CoT): "Think which of these solutions match the context of this device and existing implementation patterns."

    Implementation (Slot 1, few-shot): "Here is an existing test implementation: [paste example]. Generate the [new test] following the same patterns."

    Error handling review (Slot 1, CoT): "Review this test. Think through every way it could fail (e.g. timeouts, connectivity issues, timing problems, test parallelization and cleanup stages) and verify each failure case is handled. The test is not expected to pass at this point."

## Verification Checklist

- [ ] Execute the playwright tests and ensure the test is listed in the test report.
- [ ] Execute the playwright tests and ensure the test is marked as failed listed in the test report.
