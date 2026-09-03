# Template: Create Service-Layer Method

## Purpose

Create a new service function that encapsulates TundraBoard business logic and Prisma access.

## Variables

- `{{METHOD_NAME}}`: The service function name
- `{{INPUT_TYPE}}`: The input type or shape the function accepts
- `{{RETURN_TYPE}}`: The expected return type
- `{{RELATED_MODELS}}`: Prisma models or domain types involved
- `{{EXAMPLE_FUNCTION}}`: One existing service method to mirror
- `{{BEHAVIOUR}}`: The business rules and output expectations
- `{{ERROR_CONTRACT}}`: The error conditions and messages to preserve

## Prompt

You are adding a new service-layer method for TundraBoard.

Follow the style of this existing service function:

{{EXAMPLE_FUNCTION}}

Create `{{METHOD_NAME}}` with input type `{{INPUT_TYPE}}` and return type `{{RETURN_TYPE}}`.

The function should work with these models or domain types:

{{RELATED_MODELS}}

Business rules:

{{BEHAVIOUR}}

Error contract:

{{ERROR_CONTRACT}}

Keep the logic in the service layer, avoid route concerns, and make the function easy to test.

## Expected Output

A typed exported service function plus any small helper types needed for clarity.

## Notes

- Include the relevant Prisma model or the function may invent fields
- Use this for data access and business rules, not for HTTP handling
- If the function raises not-found cases, keep the message stable for route handlers
