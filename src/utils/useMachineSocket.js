import { useEffect } from "react";
import { io } from "socket.io-client";
import { CONFIG } from "../constants/config";

const socket = io(CONFIG.SOCKET_URL, { transports: ["websocket"] });

export const useMachineSocket = (gridRef) => {
  useEffect(() => {
    socket.on("machineUpdate", (data) => {
      if (!gridRef.current) return;

      const machineEl = gridRef.current.querySelector(`[data-gymviewid="${data.gymview_id}"]`);
      
      if (machineEl) {
        const content = machineEl.querySelector(".grid-stack-item-content");
        content.classList.remove("machine-libre", "machine-utilise", "machine-occupe");
        content.classList.add(`machine-${data.state}`);
        machineEl.dataset.state = data.state;
      }
    });

    return () => socket.off("machineUpdate");
  }, [gridRef]);
};