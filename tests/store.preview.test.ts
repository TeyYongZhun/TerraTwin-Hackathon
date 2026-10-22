import { beforeEach, describe, expect, it } from 'vitest';
import { useApp } from '../src/store/app';
import { BASE_MODULE } from '../src/lib/solar/modules';

const st = () => useApp.getState();

describe('designs are previews until built', () => {
  beforeEach(() => useApp.setState({ selectedId: null, arrays: [], canopies: [], modules: {}, canopySpecs: {} }));

  it('selecting another site discards the unbuilt array and canopy of the site left', () => {
    useApp.setState({ selectedId: 'roof', arrays: ['roof'] });
    st().select('other');
    expect(st().arrays).toEqual([]);
    useApp.setState({ selectedId: 'park', canopies: ['park'] });
    st().select('other');
    expect(st().canopies).toEqual([]);
  });
  it('closing the drawer (deselecting) discards it too, however the selection is cleared', () => {
    useApp.setState({ selectedId: 'roof', arrays: ['roof'] });
    st().set({ selectedId: null });
    expect(st().arrays).toEqual([]);
  });
  it('keeps a site built with confirmed panels or canopy materials', () => {
    useApp.setState({ selectedId: 'roof', arrays: ['roof'], modules: { roof: BASE_MODULE } });
    st().select('park');
    expect(st().arrays).toEqual(['roof']);
    useApp.setState({ canopies: ['park'], canopySpecs: { park: { concrete: 'VerdeMix GGBS-50 Grade C30' } } });
    st().select(null);
    expect(st().canopies).toEqual(['park']);
  });
  it('leaves other sites alone and keeps the design while the same site stays selected', () => {
    useApp.setState({ selectedId: 'roof', arrays: ['built', 'roof'], modules: { built: BASE_MODULE } });
    st().select('roof');
    expect(st().arrays).toEqual(['built', 'roof']);
    st().set({ module: 'panelspec' });
    expect(st().arrays).toEqual(['built', 'roof']);
    st().select('other');
    expect(st().arrays).toEqual(['built']);
  });
});
