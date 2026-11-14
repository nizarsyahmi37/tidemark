'use client';
import { CircleMarker, MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';

export type Box = [number, number, number, number]; // west, south, east, north

function ClickToPick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function Follow({ lat, lon, box }: { lat: number; lon: number; box: Box | null }) {
  const map = useMap();
  useEffect(() => {
    if (box) map.fitBounds([[box[1], box[0]], [box[3], box[2]]], { padding: [60, 60], maxZoom: 7 });
    else map.setView([lat, lon], Math.max(map.getZoom(), 5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, box?.join(',')]);
  return null;
}

/** Click anywhere to place the spot (or the centre of the area). The area box is computed by the parent. */
export default function PlaceMap({ lat, lon, box, onPick }: { lat: number; lon: number; box: Box | null; onPick: (lat: number, lon: number) => void }) {
  return (
    <div className="map-wrap" role="application" aria-label="Map. Click to choose a place.">
      <MapContainer center={[lat, lon]} zoom={5} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToPick onPick={onPick} />
        <Follow lat={lat} lon={lon} box={box} />
        {box && <Rectangle bounds={[[box[1], box[0]], [box[3], box[2]]]} pathOptions={{ color: '#087f73', weight: 2, fillOpacity: 0.15 }} />}
        <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#087f73', fillOpacity: 1 }} />
      </MapContainer>
      <div className="map-hint">Click the map to move the pin</div>
    </div>
  );
}
