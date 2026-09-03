# Template: Create Thin Express Route

## Purpose

Create a new Express route handler that matches the existing TundraBoard router style.

## Variables

- `{{ROUTE_NAME}}`: The exported router name to create or update
- `{{HTTP_METHOD}}`: The HTTP method for the new handler
- `{{PATH}}`: The route path to register
- `{{SOURCE_FILES}}`: The relevant route, app, or service files
- `{{EXISTING_EXAMPLE}}`: One existing route in the repo to copy conventions from
- `{{BEHAVIOUR}}`: The expected behaviour and response shape
- `{{ERROR_CASES}}`: Required errors, status codes, and messages

## Prompt

You are implementing a thin Express route for TundraBoard.

Use the existing route example below as the convention reference:

{{EXISTING_EXAMPLE}}

Relevant source files:

{{SOURCE_FILES}}

Create `{{ROUTE_NAME}}` with a `{{HTTP_METHOD}} {{PATH}}` handler that follows the same router style, async pattern, and JSON response conventions as the example.

Requirements:

{{BEHAVIOUR}}

Handle these error cases explicitly:

{{ERROR_CASES}}

Keep the route thin: validate input, call the service layer if needed, and return the response.

## Expected Output

A route implementation snippet or file that matches the repository style, with clear status codes and no invented framework patterns.

## Notes

- Use this when the route should remain small and conventional
- Include one existing route example or the model will guess at style
- If request validation is needed, prefer explicit runtime validation over `as` casts
