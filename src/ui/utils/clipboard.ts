/**
 * Robust clipboard copy utility for Figma plugin iframes.
 * Combines navigator.clipboard with a bulletproof document.execCommand fallback
 * to guarantee copying works across Figma Desktop (Electron) and Figma Web.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1. Try modern navigator.clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Modern API restricted or blocked by iframe permissions policy, fall through to fallback
    }
  }

  // 2. Reliable textarea execCommand fallback
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0.01';
    textArea.style.zIndex = '99999';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      return true;
    }
  } catch (err) {
    console.error('execCommand copy fallback failed', err);
  }

  return false;
}
