import { describe, expect, it } from 'vitest';
import {
  classifyPackageEntry,
  packageCollectionName,
  parsePackageManifest,
} from '../../src/package/package-contents.js';

describe('classifyPackageEntry', () => {
  it('sorts entries by what the installer can do with them', () => {
    expect(classifyPackageEntry('fonts/GreatVibes-Regular.ttf')).toBe('font');
    expect(classifyPackageEntry('Cascadia.OTF')).toBe('font');
    expect(classifyPackageEntry('icons/owl.png')).toBe('image');
    expect(classifyPackageEntry('icons/cat.JPG')).toBe('image');
    expect(classifyPackageEntry('icons/fox.svg')).toBe('svg');
    expect(classifyPackageEntry('shapes/library.json')).toBe('shape-library');
    expect(classifyPackageEntry('manifest.json')).toBe('manifest');
    expect(classifyPackageEntry('README.md')).toBe('other');
    expect(classifyPackageEntry('licences/OFL.txt')).toBe('other');
  });

  it('treats a nested manifest as somebody else\'s file', () => {
    expect(classifyPackageEntry('icons/manifest.json')).toBe('shape-library');
  });

  it('ignores archive litter', () => {
    expect(classifyPackageEntry('__MACOSX/icons/._owl.png')).toBe('other');
    expect(classifyPackageEntry('.hidden/font.ttf')).toBe('other');
    expect(classifyPackageEntry('icons/.DS_Store')).toBe('other');
  });
});

describe('parsePackageManifest', () => {
  it('reads the collection name and nothing else', () => {
    expect(parsePackageManifest('{"name": "Woodland friends", "author": "x"}')).toEqual({
      name: 'Woodland friends',
    });
  });

  it('shrugs at non-JSON and wrong shapes', () => {
    expect(parsePackageManifest('not json')).toEqual({});
    expect(parsePackageManifest('[1,2,3]')).toEqual({});
    expect(parsePackageManifest('{"name": 7}')).toEqual({});
  });
});

describe('packageCollectionName', () => {
  it('prefers the manifest', () => {
    expect(packageCollectionName('pack.zip', { name: 'Woodland friends' })).toBe(
      'Woodland friends',
    );
  });

  it('falls back to the archive name, cleaned up', () => {
    expect(packageCollectionName('woodland-friends_v2.zip')).toBe('woodland friends v2');
    expect(packageCollectionName('C:\\Downloads\\Forest Pack.embpkg')).toBe('Forest Pack');
  });

  it('keeps the collection short enough for a chip', () => {
    const name = packageCollectionName('pack.zip', { name: 'x'.repeat(120) });
    expect(name.length).toBeLessThanOrEqual(40);
  });

  it('never returns an empty name', () => {
    expect(packageCollectionName('....zip').length).toBeGreaterThan(0);
    expect(packageCollectionName('---.zip', { name: '   ' })).toBe('Imported package');
  });
});
