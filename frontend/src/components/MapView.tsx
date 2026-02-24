import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons (Leaflet + bundlers issue)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─── Custom colored marker ─────────────────────────────────────────────────────
export const createColoredIcon = (color: string, size: 'sm' | 'md' | 'lg' = 'md') => {
  const sizes = { sm: [20, 32], md: [25, 41], lg: [32, 50] }
  const [w, h] = sizes[size]
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="
      background: ${color};
      width: ${w}px; height: ${h}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  })
}

// Pulse marker for live/active indicators
export const createPulseIcon = (color: string) => L.divIcon({
  className: 'pulse-map-marker',
  html: `<div style="position:relative;width:14px;height:14px">
    <div style="position:absolute;width:14px;height:14px;border-radius:50%;background:${color};opacity:0.9;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>
    <div style="position:absolute;width:14px;height:14px;border-radius:50%;background:${color};animation:mapPulse 2s infinite"></div>
  </div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
})

// ─── Map click handler component ────────────────────────────────────────────────
interface ClickHandlerProps {
  onClick: (lat: number, lng: number) => void
}
const ClickHandler: React.FC<ClickHandlerProps> = ({ onClick }) => {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

// ─── Fit bounds helper ──────────────────────────────────────────────────────────
interface FitBoundsProps {
  bounds: L.LatLngBoundsExpression | null
  padding?: [number, number]
}
const FitBounds: React.FC<FitBoundsProps> = ({ bounds, padding = [40, 40] }) => {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      try { map.fitBounds(bounds, { padding, maxZoom: 16 }) } catch { /* empty bounds */ }
    }
  }, [bounds, map, padding])
  return null
}

// ─── Heatmap layer (uses leaflet.heat) ──────────────────────────────────────────
interface HeatmapLayerProps {
  points: [number, number, number][] // [lat, lng, intensity]
  radius?: number
  blur?: number
  maxZoom?: number
}
const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points, radius = 25, blur = 15, maxZoom = 17 }) => {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    // @ts-ignore – leaflet.heat adds L.heatLayer
    const heat = (L as any).heatLayer(points, { radius, blur, maxZoom, gradient: { 0.2: '#2196f3', 0.4: '#4caf50', 0.6: '#ffeb3b', 0.8: '#ff9800', 1.0: '#f44336' } })
    heat.addTo(map)
    return () => { map.removeLayer(heat) }
  }, [points, map, radius, blur, maxZoom])
  return null
}

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface MapMarker {
  id: string
  lat: number
  lng: number
  color?: string
  title?: string
  popup?: React.ReactNode
  pulse?: boolean
  icon?: L.Icon | L.DivIcon
}

export interface MapCircle {
  id: string
  lat: number
  lng: number
  radius: number // meters
  color?: string
  fillColor?: string
  fillOpacity?: number
  popup?: React.ReactNode
}

export interface MapPolylineData {
  id?: string
  positions: [number, number][]
  color?: string
  weight?: number
  dashArray?: string
  popup?: React.ReactNode
}

export interface HeatPoint {
  lat: number
  lng: number
  intensity: number
}

export interface MapViewProps {
  height?: string | number
  center?: [number, number]
  zoom?: number
  markers?: MapMarker[]
  circles?: MapCircle[]
  polylines?: MapPolylineData[]
  heatmap?: HeatPoint[]
  onClick?: (lat: number, lng: number) => void
  fitToData?: boolean
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

// ─── Main MapView Component ─────────────────────────────────────────────────────
const MapView: React.FC<MapViewProps> = ({
  height = 400,
  center,
  zoom = 5,
  markers = [],
  circles = [],
  polylines = [],
  heatmap = [],
  onClick,
  fitToData = true,
  style,
  className,
  children,
}) => {
  const mapRef = useRef<any>(null)

  const isValidCoord = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)

  // Filter markers/circles with invalid coords before computing bounds
  const validMarkers = markers.filter(m => isValidCoord(m.lat, m.lng))
  const validCircles = circles.filter(c => isValidCoord(c.lat, c.lng))
  const validPolylines = polylines.filter(p => p.positions.every(([lat, lng]) => isValidCoord(lat, lng)))
  const validHeatmap = heatmap.filter(h => isValidCoord(h.lat, h.lng))

  // Compute bounds from all valid data
  const allPoints: [number, number][] = [
    ...validMarkers.map(m => [m.lat, m.lng] as [number, number]),
    ...validCircles.map(c => [c.lat, c.lng] as [number, number]),
    ...validPolylines.flatMap(p => p.positions),
    ...validHeatmap.map(h => [h.lat, h.lng] as [number, number]),
  ]

  const bounds = allPoints.length >= 2 ? L.latLngBounds(allPoints) : null
  const defaultCenter: [number, number] = center || (allPoints.length === 1 ? allPoints[0] : [20.5937, 78.9629]) // Default: India center

  return (
    <div className={`map-view-container ${className || ''}`} style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', ...style }}>
      <style>{`
        .map-view-container .leaflet-container { height: 100%; width: 100%; font-family: inherit; }
        .custom-map-marker, .pulse-map-marker { background: transparent !important; border: none !important; }
        @keyframes mapPulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(3); opacity: 0; } }
      `}</style>

      <MapContainer
        ref={mapRef}
        center={defaultCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {fitToData && bounds && <FitBounds bounds={bounds} />}

        {onClick && <ClickHandler onClick={onClick} />}

        {validMarkers.map(m => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={m.icon || (m.pulse ? createPulseIcon(m.color || '#ef4444') : m.color ? createColoredIcon(m.color) : new L.Icon.Default())}
          >
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}

        {validCircles.map(c => (
          <Circle
            key={c.id}
            center={[c.lat, c.lng]}
            radius={c.radius}
            pathOptions={{
              color: c.color || '#667eea',
              fillColor: c.fillColor || c.color || '#667eea',
              fillOpacity: c.fillOpacity ?? 0.2,
              weight: 2,
            }}
          >
            {c.popup && <Popup>{c.popup}</Popup>}
          </Circle>
        ))}

        {validPolylines.map((pl, i) => (
          <Polyline
            key={i}
            positions={pl.positions}
            pathOptions={{
              color: pl.color || '#667eea',
              weight: pl.weight || 3,
              dashArray: pl.dashArray,
            }}
          >
            {pl.popup && <Popup>{pl.popup}</Popup>}
          </Polyline>
        ))}

        {validHeatmap.length > 0 && (
          <HeatmapLayer points={validHeatmap.map(h => [h.lat, h.lng, h.intensity])} />
        )}

        {children}
      </MapContainer>
    </div>
  )
}

export default MapView
