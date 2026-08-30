// RemoteViews has no icon font support — SvgWidget takes a raw SVG string.
// Matches the stroke weight/cap style of the lucide-react-native icons used
// everywhere else in the app (see IconButton).
export function plusSvg(strokeColor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`
}
