"use client";
import { useState } from "react";
import { authClient } from "../lib/auth/client";
import type { NotebookUser } from "../lib/use-notebook";
export function ProfilePicture({
    user,
    disabled,
    onSaved,
}: {
    user: NotebookUser | null;
    disabled: boolean;
    onSaved: () => Promise<void>;
}) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    async function upload(file: File) {
        setError("");
        setBusy(true);
        try {
            if (
                !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
                file.size > 5 * 1024 * 1024
            )
                throw Error("Choose a PNG, JPEG, or WebP image up to 5 MB.");
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement("canvas");
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                bitmap.close();
                throw Error("Could not prepare this image.");
            }
            const side = Math.min(bitmap.width, bitmap.height);
            ctx.drawImage(
                bitmap,
                (bitmap.width - side) / 2,
                (bitmap.height - side) / 2,
                side,
                side,
                0,
                0,
                256,
                256,
            );
            bitmap.close();
            const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(
                    (value) =>
                        value ? resolve(value) : reject(Error("Could not prepare this image.")),
                    "image/webp",
                    0.85,
                ),
            );
            const response = await fetch("/api/profile-picture", {
                method: "PUT",
                headers: { "Content-Type": "image/webp", "X-Notebook-User": user!.id },
                body: blob,
            });
            if (!response.ok)
                throw Error((await response.json()).error || "Could not upload this image.");
            const result = await authClient.updateUser({
                image: location.origin + "/api/profile-picture?v=" + crypto.randomUUID(),
            });
            if (result.error) throw Error(result.error.message || "Could not update your profile.");
            await onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not change your picture.");
        } finally {
            setBusy(false);
            window.dispatchEvent(new Event("notebook-storage-changed"));
        }
    }
    async function remove() {
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/profile-picture", {
                method: "DELETE",
                headers: { "X-Notebook-User": user!.id },
            });
            if (!response.ok) throw Error("Could not remove your picture.");
            const result = await authClient.updateUser({ image: null });
            if (result.error) throw Error(result.error.message || "Could not update your profile.");
            await onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Please retry.");
        } finally {
            setBusy(false);
            window.dispatchEvent(new Event("notebook-storage-changed"));
        }
    }
    return (
        <div className="profile-picture-editor">
            <span className="profile-picture-preview">
                {user?.image ? (
                    <img
                        src={user.image}
                        alt="Your profile picture"
                    />
                ) : (
                    <span>{user?.name.slice(0, 1).toUpperCase() || "?"}</span>
                )}
            </span>
            <div>
                <label className="button secondary upload-button">
                    {busy ? "Saving picture…" : "Change picture"}
                    <input
                        aria-label="Change profile picture"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={disabled || busy || !user}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void upload(file);
                            e.target.value = "";
                        }}
                    />
                </label>
                {user?.image && (
                    <button
                        className="text-button cancel"
                        type="button"
                        disabled={disabled || busy}
                        onClick={() => void remove()}
                    >
                        Remove picture
                    </button>
                )}
                <small>PNG, JPEG, WebP · up to 5 MB · cropped square</small>
            </div>
            {error && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
