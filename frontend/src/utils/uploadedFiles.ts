import apiService from '../services/api'

/**
 * The files THIS person uploaded in this visit that no saved record points at yet (a photo added to a listing that is still being
 * written). When they take such a photo away again the stored file is deleted too, so nothing is left behind that they cannot see.
 * The server lets only the uploader (or an admin) delete a file; a file already saved on a record is never touched from here.
 */
const pending = new Map<string, string>()

/** Call with the reply of an upload: the file is now removable until a record that uses it is saved. */
export function rememberUpload(reply: { url?: string; fileUrl?: string; key?: string } | null | undefined): void {
  const url = reply?.url || reply?.fileUrl
  if (url && reply?.key) pending.set(url, reply.key)
}

/** A record that uses the files was saved: from now on they belong to it and are not deleted by taking a picture off a form. */
export function commitUploads(): void {
  pending.clear()
}

/** Delete the stored file behind `url` if it was uploaded in this visit and is not saved anywhere yet. Never throws, never blocks the screen. */
export function discardUpload(url: string): void {
  const key = pending.get(url)
  if (!key) return
  pending.delete(url)
  void apiService.deleteUploadedFile(key).catch(() => { /* the picture is already off the form; a leftover file is cleaned up by the server's retention job */ })
}
