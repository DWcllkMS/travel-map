import { GeoSpatialIndex } from '../services/geoIndex';

const workerIndex = new GeoSpatialIndex();

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'init') {
    workerIndex.init(payload.districts, payload.regions);
    self.postMessage({ type: 'ready' });
  } else if (type === 'matchBatch') {
    const { items } = payload;
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const match = workerIndex.findDistrictAndRegion(it.lat, it.lon);
      results.push({
        id: it.id,
        match
      });
      if (i > 0 && i % 200 === 0) {
        self.postMessage({
          type: 'progress',
          payload: { processed: i, total: items.length }
        });
      }
    }
    self.postMessage({
      type: 'done',
      payload: { results }
    });
  }
};
