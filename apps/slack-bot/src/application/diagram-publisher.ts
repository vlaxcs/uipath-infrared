import type { DiagramInputs, DiagramRenderer, DiagramState, SlackClient } from './ports.js';
import type { DiagramRef } from '../domain/diagram.js';

export class DiagramPublisher {
  private published = new Map<string, Promise<DiagramRef | undefined>>();

  constructor(private renderer: DiagramRenderer, private slack: SlackClient) {}

  publish(layout: string | undefined, inputs: DiagramInputs | undefined, state: DiagramState = 'target'): Promise<DiagramRef | undefined> {
    if (!layout || !inputs) return Promise.resolve(undefined);
    const key = [inputs.runId, inputs.infra, inputs.result, layout, state].join('\u0000');
    let pending = this.published.get(key);
    if (!pending) {
      pending = this.render(layout, state, inputs);
      pending.then(ref => { if (!ref) this.published.delete(key); });
      this.published.set(key, pending);
    }
    return pending;
  }

  async publishAll(layouts: string[], inputs: DiagramInputs | undefined, state: DiagramState = 'target'): Promise<Map<string, DiagramRef>> {
    const refs = await Promise.all(layouts.map(layout => this.publish(layout, inputs, state)));
    const found = new Map<string, DiagramRef>();
    layouts.forEach((layout, index) => {
      const ref = refs[index];
      if (ref) found.set(layout, ref);
    });
    return found;
  }

  private async render(layout: string, state: DiagramState, inputs: DiagramInputs): Promise<DiagramRef | undefined> {
    try {
      const diagram = await this.renderer.render({ layout, state, inputs });
      if (!diagram) return undefined;
      const fileId = await this.slack.uploadImage(diagram.pngPath, diagram.title, diagram.alt);
      if (!fileId) return undefined;
      return { fileId, title: diagram.title, caption: diagram.caption, alt: diagram.alt };
    } catch (error) {
      console.error(`Diagram for ${layout} (${state}) unavailable: ${(error as Error).message}`);
      return undefined;
    }
  }
}
