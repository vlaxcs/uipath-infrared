export type EstateViewOptions = {
  failedComponent?: string;
  initialIndex?: number;
};

export function mountEstateView(container: HTMLElement, dataset: unknown, options?: EstateViewOptions): () => void;
