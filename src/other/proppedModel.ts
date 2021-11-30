import * as fs from 'fs';
import * as path from 'path';
import { getBuffer } from 'gltf-import-export';
import { Box, Quaternion, Vector, Vector2 } from './math';

interface IProp {
  /* eslint-disable @typescript-eslint/naming-convention */
  // keep naming same as Anno
  Name: string,
  FileName: string,
  Position_x: string,
  Position_y: string,
  Position_z: string,
  Rotation_x: string,
  Rotation_y: string,
  Rotation_z: string,
  Rotation_w: string,
  Scale_x: string,
  Scale_y: string,
  Scale_z: string
  /* eslint-enable @typescript-eslint/naming-convention */
}
export const PROP_DEFAULTS = {
  /* eslint-disable @typescript-eslint/naming-convention */
  ConfigType: 'PROP',
  Name: '',
  Position_x: '0.000000',
  Position_y: '0.000000',
  Position_z: '0.000000',
  Rotation_x: '0.000000',
  Rotation_y: '0.000000',
  Rotation_z: '0.000000',
  Rotation_w: '1.000000',
  Scale_x: '1.000000',
  Scale_y: '1.000000',
  Scale_z: '1.000000',
  Flags: '1'
  /* eslint-enable @typescript-eslint/naming-convention */
};
interface IParticle {
  /* eslint-disable @typescript-eslint/naming-convention */
  Transformer: {
    Config: {
      Position_x: string,
      Position_y: string,
      Position_z: string,
      Rotation_x: string,
      Rotation_y: string,
      Rotation_z: string,
      Rotation_w: string,
      Scale: string
    }
  },
  Name: string
  /* eslint-enable @typescript-eslint/naming-convention */
}
export const PROPCONTAINER_DEFAULTS = {
  /* eslint-disable @typescript-eslint/naming-convention */
  ConfigType: 'PROPCONTAINER',
  Name: '',
  VariationEnabled: 0,
  VariationProbability: 100
  /* eslint-enable @typescript-eslint/naming-convention */
};
interface IFeedback {
  /* eslint-disable @typescript-eslint/naming-convention */
  Position: { x: number, y: number, z: number },
  Orientation: { x: number, y: number, z: number, w: number },
  RotationY: string,
  Name: string
  /* eslint-enable @typescript-eslint/naming-convention */
}

interface IFile {
  /* eslint-disable @typescript-eslint/naming-convention */
  // keep naming same as Anno
  // ConfigType: string,
  Transformer: {
    Config: {
      // ConfigType: string,
      // Conditions: number,
      Position_x: string,
      Position_y: string,
      Position_z: string,
      Rotation_x: string,
      Rotation_y: string,
      Rotation_z: string,
      Rotation_w: string,
      Scale: string
    }
  },
  Name: string,
  FileName: string,
  // AdaptTerrainHeight: number
  /* eslint-enable @typescript-eslint/naming-convention */
}
export const FILE_DEFAULTS = {
  /* eslint-disable @typescript-eslint/naming-convention */
  ConfigType: 'FILE',
  Transformer: {
    Config: {
      ConfigType: 'ORIENTATION_TRANSFORM',
      Conditions: '0',
      Position_x: '0.000000',
      Position_y: '0.000000',
      Position_z: '0.000000',
      Rotation_x: '0.000000',
      Rotation_y: '0.000000',
      Rotation_z: '0.000000',
      Rotation_w: '1.000000',
      Scale: '1.0'
    }
  },
  Name: '',
  FileName: '',
  AdaptTerrainHeight: 1
  /* eslint-enable @typescript-eslint/naming-convention */
};
export const FILES_DEFAULTS = {
};

type IPropMap = { [index: string]: IProp };
type IParticleMap = { [index: string]: IParticle };
type IFeedbackMap = { [index: string]: IFeedback };
type IFileMap = { [index: string]: IFile };

function dataUriToBuffer(dataUri: any) {
  const data = dataUri.slice(dataUri.indexOf(",") + 1);
  if (dataUri.indexOf("base64") >= 0) {
    return Buffer.from(data, "base64");
  }
  return Buffer.from(data, "utf8");
}

function roundVertices(vertices: number[], digitsAfter?: number) {
  const digits = Math.pow(10, (digitsAfter || 0));
  for (let i = 0; i < vertices.length; i++) {
    vertices[i] = Math.round(vertices[i] * digits) / digits;
  }
  return vertices;
}

function buildArrayBuffer<T extends ArrayLike<number>>(typedArray: any, data: ArrayBufferView, byteOffset: number, count: number, numComponents: number, byteStride?: number): T {
  byteOffset += data.byteOffset;

  const targetLength = count * numComponents;

  if (byteStride === undefined || byteStride === numComponents * typedArray.BYTES_PER_ELEMENT) {
      return new typedArray(data.buffer, byteOffset, targetLength);
  }

  const elementStride = byteStride / typedArray.BYTES_PER_ELEMENT;
  const sourceBuffer = new typedArray(data.buffer, byteOffset, elementStride * count);
  const targetBuffer = new typedArray(targetLength);
  let sourceIndex = 0;
  let targetIndex = 0;

  while (targetIndex < targetLength) {
      for (let componentIndex = 0; componentIndex < numComponents; componentIndex++) {
          targetBuffer[targetIndex] = sourceBuffer[sourceIndex + componentIndex];
          targetIndex++;
      }

      sourceIndex += elementStride;
  }

  return targetBuffer;
}

export default class ProppedModel {
  private readonly props: IPropMap;
  private readonly particles: IParticleMap;
  private readonly feedbacks: IFeedbackMap;
  private readonly files: IFileMap;
  private readonly gltf: any;
  private readonly resourceFolder: string;

  public static fromFile(filePath: string) {
    const gltf = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const props: IPropMap = { };
    const particles: IParticleMap = { };
    const feedbacks: IFeedbackMap = { };
    const files: IFileMap = { };
    
    for (let node of gltf.nodes) {
      if (node.name.startsWith('prop_')) {
        const meshName = gltf.meshes[node.mesh].name.replace(/\.\d\d\d$/, '');

        props[node.name] = {
          /* eslint-disable @typescript-eslint/naming-convention */
          Name: node.name,
          FileName: meshName.endsWith('.prp') ? meshName : undefined, // don't overwrite FileName if it doesn't fit
          Position_x: node.translation[0].toFixed(6),
          Position_y: node.translation[1].toFixed(6),
          Position_z: node.translation[2].toFixed(6),
          Rotation_x: (node.rotation ? node.rotation[0] : 0).toFixed(6),
          Rotation_y: (node.rotation ? node.rotation[1] : 0).toFixed(6),
          Rotation_z: (node.rotation ? node.rotation[2] : 0).toFixed(6),
          Rotation_w: (node.rotation ? node.rotation[3] : 1).toFixed(6),
          Scale_x: (node.scale ? node.scale[0] : 1).toFixed(6),
          Scale_y: (node.scale ? node.scale[1] : 1).toFixed(6),
          Scale_z: (node.scale ? node.scale[2] : 1).toFixed(6)
          /* eslint-enable @typescript-eslint/naming-convention */
        };
      }
      if (node.name.startsWith('particle_')) {
        particles[node.name] = {
          /* eslint-disable @typescript-eslint/naming-convention */
          Transformer: {
            Config: {
              Position_x: node.translation[0].toFixed(6),
              Position_y: node.translation[1].toFixed(6),
              Position_z: node.translation[2].toFixed(6),
              Rotation_x: (node.rotation ? node.rotation[0] : 0).toFixed(6),
              Rotation_y: (node.rotation ? node.rotation[1] : 0).toFixed(6),
              Rotation_z: (node.rotation ? node.rotation[2] : 0).toFixed(6),
              Rotation_w: (node.rotation ? node.rotation[3] : 1).toFixed(6),
              Scale: node.scale?.z?.toFixed(6)
            }
          },
          Name: node.name
          /* eslint-enable @typescript-eslint/naming-convention */
        };
      }
      if (node.name.startsWith('fc_')) {
        const rotation = node.rotation || [0, 0, 0, 1];
        const quart = {
          x: rotation[0].toFixed(6), 
          y: rotation[1].toFixed(6), 
          z: rotation[2].toFixed(6),
          w: rotation[3].toFixed(6)
        };
        feedbacks[node.name] = {
          /* eslint-disable @typescript-eslint/naming-convention */
          Position: {
            x: node.translation[0].toFixed(6),
            y: node.translation[1].toFixed(6),
            z: node.translation[2].toFixed(6),
          },
          Orientation: quart,
          RotationY: _toRotation(quart).toFixed(6),
          Name: node.name
          /* eslint-enable @typescript-eslint/naming-convention */
        };
      }
      if (node.name.startsWith('file_')) {
        const meshName = gltf.meshes[node.mesh].name.replace(/\.\d\d\d$/, '');
        files[node.name] = {
          /* eslint-disable @typescript-eslint/naming-convention */
          Name: node.name,
          FileName: meshName.endsWith('.cfg') ? meshName : undefined, // don't overwrite FileName if it doesn't fit
          Transformer: {
            Config: {
              Position_x: node.translation[0].toFixed(6),
              Position_y: node.translation[1].toFixed(6),
              Position_z: node.translation[2].toFixed(6),
              Rotation_x: (node.rotation ? node.rotation[0] : 0).toFixed(6),
              Rotation_y: (node.rotation ? node.rotation[1] : 0).toFixed(6),
              Rotation_z: (node.rotation ? node.rotation[2] : 0).toFixed(6),
              Rotation_w: (node.rotation ? node.rotation[3] : 1).toFixed(6),
              Scale: node.scale?.z
            }
          },
          /* eslint-enable @typescript-eslint/naming-convention */
        };
      }
    }

    const resourceFolder = path.dirname(filePath);
    return new ProppedModel(gltf, props, particles, feedbacks, files, resourceFolder);
  }

  public getProps(): IProp[] {
    return Object.values(this.props);
  }

  public getProp(name: string): IProp {
    return this.props[name];
  }

  public getParticles(): IParticle[] {
    return Object.values(this.particles);
  }

  public getParticle(name: string): IParticle {
    return this.particles[name];
  }

  public getFeedbacks(): IFeedback[] {
    return Object.values(this.feedbacks);
  }

  public getFeedback(name: string): IFeedback {
    return this.feedbacks[name];
  }

  public getFiles(): IFile[] {
    return Object.values(this.files);
  }

  public getFile(name: string): IFile {
    return this.files[name];
  }

  public getBuildBlocker() {
    const ground = this._findGround();
    if (!ground) {
      return undefined;
    }

    // round to .5
    return ground.map(v => v.round(2).toVector2());
  }

  public getDecalExtends() {
    const ground = this._findGround();
    if (!ground || ground.length < 1) {
      return undefined;
    }

    // round to .01
    let min = ground[0].round(100);
    let max = min;
    for (let v of ground) {
      min = min.down(v.round(100));
      max = max.up(v.round(100));
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    return { 
      Extents_x: ((max.x - min.x) / 2).toFixed(6), 
      Extents_y: (0.25).toFixed(6), 
      Extents_z: ((max.z - min.z) / 2).toFixed(6)
    };
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  public getHitBoxes() {
    return this._findHitboxes();
  }

  private _unevenBlocker: Vector2[] | undefined;
  public getUnevenBlocker() {
    if (!this._unevenBlocker) {
      this._unevenBlocker = _readVectors(this.gltf, 'UnevenBlocker', this.resourceFolder).map(e => e.toVector2());
    }
    return this._unevenBlocker;
  }

  private constructor(gltf: any, props: IPropMap, particles: IParticleMap, feedbacks: IFeedbackMap, files: IFileMap, resourceFolder: string) {
    this.gltf = gltf;
    this.props = props;
    this.particles = particles;
    this.feedbacks = feedbacks;
    this.files = files;
    this.resourceFolder = resourceFolder;
  }

  private groundVertices: Vector[] | undefined;
  private _findGround() {
    if (!this.groundVertices) {
      this.groundVertices = _readVectors(this.gltf, 'ground', this.resourceFolder);
    }

    return this.groundVertices;
  }

  _hitboxes: Box[] | undefined;
  private _findHitboxes() {
    if (!this._hitboxes) {
      this._hitboxes = [];
      const hitboxes = [];
      for (let node of this.gltf.nodes) {
        if (node.name?.startsWith('hitbox')) {
          hitboxes.push({ name: node.name, meshIdx: node.mesh, node: node });
        }
      }

      for (let hitbox of hitboxes) {
        const buffer = _getBuffer(this.gltf, hitbox.meshIdx, this.resourceFolder);
        if (!buffer || buffer.length < 3) {
          console.warn('Invalid glTF. Could not get buffer.');
          return undefined;
        }

        // TODO rotation must be DEFAULT

        const translation = Vector.fromArray(hitbox.node.translation) || Vector.zero;
        const scale = Vector.fromArray(hitbox.node.scale) || Vector.one;

        let minVector = Vector.fromArray(buffer) as Vector;
        let maxVector = minVector;
        for (let i = 0; i < buffer.length / 3; i++) {
          minVector = minVector.down(Vector.fromArray(buffer, i) as Vector);
          maxVector = maxVector.up(Vector.fromArray(buffer, i) as Vector);
        }

        minVector = minVector.mul(scale).add(translation);
        maxVector = maxVector.mul(scale).add(translation);

        this._hitboxes.push(Box.fromMinMax(hitbox.name, minVector, maxVector));
      }
    }

    return this._hitboxes;
  }
}

function _toRotation(q: { w: number, x: number, y: number, z: number }) {
  const acos = 2 * Math.acos(q.w);
  return q.y > 0 ? Math.PI * 2 - acos : acos;
}

function _findFirstNode(gltf: any, name: string, resourceFolder: string) {
  let nodeIdx = -1;
  let meshIdx = -1;
  for (let idx = 0; idx < gltf.nodes.length; idx++) {
    const node = gltf.nodes[idx];
    if (node.name === name || gltf.meshes[node.mesh]?.name === name) {
      nodeIdx = idx;
      meshIdx = node.mesh;
      break;
    }
  }
  if (nodeIdx === -1 || meshIdx === -1) {
    return undefined;
  }

  const buffer = _getBuffer(gltf, meshIdx, resourceFolder);
  if (!buffer) {
    console.warn(`Invalid glTF. Buffer for node ${nodeIdx} not found.`);
    return undefined;
  }
  return {
    nodeIdx,
    meshIdx,
    translation: Vector.fromArray(gltf.nodes[nodeIdx].translation),
    scale: Vector.fromArray(gltf.nodes[nodeIdx].scale),
    rotation: Quaternion.fromArray(gltf.nodes[nodeIdx].rotation),
    buffer: buffer as ArrayLike<number>
  };
}

// TODO rename and change to _findNodes
function _getBuffer(gltf: any, meshIdx: number, resourceFolder: string) {
  const accessorIdx = gltf.meshes[meshIdx].primitives[0].attributes.POSITION;
  const accessor = gltf.accessors[accessorIdx];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const bufferInfo = gltf.buffers[bufferView.buffer];

  const bufferFile = path.join(resourceFolder, bufferInfo.uri);
  const buffer = getBuffer(gltf, bufferView.buffer, bufferFile);
  if (buffer) {
    const bufferOffset = bufferView.byteOffset || 0;
    const bufferLength = bufferView.byteLength;
    const bufferStride = bufferView.byteStride;
    const bufferViewBuf = buffer.subarray(bufferOffset, bufferOffset + bufferLength);
    const accessorByteOffset = accessor.byteOffset || 0;

    const ACESSOR_TYPE_VEC3 = 3;
    return buildArrayBuffer(Float32Array, bufferViewBuf, accessorByteOffset, accessor.count, ACESSOR_TYPE_VEC3, bufferStride);
  }

  return undefined;
}

function _readVectors(gltf: any, name: string, resourceFolder: string) {
  const node = _findFirstNode(gltf, name, resourceFolder);
  if (!node) {
    return [];
  }

  const translation = node.translation || Vector.zero;
  const scale = node.scale || Vector.one;

  const result = [];
  for (let i = 0; i < node.buffer.length / 3; i++) {
    const v = Vector.fromArray(node.buffer, i);
    if (v) {
      result.push(v.mul(scale).add(translation));
    }
  }

  return result;
}