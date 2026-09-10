Trigger: You need to create a new REST endpoint for TundraBoard.

Context checklist:

    The Prisma model for the resource (or schema definition)
    One existing endpoint in the project as a convention example
    Any validation rules specific to this resource
    Authorisation requirements (who can access this endpoint?)

Prompt sequence:

    Requirements specification (Slot 3, CoT): "Think step by step about what a [METHOD] /[resource] endpoint needs. Consider: fields, validation, error cases, authorisation, response format. Context: [paste schema and requirements]."

    Implementation (Slot 1, few-shot): "Here is an existing endpoint: [paste example]. Generate the [new resource] endpoint following the same patterns."

    Error handling review (Slot 1, CoT): "Review this endpoint. Think through every way it could fail and verify each failure case is handled."

    Security review (Slot 3, role): "As a security engineer, review this endpoint for OWASP Top 10 vulnerabilities."

Verification:

    All generated code compiles without errors
    Tests cover the happy path and at least three error cases
    No hardcoded values or missing environment variables
    Security review findings addressed
