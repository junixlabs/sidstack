/**
 * Custom FitAddon based on WaveTerm's implementation.
 *
 * Key differences from standard xterm.js FitAddon:
 * 1. Measures actual scrollbar width instead of using hardcoded 15px
 * 2. Clears render cache before resize to prevent TUI artifacts
 * 3. Supports noScrollbar option for cases where scrollbar is hidden via CSS
 *
 * This fixes dimension calculation issues that cause Claude CLI blank space bug.
 */

import type { FitAddon as IFitApi } from "@xterm/addon-fit";
import type { ITerminalAddon, Terminal } from "@xterm/xterm";

interface ITerminalDimensions {
  rows: number;
  cols: number;
}

const MINIMUM_COLS = 2;
const MINIMUM_ROWS = 1;

// Maximum columns to prevent TUI app rendering bugs (e.g., Claude CLI with Ink)
// Claude CLI has layout issues with wide terminals (180+ cols)
// This is a workaround for the app bug, not an xterm.js limitation
const MAX_COLS = 180;

export class FitAddon implements ITerminalAddon, IFitApi {
  private _terminal: Terminal | undefined;

  /**
   * When true, ignores scrollbar width in calculations.
   * Useful when scrollbar is hidden via CSS.
   */
  public noScrollbar: boolean = false;

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  public dispose(): void {}

  public fit(): void {
    const dims = this.proposeDimensions();
    if (!dims || !this._terminal || isNaN(dims.cols) || isNaN(dims.rows)) {
      return;
    }

    const core = (this._terminal as any)._core;

    // Force a full render when dimensions change
    if (this._terminal.rows !== dims.rows || this._terminal.cols !== dims.cols) {
      // Clear render cache to prevent TUI rendering artifacts
      if (core?._renderService) {
        core._renderService.clear();
      }
      this._terminal.resize(dims.cols, dims.rows);
    }
  }

  public proposeDimensions(): ITerminalDimensions | undefined {
    if (!this._terminal) {
      return undefined;
    }

    if (!this._terminal.element || !this._terminal.element.parentElement) {
      return undefined;
    }

    const core = (this._terminal as any)._core;
    const dims = core?._renderService?.dimensions;

    if (!dims || dims.css.cell.width === 0 || dims.css.cell.height === 0) {
      return undefined;
    }

    // Get DOM elements for measurement
    const terminalElement = this._terminal.element;
    const parentElement = terminalElement.parentElement!;
    const viewport = core?.viewport;
    const viewportElement = viewport?._viewportElement as HTMLElement | undefined;
    const scrollArea = viewport?._scrollArea as HTMLElement | undefined;

    // Measure actual scrollbar width (WaveTerm's approach)
    // More accurate than hardcoded FALLBACK_SCROLL_BAR_WIDTH
    let scrollbarWidth = 0;
    if (!this.noScrollbar && this._terminal.options.scrollback !== 0) {
      if (viewportElement && scrollArea) {
        scrollbarWidth = viewportElement.offsetWidth - scrollArea.offsetWidth;
      }
    }

    // Get dimensions
    const parentElementStyle = window.getComputedStyle(parentElement);
    const parentElementWidth = parseInt(parentElementStyle.getPropertyValue("width"));
    const parentElementHeight = parseInt(parentElementStyle.getPropertyValue("height"));

    const elementStyle = window.getComputedStyle(terminalElement);
    const elementPaddingVer = parseInt(elementStyle.getPropertyValue("padding-top")) +
                              parseInt(elementStyle.getPropertyValue("padding-bottom"));
    const elementPaddingHor = parseInt(elementStyle.getPropertyValue("padding-right")) +
                              parseInt(elementStyle.getPropertyValue("padding-left"));

    // Use scrollArea width if available (most accurate), otherwise calculate from parent
    const scrollAreaOffsetWidth = scrollArea?.offsetWidth ?? 0;
    const availableWidth = scrollAreaOffsetWidth > 0
      ? scrollAreaOffsetWidth
      : parentElementWidth - elementPaddingHor - scrollbarWidth;
    const availableHeight = parentElementHeight - elementPaddingVer;

    const cellWidth = dims.css.cell.width;
    const cellHeight = dims.css.cell.height;

    const rawCols = Math.floor(availableWidth / cellWidth);
    const cols = Math.max(MINIMUM_COLS, Math.min(rawCols, MAX_COLS));
    const rows = Math.max(MINIMUM_ROWS, Math.floor(availableHeight / cellHeight));

    return { cols, rows };
  }

  /**
   * Get the terminal instance for external access
   */
  public get terminal(): Terminal | undefined {
    return this._terminal;
  }
}
