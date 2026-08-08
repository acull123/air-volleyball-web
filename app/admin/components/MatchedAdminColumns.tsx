"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const scrollableRightCardClassName =
  "min-h-0 [&>section]:flex [&>section]:h-full [&>section]:flex-col [&>section>div:last-child]:flex [&>section>div:last-child]:min-h-0 [&>section>div:last-child]:flex-1 [&>section>div:last-child]:flex-col";

export default function MatchedAdminColumns({
  left,
  right,
  columnsClassName = "lg:grid-cols-[0.95fr_1.05fr]",
  rightClassName = scrollableRightCardClassName,
}: {
  left: ReactNode;
  right: ReactNode;
  columnsClassName?: string;
  rightClassName?: string;
}) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const [rightHeight, setRightHeight] = useState<number | null>(null);

  useEffect(() => {
    const leftColumn = leftRef.current;

    if (!leftColumn) {
      return;
    }

    const updateRightHeight = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setRightHeight(null);
        return;
      }

      setRightHeight(leftColumn.getBoundingClientRect().height);
    };

    updateRightHeight();

    const resizeObserver = new ResizeObserver(updateRightHeight);
    resizeObserver.observe(leftColumn);
    window.addEventListener("resize", updateRightHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateRightHeight);
    };
  }, []);

  return (
    <div className={`grid items-start gap-8 ${columnsClassName}`}>
      <div ref={leftRef}>{left}</div>
      <div
        className={rightClassName}
        style={rightHeight ? { height: rightHeight } : undefined}
      >
        {right}
      </div>
    </div>
  );
}
