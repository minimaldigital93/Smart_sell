"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Global gesture navigation — replaces the on-screen back button.
 *
 * Matches the native iOS convention:
 *   - Swipe right, starting from the LEFT edge  → router.back()
 *   - Swipe left,  starting from the RIGHT edge → router.forward()
 *
 * The edge requirement is what keeps this from fighting the rest of the UI:
 * a horizontal flick on the product gallery, a category scroller or any other
 * carousel starts mid-screen, so it never triggers navigation. Add
 * `data-no-swipe-nav` to a container to opt out even at the edges.
 *
 * We only fire a navigation when there is somewhere to go. Without this guard,
 * swiping on a page that sits at the edge of the history stack (e.g. /login as
 * the PWA's start_url) calls back()/forward() with no target, which leaves an
 * installed iOS PWA hung on a loading spinner. iOS WebKit lacks the Navigation
 * API, so `canGoBack` is approximated with `history.length` and `canGoForward`
 * is tracked manually: any newly pushed route clears the forward stack.
 */
export function SwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  // True only after we've gone back and not yet pushed a new route forward.
  const canGoForward = useRef(false);
  // Distinguishes a pathname change we caused (back/forward) from a fresh push.
  const gestureNav = useRef(false);

  // A new route push clears the forward history; a back/forward we triggered
  // does not. React to pathname changes to keep `canGoForward` honest.
  useEffect(() => {
    if (gestureNav.current) {
      gestureNav.current = false;
    } else {
      canGoForward.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    // In a normal browser tab the OS already provides an edge swipe-back
    // gesture; layering ours on top would navigate back twice. Only run our
    // handler in installed/standalone PWA mode, where no native gesture exists.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (!standalone) return;

    const EDGE_ZONE = 32; // px from a screen edge the gesture must start in
    const MIN_DISTANCE = 70; // px of horizontal travel required
    const MAX_OFF_AXIS = 50; // px of vertical drift allowed
    const MAX_DURATION = 600; // ms — must be a flick, not a slow drag

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      // Bail if the gesture begins inside an opted-out region.
      if (
        e.target instanceof Element &&
        e.target.closest("[data-no-swipe-nav]")
      ) {
        tracking = false;
        return;
      }
      const width = window.innerWidth;
      const fromLeftEdge = t.clientX <= EDGE_ZONE;
      const fromRightEdge = t.clientX >= width - EDGE_ZONE;
      if (!fromLeftEdge && !fromRightEdge) {
        tracking = false;
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      startT = Date.now();
      tracking = true;
    }

    function onTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;

      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startT;

      if (dt > MAX_DURATION) return;
      if (Math.abs(dy) > MAX_OFF_AXIS) return;
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dx) < Math.abs(dy)) return;

      const nav = (
        window as Window & {
          navigation?: { canGoBack?: boolean; canGoForward?: boolean };
        }
      ).navigation;

      // Swipe right from the left edge → back; swipe left from the right → forward.
      if (dx > 0 && startX <= EDGE_ZONE) {
        // canGoBack when the API exists; otherwise infer from the stack depth.
        const canBack = nav?.canGoBack ?? window.history.length > 1;
        if (!canBack) return;
        gestureNav.current = true;
        canGoForward.current = true;
        router.back();
      } else if (dx < 0 && startX >= window.innerWidth - EDGE_ZONE) {
        const canForward = nav?.canGoForward ?? canGoForward.current;
        if (!canForward) return;
        gestureNav.current = true;
        canGoForward.current = false;
        router.forward();
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [router]);

  return null;
}
