const TOOLTIP_HIDE_DELAY = 0;
const TOOLTIP_OFFSET = 8;

type TooltipContent = string | (() => string | null | undefined);

class MemeampTooltipManager {
  private tooltipEl: HTMLDivElement;
  private targets = new WeakMap<HTMLElement, TooltipContent>();
  private activeTarget: HTMLElement | null = null;
  private hideTimeout: number | null = null;

  constructor() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'memeamp-tooltip';
    this.tooltipEl.setAttribute('role', 'tooltip');
    this.mountTooltipElement();
  }

  private mountTooltipElement(): void {
    const append = () => {
      if (!document.body.contains(this.tooltipEl)) {
        document.body.appendChild(this.tooltipEl);
      }
    };

    if (document.body) {
      append();
    } else {
      document.addEventListener('DOMContentLoaded', append, { once: true });
    }
  }

  attach(target: HTMLElement, content: TooltipContent): void {
    const isNewTarget = !this.targets.has(target);
    this.targets.set(target, content);

    if (!isNewTarget) {
      return;
    }

    target.addEventListener('mouseenter', (event) => this.showFromEvent(target, event));
    target.addEventListener('mouseleave', () => this.hide());
    target.addEventListener('focus', (event) => this.showFromEvent(target, event));
    target.addEventListener('blur', () => this.hide());
    target.addEventListener('mousemove', (event) => {
      if (this.activeTarget === target) {
        this.positionTooltip(target, event.clientX, event.clientY);
      }
    });
  }

  update(target: HTMLElement | null, content: TooltipContent): void {
    if (!target) return;
    this.targets.set(target, content);
    if (this.activeTarget === target) {
      this.renderContent(target);
      this.positionTooltip(target);
    }
  }

  private showFromEvent(target: HTMLElement, event: MouseEvent | FocusEvent): void {
    if (!this.targets.has(target)) return;
    this.activeTarget = target;
    this.renderContent(target);

    if (event instanceof MouseEvent) {
      this.positionTooltip(target, event.clientX, event.clientY);
    } else {
      this.positionTooltip(target);
    }

    this.tooltipEl.classList.add('visible');
  }

  private renderContent(target: HTMLElement): void {
    const content = this.targets.get(target);
    const text = typeof content === 'function' ? content() : content;
    if (!text) {
      this.hide();
      return;
    }
    this.tooltipEl.textContent = text;
  }

  private positionTooltip(target: HTMLElement, clientX?: number, clientY?: number): void {
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    let top: number;
    let left: number;

    if (typeof clientX === 'number' && typeof clientY === 'number') {
      top = clientY + TOOLTIP_OFFSET;
      left = clientX - tooltipRect.width / 2;
    } else {
      top = targetRect.bottom + TOOLTIP_OFFSET;
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    }

    // Keep tooltip within viewport bounds
    const maxLeft = window.scrollX + window.innerWidth - tooltipRect.width - 8;
    const minLeft = window.scrollX + 8;
    left = Math.max(minLeft, Math.min(left + window.scrollX, maxLeft));

    // Prevent tooltip from going below viewport
    if (top + tooltipRect.height > window.scrollY + window.innerHeight) {
      top = targetRect.top - tooltipRect.height - TOOLTIP_OFFSET;
    }

    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
  }

  private hide(): void {
    if (this.hideTimeout) {
      window.clearTimeout(this.hideTimeout);
    }

    this.hideTimeout = window.setTimeout(() => {
      this.tooltipEl.classList.remove('visible');
      this.activeTarget = null;
    }, TOOLTIP_HIDE_DELAY);
  }
}

const manager = new MemeampTooltipManager();

export function attachMemeampTooltip(target: HTMLElement | null, content: TooltipContent): void {
  if (!target) return;
  manager.attach(target, content);
}

export function updateMemeampTooltip(target: HTMLElement | null, content: TooltipContent): void {
  if (!target) return;
  manager.update(target, content);
}

// Keep the old exports for backward compatibility
export function attachWinampTooltip(target: HTMLElement | null, content: TooltipContent): void {
  if (!target) return;
  manager.attach(target, content);
}

export function updateWinampTooltip(target: HTMLElement | null, content: TooltipContent): void {
  if (!target) return;
  manager.update(target, content);
}
