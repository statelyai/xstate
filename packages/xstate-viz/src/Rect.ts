export interface Point {
  [key: string]: any;
  x: number;
  y: number;
}
export class Rect implements ClientRect {
  public top: number;
  public left: number;
  public bottom: number;
  public right: number;
  public width: number;
  public height: number;
  public x: number;
  public y: number;
  constructor(rect: ClientRect) {
    this.top = rect.top;
    this.left = rect.left;
    this.bottom = rect.bottom;
    this.right = rect.right;
    this.width = rect.width;
    this.height = rect.height;
    this.x = rect.left;
    this.y = rect.top;
  }

  public point(x: string, y: string, meta?: Record<string, any>): Point {
    const point: Point = { x: 0, y: 0, ...meta };

    switch (x) {
      case "left":
        point.x = this.left;
        break;
      case "right":
        point.x = this.right;
        break;

      case "center":
        point.x = this.left + this.width / 2;
        break;
      default:
        break;
    }
    switch (y) {
      case "top":
        point.y = this.top;
        break;
      case "bottom":
        point.y = this.bottom;
        break;

      case "center":
        point.y = this.top + this.height / 2;
        break;
      default:
        break;
    }

    return point;
  }

  public equals(otherRect: ClientRect): boolean {
    return ["top", "left", "bottom", "right"].every((prop) => {
      return otherRect[prop] === this[prop];
    });
  }

  public unscale(scaleX: number, scaleY: number = scaleX): Rect {
    return new Rect({
      top: this.top / scaleY,
      left: this.left / scaleX,
      bottom: this.bottom / scaleY,
      right: this.right / scaleX,
      width: this.width / scaleX,
      height: this.height / scaleY,
    });
  }
}
