/**
 * Scrolls to the Intelligence Journey section and always produces a visible
 * result — a plain `<Link href="#journey">` is a no-op when the hash is
 * already `#journey` (e.g. the user scrolled back up after a first click),
 * since neither the URL nor the router state changes on the second click.
 */
export function scrollToJourney(): void {
  const target = document.getElementById('journey');
  if (!target) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  if (window.location.hash !== '#journey') {
    window.history.replaceState(null, '', '#journey');
  }
  window.dispatchEvent(new Event('fihdar:journey-focus'));
}
