export class Vector {
  x: number = 0;
  y: number = 0;
  z: number = 0;

  static readonly zero = new Vector(0, 0, 0);
  static readonly one = new Vector(1, 1, 1);

  /** either x, y, z or array, index */
  constructor (x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /** create from [... offset, offset + 1, offset + 2, ...] */
  public static fromArray(array: ArrayLike<number>, offset: number = 0) {
    if (!array || array.length < (offset + 1) * 3) {
      return undefined;
    }
    return new Vector(
      array[offset * 3 + 0],
      array[offset * 3 + 1],
      array[offset * 3 + 2]
    );
  }

  /** create from string object */
  public static parse(obj: { x: string, y: string, z: string } | undefined) {
    if (!obj || !obj.x || !obj.y || !obj.z) {
      return undefined;
    }
    return new Vector(parseFloat(obj.x), parseFloat(obj.y), parseFloat(obj.z));
  }

  /** { xf: 0.000000, yf, zf } */
  public toFixedF(fixed: number = 6) {
    return { xf: this.x.toFixed(fixed), yf: this.y.toFixed(fixed), zf: this.z.toFixed(fixed) };
  }

  /** return new Vector with values of b added */
  public add(b: Vector) {
    return new Vector(this.x + b.x, this.y + b.y, this.z + b.z); 
  }

  /** return new Vector with values of b subtracted */
  public sub(b: Vector) {
    return new Vector(this.x - b.x, this.y - b.y, this.z - b.z); 
  }

  /** return new Vector with values divided by b */
  public div(b: number) {
    return new Vector(this.x / b, this.y / b, this.z / b); 
  }

  /** return new Vector with values multiplied by b */
  public mul(b: number | Vector) {
    if (typeof b === 'number') {
      return new Vector(this.x * b, this.y * b, this.z * b); 
    }
    return new Vector(this.x * b.x, this.y * b.y, this.z * b.z); 
  }

  /** return new Vector with smallest values of this and b */
  public down(b: Vector) {
    return new Vector(Math.min(this.x, b.x), Math.min(this.y, b.y), Math.min(this.z, b.z));
  }
  
  /** return new Vector with largest values of this and b */
  public up(b: Vector) {
    return new Vector(Math.max(this.x, b.x), Math.max(this.y, b.y), Math.max(this.z, b.z));
  }
}

export class Quaternion {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  w: number = 1;

  static readonly default = new Quaternion(0, 0, 0, 1);

  /** either x, y, z, w or array with 4 elements */
  constructor (xOrArray: number | ArrayLike<number>, y: number = 0, z: number = 0, w: number = 0) {
    if (typeof xOrArray === 'number') {
      this.x = xOrArray;
      this.y = y;
      this.z = z;
      this.w = w;
    }
    else {
      this.x = xOrArray[0];
      this.y = xOrArray[1];
      this.z = xOrArray[2];
      this.w = xOrArray[3];
    }
  }

  /** { xf: 0.000000, yf, zf, wf } */
  public toFixedF(fixed: number = 6) {
    return { xf: this.x.toFixed(fixed), yf: this.y.toFixed(fixed), zf: this.z.toFixed(fixed), wf: this.w.toFixed(fixed) };
  }

}

export class Box {
  name: string = "";
  center: Vector = Vector.zero;
  size: Vector = Vector.zero;

  public static fromMinMax(name: string, min: Vector, max: Vector) {
    let box = new Box();
    box.center = min.add(max).div(2);
    box.size = max.sub(min);
    box.name = name;
    return box;
  }
}