function endpoint(connection) {
    const target = new URL(connection);
    if (!["postgres:", "postgresql:"].includes(target.protocol))
        throw Error("Invalid database connection protocol.");
    return target.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
}
function assertTestDatabaseTarget(testConnection, productionConnections) {
    const target = endpoint(testConnection);
    if (new URL(testConnection).hostname.includes("-pooler."))
        throw Error("Test migrations require a direct, unpooled database connection.");
    const production = productionConnections.filter(Boolean).map(endpoint);
    if (!production.length)
        throw Error("Cannot confirm test isolation: production connection is missing.");
    if (production.includes(target))
        throw Error("Test migration refused: the test endpoint matches a production endpoint.");
}
module.exports = { assertTestDatabaseTarget };
