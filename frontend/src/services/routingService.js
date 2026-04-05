const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

const buildInterpolatedRoute = (start, end, steps = 60) => {
  const route = [];
  const latStep = (end[0] - start[0]) / steps;
  const lngStep = (end[1] - start[1]) / steps;

  for (let index = 0; index <= steps; index += 1) {
    route.push([
      start[0] + latStep * index,
      start[1] + lngStep * index,
    ]);
  }

  return route;
};

export const getRoadRoute = async (start, end) => {
  try {
    const coordinates = `${start[1]},${start[0]};${end[1]},${end[0]}`;
    const response = await fetch(
      `${OSRM_BASE_URL}/${coordinates}?overview=full&geometries=geojson`
    );

    if (!response.ok) {
      throw new Error(`Routing failed with status ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => [
      lat,
      lng,
    ]);

    if (!route || route.length < 2) {
      throw new Error("Routing service returned an empty route");
    }

    return route;
  } catch (error) {
    console.warn("Falling back to interpolated route:", error.message);
    return buildInterpolatedRoute(start, end);
  }
};

