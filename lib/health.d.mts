export function liveness(): Response;
export function readiness(
    request: Request,
    options: { secret?: string; probe: () => Promise<unknown> },
): Promise<Response>;
