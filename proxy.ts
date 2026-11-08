import { auth } from "./lib/auth/server";
export default auth.middleware({
    loginUrl: "/auth/sign-in",
    publicRoutes: [
        "/",
        "/terms",
        "/privacy",
        "/developers",
        "/api",
        "/account/delete",
        "/robots.txt",
        "/sitemap.xml",
        "/opengraph-image",
    ],
});
// Attachment handlers check the session themselves. Keep multipart bodies out
// of the page proxy so upload streams are not cloned before the handler reads them.
// Public homepage media and cursor images must load for signed-out visitors.
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|icon.svg|favicon.ico|media/|cursors/|api/health|api/attachments|api/profile-picture|api/v1(?:/|$)).*)",
    ],
};
