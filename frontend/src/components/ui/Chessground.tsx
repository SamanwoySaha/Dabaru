// components/ChessgroundBoard.tsx
import { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import "../../styles/chessground.base.css";
import "../../styles/chessground.brown.css";
import "../../styles/chessground.cburnett.css";

const ChessgroundBoard = () => {
  const boardRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<ReturnType<typeof Chessground> | null>(null);

  useEffect(() => {
    if (boardRef.current) {
      groundRef.current = Chessground(boardRef.current, {
        movable: {
          free: true,
          color: "white",
          dests: new Map(), // you can populate this with legal moves
        },
        highlight: {
          lastMove: true,
          check: true,
        },
        animation: {
          enabled: true,
        },
        orientation: "white",
      });
    }

    // Clean up
    return () => {
      groundRef.current?.destroy();
    };
  }, []);

  return <div ref={boardRef} className="cg-board w-[400px] h-[400px]" />;
};

export default ChessgroundBoard;
