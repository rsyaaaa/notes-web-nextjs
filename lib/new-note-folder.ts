export function getNewNoteFolderId(
  selectedFolder: string | null,
  folders: readonly { id: number }[],
): string {
  // Only inherit a folder from the current account's loaded folder list.
  const folder = folders.find((item) => String(item.id) === selectedFolder)
  return folder ? String(folder.id) : ''
}

export function getNewNoteHref(selectedFolder: string | null, folders: readonly { id: number }[]): string {
  const folderId = getNewNoteFolderId(selectedFolder, folders)
  return folderId ? `/notes/new?folder=${encodeURIComponent(folderId)}` : '/notes/new'
}
