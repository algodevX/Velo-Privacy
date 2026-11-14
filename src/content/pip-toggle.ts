/**
 * Toggles picture-in-picture for the most prominent video in the current frame.
 *
 * Injected with chrome.scripting.executeScript({ func }), which serializes the function's
 * source: it must stay self-contained, with no imports or references to outer scope.
 *
 * @returns whether this frame entered or left picture-in-picture.
 */
export async function togglePictureInPicture(): Promise<boolean> {
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
    return true;
  }

  const area = (video: HTMLVideoElement) => {
    const { width, height } = video.getBoundingClientRect();
    return width * height;
  };
  const candidates = [...document.querySelectorAll('video')].filter(
    (video) => video.readyState > HTMLMediaElement.HAVE_NOTHING && area(video) > 0,
  );
  // Prefer a playing video; among equals, the largest on screen.
  candidates.sort((a, b) => Number(a.paused) - Number(b.paused) || area(b) - area(a));
  const video = candidates[0];
  if (video === undefined) return false;

  video.removeAttribute('disablepictureinpicture');
  try {
    await video.requestPictureInPicture();
    return true;
  } catch {
    return false;
  }
}
