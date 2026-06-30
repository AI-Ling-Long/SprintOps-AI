import type { SprintOpsBridge } from "@sprintops/contracts";

declare global {
  interface Window {
    sprintOps: SprintOpsBridge;
  }
}

export {};
