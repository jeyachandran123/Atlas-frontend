/**
 * Hands a URL to the browser to save as `filename`. `revoke` releases it
 * afterwards — for a blob URL made just for this download.
 */
export function saveUrl(url: string, filename: string, revoke = false): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
