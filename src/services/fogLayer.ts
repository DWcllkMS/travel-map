import type { Map } from 'maplibre-gl';
import { cellToLatLng, gridDisk } from 'h3-js';

export class FogOfWarOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private map: Map | null = null;
  private openCells = new Set<string>();
  private active = true;
  private isDark = true;
  private onMoveHandler: () => void;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '2';
    this.ctx = this.canvas.getContext('2d');
    this.onMoveHandler = () => this.render();
  }

  attach(map: Map, container: HTMLElement, isDark: boolean): void {
    this.map = map;
    this.isDark = isDark;
    container.appendChild(this.canvas);
    this.map.on('move', this.onMoveHandler);
    this.map.on('resize', this.onMoveHandler);
    this.render();
  }

  detach(): void {
    if (this.map) {
      this.map.off('move', this.onMoveHandler);
      this.map.off('resize', this.onMoveHandler);
      this.map = null;
    }
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }

  setTheme(isDark: boolean): void {
    this.isDark = isDark;
    this.render();
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.clear();
    } else {
      this.render();
    }
  }

  setH3CellsFromPhotos(h3Cells: string[]): void {
    this.openCells.clear();
    for (const cell of h3Cells) {
      if (!cell) continue;
      try {
        const ring = gridDisk(cell, 1);
        for (const c of ring) {
          this.openCells.add(c);
        }
      } catch {
        this.openCells.add(cell);
      }
    }
    this.render();
  }

  private clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(): void {
    if (!this.map || !this.ctx || !this.active) return;
    const zoom = this.map.getZoom();

    if (zoom < 6.5 || this.openCells.size === 0) {
      this.clear();
      return;
    }

    const mapCanvas = this.map.getCanvas();
    const width = mapCanvas.width;
    const height = mapCanvas.height;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const fogOpacity = Math.min(0.75, Math.max(0, (zoom - 6.0) * 0.75));
    ctx.fillStyle = this.isDark
      ? `rgba(10, 11, 14, ${fogOpacity})`
      : `rgba(235, 237, 242, ${fogOpacity})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'destination-out';

    const container = this.map.getContainer();
    const scaleX = width / (container.clientWidth || 1);
    const scaleY = height / (container.clientHeight || 1);

    for (const cell of this.openCells) {
      try {
        const [lat, lng] = cellToLatLng(cell);
        const pt = this.map.project([lng, lat]);
        const x = pt.x * scaleX;
        const y = pt.y * scaleY;

        const neighbors = gridDisk(cell, 1);
        const neighbor = neighbors.length > 1 ? neighbors[1] : null;
        let distPx = 0;
        if (neighbor) {
          const [nLat, nLng] = cellToLatLng(neighbor);
          const nPt = this.map.project([nLng, nLat]);
          distPx = Math.hypot((nPt.x - pt.x) * scaleX, (nPt.y - pt.y) * scaleY);
        }

        const radius = Math.max(20, distPx * 1.55);

        if (x < -radius || x > width + radius || y < -radius || y > height + radius) {
          continue;
        }

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        grad.addColorStop(0.6, 'rgba(0, 0, 0, 1.0)');
        grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      } catch {
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}
