"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Circle, CircleMarker, LayerGroup, Map as LeafletMap, Polyline, TileLayer } from "leaflet";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  BarChart3,
  BusFront,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  Database,
  Download,
  ExternalLink,
  Info,
  Layers3,
  LocateFixed,
  Maximize2,
  MapPinned,
  Menu,
  Minus,
  Minimize2,
  Pause,
  Plus,
  Play,
  Radio,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Train,
  TriangleAlert,
  X,
} from "lucide-react";

type Mode = "all" | "transit" | "roads";
type View = "overview" | "reliability" | "roads" | "method";
type LayerKey = "pressure" | "transit" | "roads" | "incidents" | "parks";
type TransportFilter = "all" | "tube" | "rail" | "bus" | "tram";
type RouteKind = Exclude<TransportFilter, "all">;
type Coordinate = [number, number];
type MapMode = "2d" | "3d";
type RoutePreference = "fastest" | "simple" | "quiet";
type FeedState = "loading" | "live" | "demo";

type RoutePlan = {
  id: RoutePreference;
  label: string;
  duration: string;
  changes: string;
  pressure: string;
  score: string;
  lineLabel: string;
  summary: string;
  coordinates: Coordinate[];
  accent: string;
};

type LiveVehicle = {
  id: string;
  kind: "train" | "bus";
  line: string;
  colour: string;
  coordinates: Coordinate[];
  progress: number;
};

const hotspots = [
  { id: "a12", name: "A12 · Stratford → City", short: "A12 east", kind: "Road corridor", metric: "1.48×", detail: "travel-time ratio", score: "82", severity: "high", lat: 51.542, lng: -0.032, color: "#e36d5d", context: "Lane restrictions overlap the morning peak." },
  { id: "central", name: "Central line · eastbound", short: "Central line", kind: "Underground", metric: "86.4%", detail: "reliable service", score: "74", severity: "medium", lat: 51.525, lng: -0.054, color: "#d66a61", context: "Headway variance is highest between Mile End and Stratford." },
  { id: "m4", name: "M4 · Hammersmith → Heathrow", short: "M4 west", kind: "Road corridor", metric: "1.36×", detail: "travel-time ratio", score: "68", severity: "medium", lat: 51.489, lng: -0.305, color: "#e89b45", context: "Roadworks and airport demand overlap in the same window." },
  { id: "victoria", name: "Victoria line · northbound", short: "Victoria line", kind: "Underground", metric: "88.1%", detail: "reliable service", score: "62", severity: "medium", lat: 51.497, lng: -0.121, color: "#8172c8", context: "Small but repeated spacing changes are visible at peak." },
  { id: "a23", name: "A23 · Brixton → Croydon", short: "A23 south", kind: "Road corridor", metric: "1.29×", detail: "travel-time ratio", score: "55", severity: "low", lat: 51.414, lng: -0.121, color: "#e89b45", context: "Junction approach pressure builds around the school peak." },
  { id: "dlr", name: "DLR · Stratford → Canary Wharf", short: "DLR east", kind: "Light rail", metric: "89.2%", detail: "reliable service", score: "51", severity: "low", lat: 51.508, lng: 0.005, color: "#00a4a7", context: "Interchange dwell time is the useful signal to investigate here." },
  { id: "bus24", name: "Route 24 · Hampstead → Pimlico", short: "Bus 24", kind: "Bus corridor", metric: "1.22×", detail: "travel-time ratio", score: "48", severity: "low", lat: 51.505, lng: -0.132, color: "#4b86c6", context: "Central-road congestion makes the route sensitive to the afternoon peak." },
  { id: "a406", name: "A406 · North Circular", short: "A406 north", kind: "Road corridor", metric: "1.21×", detail: "travel-time ratio", score: "44", severity: "low", lat: 51.57, lng: -0.12, color: "#e89b45", context: "Freight movements and incident density overlap around the north ring." },
];

const reliability = [
  { name: "Elizabeth", mode: "Rail", value: 93.8, colour: "#8172c8", note: "Most consistent" },
  { name: "Victoria", mode: "Underground", value: 88.1, colour: "#8172c8", note: "Watch headways" },
  { name: "Central", mode: "Underground", value: 86.4, colour: "#d66a61", note: "Eastbound pressure" },
  { name: "District", mode: "Underground", value: 82.7, colour: "#efa85a", note: "Review disruption minutes" },
  { name: "Bus network", mode: "Bus", value: 78.6, colour: "#4b86c6", note: "Most variable" },
];

const roads = [
  { name: "A12 east", value: 1.48, context: "lane restrictions · peak arrivals", level: "High" },
  { name: "M4 west", value: 1.36, context: "roadworks · airport demand", level: "High" },
  { name: "A23 south", value: 1.29, context: "junction approach · school peak", level: "Watch" },
  { name: "A406 north", value: 1.21, context: "incident density · freight window", level: "Watch" },
  { name: "A4 central", value: 1.14, context: "bus-priority works", level: "Stable" },
];

const sources = [
  { name: "TfL Unified API", scope: "Arrivals, line status and station metadata", cadence: "30 sec live feeds", icon: Train },
  { name: "TfL TIMS", scope: "Road disruptions, closures and spatial context", cadence: "5 min refresh", icon: TriangleAlert },
  { name: "DfT traffic statistics", scope: "AADF counts and historic count points", cadence: "Annual / historic", icon: Car },
  { name: "London Datastore", scope: "Open borough and mobility datasets", cadence: "Dataset dependent", icon: Database },
];

const routeLines: { name: string; kind: RouteKind; colour: string; coordinates: Coordinate[] }[] = [
  { name: "Central line", kind: "tube", colour: "#e32017", coordinates: [[51.516, -0.298], [51.516, -0.22], [51.515, -0.15], [51.515, -0.10], [51.515, -0.063], [51.523, -0.052], [51.541, -0.032]] },
  { name: "Victoria line", kind: "tube", colour: "#0098d4", coordinates: [[51.495, -0.149], [51.497, -0.122], [51.501, -0.115], [51.505, -0.106], [51.515, -0.103], [51.527, -0.088]] },
  { name: "Jubilee line", kind: "tube", colour: "#868f98", coordinates: [[51.501, -0.125], [51.505, -0.09], [51.503, -0.05], [51.507, 0.005], [51.514, 0.035], [51.547, 0.079]] },
  { name: "Northern line", kind: "tube", colour: "#111827", coordinates: [[51.565, -0.176], [51.54, -0.146], [51.52, -0.126], [51.505, -0.124], [51.485, -0.123], [51.46, -0.12]] },
  { name: "Piccadilly line", kind: "tube", colour: "#003688", coordinates: [[51.506, -0.424], [51.507, -0.279], [51.51, -0.172], [51.508, -0.128], [51.509, -0.095], [51.512, -0.07]] },
  { name: "District line", kind: "tube", colour: "#00782a", coordinates: [[51.49, -0.305], [51.493, -0.22], [51.501, -0.15], [51.502, -0.12], [51.503, -0.08], [51.51, 0.008]] },
  { name: "Metropolitan line", kind: "tube", colour: "#751056", coordinates: [[51.639, -0.476], [51.56, -0.335], [51.532, -0.22], [51.519, -0.16], [51.517, -0.12], [51.522, -0.09]] },
  { name: "Elizabeth line", kind: "rail", colour: "#6950a1", coordinates: [[51.47, -0.455], [51.515, -0.175], [51.515, -0.103], [51.503, -0.081], [51.505, -0.02], [51.502, 0.022]] },
  { name: "London Overground", kind: "rail", colour: "#ee7c0e", coordinates: [[51.561, -0.176], [51.545, -0.146], [51.535, -0.095], [51.53, -0.04], [51.54, 0.005], [51.56, 0.08]] },
  { name: "National Rail spine", kind: "rail", colour: "#4a5568", coordinates: [[51.49, -0.275], [51.498, -0.18], [51.515, -0.14], [51.53, -0.09], [51.535, 0.02], [51.49, 0.12]] },
  { name: "DLR", kind: "rail", colour: "#00a4a7", coordinates: [[51.508, -0.02], [51.505, 0.005], [51.508, 0.035], [51.501, 0.05], [51.49, 0.06], [51.485, 0.02]] },
  { name: "Bus 24", kind: "bus", colour: "#4b86c6", coordinates: [[51.556, -0.178], [51.535, -0.16], [51.52, -0.15], [51.505, -0.132], [51.49, -0.13]] },
  { name: "Bus 25", kind: "bus", colour: "#4b86c6", coordinates: [[51.552, 0.07], [51.54, 0.02], [51.523, -0.02], [51.515, -0.08], [51.51, -0.13]] },
  { name: "Bus 94", kind: "bus", colour: "#4b86c6", coordinates: [[51.535, -0.33], [51.52, -0.25], [51.515, -0.17], [51.513, -0.1], [51.51, -0.05]] },
  { name: "London Trams", kind: "tram", colour: "#84bd00", coordinates: [[51.419, -0.207], [51.392, -0.163], [51.374, -0.103], [51.376, -0.084], [51.405, -0.075]] },
];

const roadLines: { name: string; coordinates: Coordinate[] }[] = [
  { name: "A12", coordinates: [[51.56, -0.03], [51.543, -0.03], [51.526, -0.035], [51.51, -0.055], [51.495, -0.08]] },
  { name: "M4", coordinates: [[51.49, -0.48], [51.49, -0.39], [51.49, -0.305], [51.49, -0.22], [51.49, -0.14]] },
  { name: "A23", coordinates: [[51.45, -0.126], [51.43, -0.12], [51.414, -0.121], [51.39, -0.11], [51.37, -0.1]] },
  { name: "A406", coordinates: [[51.59, -0.31], [51.58, -0.22], [51.57, -0.12], [51.57, -0.02], [51.56, 0.08]] },
  { name: "A4", coordinates: [[51.49, -0.21], [51.5, -0.16], [51.502, -0.1], [51.505, -0.04], [51.51, 0.03]] },
  { name: "A1", coordinates: [[51.63, -0.2], [51.59, -0.17], [51.55, -0.15], [51.52, -0.14], [51.49, -0.13]] },
  { name: "M1", coordinates: [[51.7, -0.28], [51.65, -0.25], [51.6, -0.22], [51.56, -0.2], [51.52, -0.18]] },
  { name: "A2", coordinates: [[51.49, 0.03], [51.47, 0.05], [51.45, 0.08], [51.43, 0.12], [51.41, 0.16]] },
];

const networkStations = [
  { name: "Stratford", lat: 51.541, lng: -0.003 },
  { name: "King's Cross", lat: 51.53, lng: -0.123 },
  { name: "Victoria", lat: 51.496, lng: -0.144 },
  { name: "Paddington", lat: 51.516, lng: -0.176 },
  { name: "London Bridge", lat: 51.505, lng: -0.086 },
  { name: "Canary Wharf", lat: 51.505, lng: -0.02 },
  { name: "Wimbledon", lat: 51.421, lng: -0.206 },
];

const contextPlaces = [
  { name: "Hyde Park", lat: 51.507, lng: -0.165, radius: 720 },
  { name: "Regent's Park", lat: 51.531, lng: -0.153, radius: 680 },
  { name: "Greenwich Park", lat: 51.476, lng: 0.002, radius: 520 },
  { name: "Richmond Park", lat: 51.442, lng: -0.273, radius: 930 },
];

const incidentPlaces = [
  { name: "A12 lane restriction", lat: 51.538, lng: -0.043, colour: "#e36d5d" },
  { name: "M4 roadworks", lat: 51.489, lng: -0.245, colour: "#e89b45" },
  { name: "A23 junction works", lat: 51.414, lng: -0.121, colour: "#e36d5d" },
  { name: "A406 freight window", lat: 51.57, lng: -0.12, colour: "#e89b45" },
  { name: "Central line headway variance", lat: 51.523, lng: -0.052, colour: "#8172c8" },
];

const plannerPlaces = ["King's Cross", "Paddington", "Stratford", "Heathrow T5", "Canary Wharf", "Victoria", "Wimbledon"];
const plannerCoordinates: Record<string, Coordinate> = {
  "King's Cross": [51.53, -0.123],
  Paddington: [51.516, -0.176],
  Stratford: [51.541, -0.003],
  "Heathrow T5": [51.47, -0.455],
  "Canary Wharf": [51.505, -0.02],
  Victoria: [51.496, -0.144],
  Wimbledon: [51.421, -0.206],
};

const routePlans: RoutePlan[] = [
  {
    id: "fastest",
    label: "Fastest",
    duration: "31 min",
    changes: "1 change",
    pressure: "Low",
    score: "92",
    lineLabel: "Elizabeth → Jubilee",
    summary: "Fast across the centre, with one clean interchange at Whitechapel.",
    coordinates: [[51.53, -0.123], [51.515, -0.103], [51.505, -0.081], [51.505, -0.02]],
    accent: "#0071e3",
  },
  {
    id: "simple",
    label: "Fewest changes",
    duration: "36 min",
    changes: "0 changes",
    pressure: "Low",
    score: "88",
    lineLabel: "Jubilee line",
    summary: "A simple run east with no interchange and fewer decisions on the way.",
    coordinates: [[51.53, -0.123], [51.52, -0.09], [51.505, -0.05], [51.505, -0.02]],
    accent: "#111827",
  },
  {
    id: "quiet",
    label: "Lower pressure",
    duration: "39 min",
    changes: "1 change",
    pressure: "Very low",
    score: "95",
    lineLabel: "Victoria → DLR",
    summary: "A little slower, but it avoids the busiest central interchange window.",
    coordinates: [[51.53, -0.123], [51.515, -0.103], [51.508, -0.035], [51.505, -0.02]],
    accent: "#00a4a7",
  },
];

const liveVehicles: LiveVehicle[] = [
  { id: "elizabeth-1", kind: "train", line: "Elizabeth", colour: "#6950a1", coordinates: routeLines[7].coordinates, progress: .18 },
  { id: "central-1", kind: "train", line: "Central", colour: "#e32017", coordinates: routeLines[0].coordinates, progress: .52 },
  { id: "dlr-1", kind: "train", line: "DLR", colour: "#00a4a7", coordinates: routeLines[10].coordinates, progress: .72 },
  { id: "bus-24-1", kind: "bus", line: "Bus 24", colour: "#4b86c6", coordinates: routeLines[11].coordinates, progress: .36 },
  { id: "bus-25-1", kind: "bus", line: "Bus 25", colour: "#4b86c6", coordinates: routeLines[12].coordinates, progress: .67 },
  { id: "bus-94-1", kind: "bus", line: "Bus 94", colour: "#4b86c6", coordinates: routeLines[13].coordinates, progress: .48 },
];

function interpolateRoute(points: Coordinate[], progress: number): Coordinate {
  if (points.length === 0) return [51.5074, -0.1278];
  if (points.length === 1) return points[0];
  const scaled = Math.min(points.length - 1, Math.max(0, progress)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const remainder = scaled - index;
  const start = points[index];
  const end = points[index + 1];
  return [start[0] + (end[0] - start[0]) * remainder, start[1] + (end[1] - start[1]) * remainder];
}

function getRoutePlans(origin: string, destination: string) {
  const start = plannerCoordinates[origin] ?? routePlans[0].coordinates[0];
  const end = plannerCoordinates[destination] ?? routePlans[0].coordinates[routePlans[0].coordinates.length - 1];
  return routePlans.map((plan) => ({
    ...plan,
    coordinates: [start, ...plan.coordinates.slice(1, -1), end],
    summary: `${origin} to ${destination}. ${plan.summary}`,
  }));
}

function statusClass(value: string) {
  if (value === "High" || value === "high") return "status status--coral";
  if (value === "Medium" || value === "Watch" || value === "medium") return "status status--amber";
  return "status status--blue";
}

function SmallSpark({ colour }: { colour: string }) {
  return <svg className="small-spark" viewBox="0 0 92 25" aria-hidden="true"><path d="M1 18 C8 18 9 11 15 13 S23 19 29 15 S38 3 45 9 S54 19 60 15 S68 7 75 11 S84 15 91 4" fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" /><circle cx="91" cy="4" r="3" fill={colour} /></svg>;
}

function LondonEarthMap({ layers, selectedId, onSelect, mode, activeRoute }: { layers: Record<LayerKey, boolean>; selectedId: string; onSelect: (id: string) => void; mode: Mode; activeRoute: RoutePlan | null }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const baseRef = useRef<Partial<Record<"satellite" | "street" | "labels", TileLayer>>>({});
  const layerRef = useRef<Partial<Record<LayerKey, LayerGroup>>>({});
  const routeGroupRef = useRef<Partial<Record<RouteKind, LayerGroup>>>({});
  const routePlanRef = useRef<Polyline | null>(null);
  const vehicleLayerRef = useRef<LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<Record<string, CircleMarker>>({});
  const markerRef = useRef<Record<string, CircleMarker>>({});
  const pressureRef = useRef<Record<string, Circle>>({});
  const selectedIdRef = useRef(selectedId);
  const [base, setBase] = useState<"satellite" | "street">("satellite");
  const [mapMode, setMapMode] = useState<MapMode>("2d");
  const [transportFilter, setTransportFilter] = useState<TransportFilter>("all");
  const [zoom, setZoom] = useState(11);
  const [timeIndex, setTimeIndex] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showVehicles, setShowVehicles] = useState(true);
  const [vehicleTick, setVehicleTick] = useState(0);
  const [feedState, setFeedState] = useState<FeedState>("loading");
  const [liveSummary, setLiveSummary] = useState("Checking TfL line status…");
  const [lastUpdated, setLastUpdated] = useState("—");
  const timeSlots = ["06:00", "07:30", "09:00", "12:00", "17:30"];
  const pressureLevel = [0.3, 0.62, 0.82, 0.42, 0.68][timeIndex];
  const transportOptions: { id: TransportFilter; label: string }[] = [
    { id: "all", label: "All network" },
    { id: "tube", label: "Tube" },
    { id: "rail", label: "Rail + DLR" },
    { id: "bus", label: "Bus" },
    { id: "tram", label: "Tram" },
  ];

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => setTimeIndex((current) => (current + 1) % timeSlots.length), 1600);
    return () => window.clearInterval(timer);
  }, [isPlaying, timeSlots.length]);

  useEffect(() => {
    if (!showVehicles) return;
    const timer = window.setInterval(() => setVehicleTick((current) => current + 1), 1100);
    return () => window.clearInterval(timer);
  }, [showVehicles]);

  useEffect(() => {
    let disposed = false;
    const refreshFeed = async () => {
      try {
        const [railResponse, busResponse] = await Promise.all([
          fetch("https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line/Status", { headers: { Accept: "application/json" } }),
          fetch("https://api.tfl.gov.uk/Line/Mode/bus/Status", { headers: { Accept: "application/json" } }),
        ]);
        if (!railResponse.ok || !busResponse.ok) throw new Error("TfL status unavailable");
        await Promise.all([
          railResponse.json() as Promise<Array<{ lineStatuses?: Array<{ statusSeverityDescription?: string }> }>>,
          busResponse.json() as Promise<Array<{ lineStatuses?: Array<{ statusSeverityDescription?: string }> }>>,
        ]);
        if (disposed) return;
        setFeedState("live");
        setLiveSummary(`Live rail + bus · feed connected`);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch {
        if (disposed) return;
        setFeedState("demo");
        setLiveSummary("Live-style vehicle playback · status feed unavailable");
        setLastUpdated("demo mode");
      }
    };
    refreshFeed();
    const timer = window.setInterval(refreshFeed, 60000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let disposed = false;
    const initialise = async () => {
      const leafletModule = await import("leaflet");
      const L = leafletModule.default;
      if (disposed || !mapNode.current || mapRef.current || !L) return;

      const map = L.map(mapNode.current, { center: [51.5074, -0.1278], zoom: 11, minZoom: 9, maxZoom: 16, zoomControl: false, attributionControl: false, preferCanvas: true });
      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" });
      const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
      const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: .88, attribution: "" });
      satellite.addTo(map);
      labels.addTo(map);
      baseRef.current = { satellite, street, labels };

      const transitGroup = L.layerGroup().addTo(map);
      (['tube', 'rail', 'bus', 'tram'] as RouteKind[]).forEach((kind) => {
        const group = L.layerGroup();
        routeLines.filter((route) => route.kind === kind).forEach((route) => L.polyline(route.coordinates, { color: route.colour, weight: kind === "bus" ? 3 : 4, opacity: kind === "bus" ? .72 : .9, dashArray: kind === "bus" ? "7 6" : undefined, lineCap: "round", lineJoin: "round" }).addTo(group).bindTooltip(route.name, { sticky: true, direction: "top", className: "earth-tooltip" }));
        transitGroup.addLayer(group);
        routeGroupRef.current[kind] = group;
      });
      const stationsGroup = L.layerGroup();
      networkStations.forEach((station) => L.circleMarker([station.lat, station.lng], { radius: 3.5, color: "#fff", weight: 1.5, fillColor: "#17263d", fillOpacity: .95 }).addTo(stationsGroup).bindTooltip(`${station.name} interchange`, { direction: "top", className: "earth-tooltip" }));
      transitGroup.addLayer(stationsGroup);
      layerRef.current.transit = transitGroup;

      const roadsGroup = L.layerGroup().addTo(map);
      roadLines.forEach((road) => L.polyline(road.coordinates, { color: "#f1c17b", weight: 3, opacity: .84, dashArray: "10 8", lineCap: "butt", lineJoin: "round" }).addTo(roadsGroup).bindTooltip(`${road.name} · road pressure corridor`, { sticky: true, direction: "top", className: "earth-tooltip" }));
      layerRef.current.roads = roadsGroup;

      const pressureGroup = L.layerGroup().addTo(map);
      hotspots.forEach((spot) => {
        pressureRef.current[spot.id] = L.circle([spot.lat, spot.lng], { radius: spot.severity === "high" ? 1150 : spot.severity === "medium" ? 850 : 620, color: spot.color, weight: 1, opacity: .5, fillColor: spot.color, fillOpacity: .16 }).addTo(pressureGroup);
      });
      layerRef.current.pressure = pressureGroup;

      const incidentsGroup = L.layerGroup().addTo(map);
      incidentPlaces.forEach((place) => L.circleMarker([place.lat, place.lng], { radius: 7, color: "#fff", weight: 2, fillColor: place.colour, fillOpacity: 1 }).addTo(incidentsGroup).bindTooltip(place.name, { direction: "top", className: "earth-tooltip" }));
      layerRef.current.incidents = incidentsGroup;

      const parksGroup = L.layerGroup().addTo(map);
      contextPlaces.forEach((place) => L.circle([place.lat, place.lng], { radius: place.radius, color: "#fff", weight: 1, opacity: .7, fillColor: "#5aa6b8", fillOpacity: .1, dashArray: "5 7" }).addTo(parksGroup).bindTooltip(place.name, { direction: "top", className: "earth-tooltip" }));
      layerRef.current.parks = parksGroup;

      hotspots.forEach((spot) => {
        const marker = L.circleMarker([spot.lat, spot.lng], { radius: spot.id === selectedIdRef.current ? 10 : 7, color: "#fff", weight: spot.id === selectedIdRef.current ? 3 : 2, fillColor: spot.color, fillOpacity: 1, className: "earth-hotspot" }).addTo(map);
        marker.bindTooltip(spot.name, { direction: "top", offset: [0, -7], className: "earth-tooltip earth-tooltip--hotspot" });
        marker.on("click", () => onSelect(spot.id));
        markerRef.current[spot.id] = marker;
      });

      const vehicleGroup = L.layerGroup().addTo(map);
      liveVehicles.forEach((vehicle) => {
        const marker = L.circleMarker(interpolateRoute(vehicle.coordinates, vehicle.progress), { radius: vehicle.kind === "bus" ? 6 : 7, color: "#fff", weight: 2, fillColor: vehicle.colour, fillOpacity: 1, className: `earth-vehicle earth-vehicle--${vehicle.kind}` }).addTo(vehicleGroup);
        marker.bindTooltip(`${vehicle.kind === "bus" ? "Bus" : "Train"} · ${vehicle.line} · moving network marker`, { direction: "top", className: "earth-tooltip" });
        vehicleMarkerRef.current[vehicle.id] = marker;
      });
      vehicleLayerRef.current = vehicleGroup;

      map.on("zoomend", () => setZoom(map.getZoom()));
      mapRef.current = map;
      setZoom(map.getZoom());
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 0);
    };
    initialise();
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; markerRef.current = {}; pressureRef.current = {}; layerRef.current = {}; routeGroupRef.current = {}; baseRef.current = {}; routePlanRef.current = null; vehicleLayerRef.current = null; vehicleMarkerRef.current = {}; };
  }, [onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pressure = layerRef.current.pressure;
    const incidents = layerRef.current.incidents;
    const parks = layerRef.current.parks;
    const roads = layerRef.current.roads;
    if (pressure) { if (layers.pressure) pressure.addTo(map); else map.removeLayer(pressure); }
    if (incidents) { if (layers.incidents) incidents.addTo(map); else map.removeLayer(incidents); }
    if (parks) { if (layers.parks) parks.addTo(map); else map.removeLayer(parks); }
    if (roads) { if (layers.roads && mode !== "transit") roads.addTo(map); else map.removeLayer(roads); }

    const transit = layerRef.current.transit;
    if (transit) {
      if (layers.transit && mode !== "roads") transit.addTo(map);
      else map.removeLayer(transit);
      (Object.entries(routeGroupRef.current) as [RouteKind, LayerGroup][]).forEach(([kind, group]) => {
        const show = layers.transit && mode !== "roads" && (transportFilter === "all" || transportFilter === kind);
        if (show) transit.addLayer(group);
        else transit.removeLayer(group);
      });
    }
  }, [layers, mode, transportFilter]);

  useEffect(() => {
    const map = mapRef.current;
    const vehicleGroup = vehicleLayerRef.current;
    if (!map || !vehicleGroup) return;
    if (showVehicles) vehicleGroup.addTo(map);
    else map.removeLayer(vehicleGroup);
    liveVehicles.forEach((vehicle, index) => {
      const marker = vehicleMarkerRef.current[vehicle.id];
      if (!marker) return;
      const progress = (vehicle.progress + vehicleTick * .035 + index * .012) % 1;
      marker.setLatLng(interpolateRoute(vehicle.coordinates, progress));
    });
  }, [showVehicles, vehicleTick]);

  useEffect(() => {
    let disposed = false;
    const updateRoute = async () => {
      const map = mapRef.current;
      if (!map) return;
      if (routePlanRef.current) {
        map.removeLayer(routePlanRef.current);
        routePlanRef.current = null;
      }
      if (!activeRoute) return;
      const leafletModule = await import("leaflet");
      const L = leafletModule.default;
      if (disposed || mapRef.current !== map) return;
      routePlanRef.current = L.polyline(activeRoute.coordinates, { color: activeRoute.accent, weight: 7, opacity: .96, lineCap: "round", lineJoin: "round", className: "route-plan-line" }).addTo(map);
      routePlanRef.current.bindTooltip(`${activeRoute.label} · ${activeRoute.duration} · ${activeRoute.lineLabel}`, { sticky: true, className: "earth-tooltip" });
      routePlanRef.current.bringToFront();
    };
    updateRoute();
    return () => { disposed = true; };
  }, [activeRoute, mapReady]);

  useEffect(() => {
    Object.entries(pressureRef.current).forEach(([id, circle]) => circle.setStyle({ fillOpacity: id === selectedId ? pressureLevel * .27 : pressureLevel * .17 }));
  }, [pressureLevel, selectedId]);

  useEffect(() => {
    Object.entries(markerRef.current).forEach(([id, marker]) => { const spot = hotspots.find((item) => item.id === id); const selected = id === selectedId; marker.setStyle({ radius: selected ? 10 : 7, weight: selected ? 3 : 2 }); if (selected && spot) marker.openTooltip(); else marker.closeTooltip(); });
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const spot = hotspots.find((item) => item.id === selectedId);
    if (!map || !spot) return;
    map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 12), { duration: .7 });
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const satellite = baseRef.current.satellite;
    const street = baseRef.current.street;
    const labels = baseRef.current.labels;
    if (!map || !satellite || !street || !labels) return;
    if (base === "satellite") { map.removeLayer(street); satellite.addTo(map); labels.addTo(map); } else { map.removeLayer(satellite); map.removeLayer(labels); street.addTo(map); }
  }, [base]);

  const adjustZoom = (amount: number) => mapRef.current?.setZoom(Math.min(16, Math.max(9, mapRef.current.getZoom() + amount)));
  const resetView = () => mapRef.current?.setView([51.5074, -0.1278], 11);
  const focusSelected = () => {
    const map = mapRef.current;
    const spot = hotspots.find((item) => item.id === selectedId);
    if (!map || !spot) return;
    map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 12), { duration: .7 });
  };

  return <div className={`earth-map earth-map--${mapMode}`}>
    <div ref={mapNode} className="earth-map__canvas" role="img" aria-label="Detailed London map with public transport routes, road pressure and incident overlays" />
    {mapMode === "3d" && <div className="earth-map__city-depth" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>}
    {!mapReady && <div className="earth-map__loading"><span className="loading-dot" />Loading London map…</div>}
    <div className="earth-map__topbar"><span className="earth-map__badge"><MapPinned size={14} /><strong>LONDON</strong><small>{mapMode === "3d" ? "3D city view" : "real street + satellite base"}</small></span><div className="earth-map__basemap" role="group" aria-label="Map view"><button type="button" className={base === "satellite" && mapMode === "2d" ? "is-active" : ""} onClick={() => { setBase("satellite"); setMapMode("2d"); }}>Satellite</button><button type="button" className={base === "street" && mapMode === "2d" ? "is-active" : ""} onClick={() => { setBase("street"); setMapMode("2d"); }}>Street</button><button type="button" className={mapMode === "3d" ? "is-active" : ""} aria-pressed={mapMode === "3d"} onClick={() => setMapMode((current) => current === "2d" ? "3d" : "2d")}><Sparkles size={12} />3D</button><button type="button" className={`earth-map__live-toggle ${showVehicles ? "is-active" : ""}`} aria-pressed={showVehicles} title={`${liveSummary} · updated ${lastUpdated}`} onClick={() => setShowVehicles((visible) => !visible)}><span className="live-dot" /><Radio size={12} />{showVehicles ? "Live" : "Fleet off"}</button></div></div>
    <div className="earth-map__controls"><button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => adjustZoom(1)}><Plus size={16} /></button><span>{zoom}</span><button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => adjustZoom(-1)}><Minus size={16} /></button><button type="button" aria-label="Focus selected review" title="Focus selected review" onClick={focusSelected}><MapPinned size={15} /></button><button type="button" aria-label="Reset London view" title="Reset London view" onClick={resetView}><LocateFixed size={16} /></button></div>
    <div className="earth-map__note"><Info size={13} /> {feedState === "live" ? `${liveSummary} · status ${lastUpdated}` : feedState === "loading" ? "Connecting to TfL line status…" : "Live-style vehicle playback · click a marker to inspect"}</div>
    <div className="earth-map__network-filter" role="group" aria-label="Transport network filter">{transportOptions.map((option) => <button key={option.id} type="button" aria-pressed={transportFilter === option.id} className={transportFilter === option.id ? "is-active" : ""} onClick={() => setTransportFilter(option.id)}>{option.label}</button>)}</div>
    <div className="earth-map__timeline"><div className="earth-map__timeline-head"><span><span className="timeline-dot" />PRESSURE THROUGH THE DAY</span><strong>{timeSlots[timeIndex]}</strong><small>Move the slider to compare the peak window</small><button type="button" className="timeline-play" onClick={() => setIsPlaying((playing) => !playing)} aria-label={isPlaying ? "Pause time animation" : "Play time animation"}>{isPlaying ? <Pause size={12} /> : <Play size={12} />}<span>{isPlaying ? "Pause" : "Play day"}</span></button></div><input type="range" min="0" max="4" value={timeIndex} onChange={(event) => { setTimeIndex(Number(event.target.value)); setIsPlaying(false); }} aria-label="Inspect time of day" /><div className="earth-map__timeline-labels">{timeSlots.map((slot, index) => <span className={index === timeIndex ? "is-current" : ""} key={slot}>{slot}</span>)}</div></div>
    <div className="earth-map__attribution">© OpenStreetMap contributors{base === "satellite" ? " · Esri, Maxar, Earthstar Geographics" : ""}</div>
  </div>;
}

function RoutePlanner({ open, origin, destination, preference, routeReady, onOriginChange, onDestinationChange, onPreferenceChange, onSwap, onPlan, onClose }: { open: boolean; origin: string; destination: string; preference: RoutePreference; routeReady: boolean; onOriginChange: (value: string) => void; onDestinationChange: (value: string) => void; onPreferenceChange: (value: RoutePreference) => void; onSwap: () => void; onPlan: () => void; onClose: () => void }) {
  if (!open) return null;
  const plans = getRoutePlans(origin, destination);
  const activePlan = plans.find((plan) => plan.id === preference) ?? plans[0];
  return <section className="route-planner" aria-label="Plan a journey">
    <div className="route-planner__head"><div><span className="eyebrow"><Route size={13} /> Journey planner</span><h3>Find the route that fits the moment.</h3><p>Choose your start, finish and what matters most. The map will draw the route and show its trade-off.</p></div><button type="button" className="quiet-icon" aria-label="Close journey planner" onClick={onClose}><X size={16} /></button></div>
    <div className="route-planner__form"><label><span>From</span><select value={origin} onChange={(event) => onOriginChange(event.target.value)}>{plannerPlaces.map((place) => <option key={place}>{place}</option>)}</select></label><button type="button" className="planner-swap" aria-label="Swap origin and destination" title="Swap origin and destination" onClick={onSwap}><ArrowRightLeft size={15} /></button><label><span>To</span><select value={destination} onChange={(event) => onDestinationChange(event.target.value)}>{plannerPlaces.map((place) => <option key={place}>{place}</option>)}</select></label><button type="button" className="planner-submit" onClick={onPlan}><Sparkles size={15} />Show best routes</button></div>
    <div className="route-planner__body"><div className="route-planner__choices" role="group" aria-label="Route preference"><span className="utility-label">Optimise for</span>{plans.map((plan) => <button key={plan.id} type="button" aria-pressed={preference === plan.id} className={preference === plan.id ? "is-active" : ""} onClick={() => onPreferenceChange(plan.id)}><span className="route-choice-dot" style={{ background: plan.accent }} /><span><strong>{plan.label}</strong><small>{plan.duration} · {plan.changes}</small></span></button>)}</div><div className="route-planner__result" style={{ "--route-accent": activePlan.accent } as CSSProperties}><div className="route-result__top"><span className="route-result__badge"><span />{routeReady ? "Route ready" : "Preview"}</span><strong>{activePlan.score}<small>/100 route score</small></strong></div><h4>{activePlan.label} · {activePlan.duration}</h4><p>{activePlan.summary}</p><div className="route-result__meta"><span><Train size={13} />{activePlan.lineLabel}</span><span><BusFront size={13} />Pressure {activePlan.pressure}</span><span>{activePlan.changes}</span></div></div></div>
    <div className="route-planner__foot"><span><Info size={13} /> Route scoring is illustrative in this prototype; it balances time, changes and network pressure.</span>{routeReady && <button type="button" className="route-clear" onClick={onClose}>Close planner</button>}</div>
  </section>;
}

function OverviewTable({ mode, onSelect }: { mode: Mode; onSelect: (id: string) => void }) {
  const rows = [
    { zone: "East", transit: "86.4%", road: "1.48×", incidents: "14", action: "A12 signal review", target: "a12" },
    { zone: "West", transit: "91.2%", road: "1.36×", incidents: "9", action: "Coordinate M4 works", target: "m4" },
    { zone: "South", transit: "88.1%", road: "1.29×", incidents: "7", action: "Review A23 junction", target: "a23" },
    { zone: "North", transit: "89.7%", road: "1.21×", incidents: "6", action: "Monitor A406 freight", target: "a406" },
  ];
  const display = mode === "transit" ? rows.map((row) => ({ ...row, road: "—", incidents: "—" })) : mode === "roads" ? rows.map((row) => ({ ...row, transit: "—" })) : rows;
  return <div className="table-scroll"><table><caption className="sr-only">London sector pressure summary</caption><thead><tr><th>Sector</th><th>Transit reliability</th><th>Road delay ratio</th><th>Context points</th><th>Suggested review</th></tr></thead><tbody>{display.map((row, index) => <tr key={row.zone}><td><span className={`sector-marker sector-marker--${index}`} />{row.zone}</td><td className={row.transit.startsWith("86") ? "value-coral" : ""}>{row.transit}</td><td className={row.road.startsWith("1.4") ? "value-coral" : ""}>{row.road}</td><td>{row.incidents}</td><td className="action-cell"><button type="button" className="table-action" onClick={() => onSelect(row.target)}>{row.action}<ChevronRight size={15} /></button></td></tr>)}</tbody></table></div>;
}

function ReliabilityPanel() {
  return <div className="analysis-grid"><div className="analysis-copy"><span className="eyebrow">A fair comparison</span><h3>Reliability by scheduled service time</h3><p>Routes are compared by the share of scheduled operating minutes without a recorded disruption. That keeps a high-frequency route from looking worse simply because it runs more often.</p><div className="plain-formula"><span>scheduled minutes</span><b>−</b><span>disruption minutes</span><b>/</b><span>scheduled minutes</span></div></div><div className="bar-list">{reliability.map((line) => <div className="bar-row" key={line.name}><div className="bar-row__label"><strong>{line.name}</strong><small>{line.mode} · {line.note}</small></div><div className="bar-track"><span style={{ width: `${line.value}%`, background: line.colour }} /></div><strong className="bar-value">{line.value}%</strong></div>)}</div></div>;
}

function RoadsPanel() {
  return <div className="analysis-grid"><div className="analysis-copy"><span className="eyebrow">Road pressure</span><h3>Where travel is taking longer</h3><p>The delay ratio compares observed corridor travel time with a free-flow baseline. Context is presented as a lead to investigate, not proof that one factor caused the delay.</p><div className="signal-key"><span><i className="key-dot key-dot--coral" />higher pressure</span><span><i className="key-dot key-dot--amber" />review signal</span></div></div><div className="road-list">{roads.map((road) => <div className="road-row" key={road.name}><div className="road-row__head"><strong>{road.name}</strong><b>{road.value.toFixed(2)}×</b></div><div className="road-track"><span style={{ width: `${Math.min(100, (road.value - 1) * 175)}%` }} /></div><div className="road-row__foot"><small>{road.context}</small><span className={statusClass(road.level)}>{road.level}</span></div></div>)}</div></div>;
}

function MethodPanel() {
  return <div className="method-grid"><div className="analysis-copy"><span className="eyebrow">How this can become live</span><h3>One small, refreshable data model</h3><p>The prototype is organised around a joinable model: transport events, road conditions, context signals, locations and time. Swap in official extracts and the same measures can be recalculated.</p><div className="pipeline"><span>collect</span><ChevronRight size={14} /><span>clean</span><ChevronRight size={14} /><span>compare</span><ChevronRight size={14} /><span>review</span></div></div><div className="source-list">{sources.map((source) => { const SourceIcon = source.icon; return <div className="source-row" key={source.name}><span className="source-icon"><SourceIcon size={16} /></span><div><strong>{source.name}</strong><small>{source.scope}</small></div><em>{source.cadence}</em></div>; })}</div></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [mode, setMode] = useState<Mode>("all");
  const [selectedId, setSelectedId] = useState("a12");
  const [mobileNav, setMobileNav] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ pressure: true, transit: true, roads: true, incidents: true, parks: true });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [notesOpen, setNotesOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [mapControlsOpen, setMapControlsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerOrigin, setPlannerOrigin] = useState("King's Cross");
  const [plannerDestination, setPlannerDestination] = useState("Canary Wharf");
  const [routePreference, setRoutePreference] = useState<RoutePreference>("fastest");
  const [routeReady, setRouteReady] = useState(false);
  const selected = hotspots.find((spot) => spot.id === selectedId) ?? hotspots[0];
  const navItems: { id: View; label: string; icon: typeof Compass }[] = [{ id: "overview", label: "Overview", icon: Compass }, { id: "reliability", label: "Transit", icon: Train }, { id: "roads", label: "Roads", icon: Car }, { id: "method", label: "Method", icon: BarChart3 }];
  const toggleLayer = (key: LayerKey) => setLayers((current) => ({ ...current, [key]: !current[key] }));
  const filteredHotspots = severityFilter === "all" ? hotspots : hotspots.filter((spot) => spot.severity === severityFilter);
  const nextPlaces = filteredHotspots.length > 0 ? filteredHotspots.slice(0, 3) : hotspots.slice(0, 3);
  const activeRoute = routeReady ? (getRoutePlans(plannerOrigin, plannerDestination).find((plan) => plan.id === routePreference) ?? null) : null;
  const query = searchQuery.trim().toLowerCase();
  const searchMatches = query ? hotspots.filter((spot) => `${spot.name} ${spot.kind} ${spot.short}`.toLowerCase().includes(query)).slice(0, 4) : [];
  const scrollTo = (selector: string) => document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const exportReview = () => {
    const header = "name,kind,metric,detail,review_score,severity,context";
    const rows = hotspots.map((spot) => [spot.name, spot.kind, spot.metric, spot.detail, spot.score, spot.severity, spot.context].map((value) => `"${value.replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "motion-london-network-review.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className={`city-shell ${focusMode ? "city-shell--focus" : ""}`}>
    <header className="site-bar"><div className="brand"><span className="brand-icon"><Route size={17} /></span><div><strong>MOTION</strong><small>London network review</small></div></div><nav className={`top-nav ${mobileNav ? "top-nav--open" : ""}`} aria-label="Dashboard views">{navItems.map((item) => { const NavIcon = item.icon; return <button type="button" className={view === item.id ? "is-active" : ""} key={item.id} onClick={() => { setView(item.id); setMobileNav(false); }}><NavIcon size={15} />{item.label}</button>; })}</nav><div className="site-actions"><span className="data-tag"><span />Illustrative data</span><button type="button" className={`round-action ${searchOpen ? "is-active" : ""}`} aria-label="Search" aria-expanded={searchOpen} onClick={() => { setSearchOpen((open) => !open); setFilterOpen(false); }}><Search size={16} /></button><button type="button" className={`round-action ${filterOpen ? "is-active" : ""}`} aria-label="More filters" aria-expanded={filterOpen} onClick={() => { setFilterOpen((open) => !open); setSearchOpen(false); }}><SlidersHorizontal size={16} /></button><button type="button" className="mobile-trigger" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X size={19} /> : <Menu size={19} />}</button></div></header>
    {searchOpen && <section className="utility-strip utility-strip--search" role="search"><label htmlFor="network-search"><Search size={15} /><input id="network-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find a route, corridor or hotspot" autoFocus /></label>{query && <div className="search-results" aria-live="polite">{searchMatches.length > 0 ? searchMatches.map((spot) => <button key={spot.id} type="button" onClick={() => { setSelectedId(spot.id); setSearchOpen(false); setSearchQuery(spot.short); }}><span className="search-dot" style={{ background: spot.color }} /><span><strong>{spot.name}</strong><small>{spot.metric} · {spot.kind}</small></span><ChevronRight size={14} /></button>) : <span className="search-empty">No review point matches “{searchQuery}”. Try A12, Central, Bus 24 or DLR.</span>}</div>}</section>}
    {filterOpen && <section className="utility-strip utility-strip--filters" aria-label="Review filters"><div><span className="utility-label">Pressure level</span><div className="filter-options" role="group" aria-label="Pressure level"><button type="button" className={severityFilter === "all" ? "is-active" : ""} onClick={() => setSeverityFilter("all")}>All points</button><button type="button" className={severityFilter === "high" ? "is-active" : ""} onClick={() => setSeverityFilter("high")}>High</button><button type="button" className={severityFilter === "medium" ? "is-active" : ""} onClick={() => setSeverityFilter("medium")}>Watch</button><button type="button" className={severityFilter === "low" ? "is-active" : ""} onClick={() => setSeverityFilter("low")}>Low</button></div></div><span className="filter-count">{filteredHotspots.length} review points in the briefing</span><button type="button" className="export-action" onClick={exportReview}><Download size={14} />Export CSV</button></section>}
    <section className="intro"><div><span className="overline"><CalendarDays size={14} /> WEEKLY NETWORK REVIEW · 07–13 SEP 2026</span><h1>London, in motion.</h1><p>A map-led read of where journeys slowed, which services lost time, and what deserves a closer look.</p><div className="intro-actions"><button type="button" className="intro-action intro-action--blue" onClick={() => { setPlannerOpen(true); scrollTo(".map-card"); }}><span className="intro-action__icon"><Route size={16} /></span><span><strong>Plan a journey</strong><small>Compare your best route</small></span><ChevronRight size={15} /></button><button type="button" className="intro-action intro-action--coral" onClick={() => scrollTo(".map-card")}><span className="intro-action__icon"><MapPinned size={16} /></span><span><strong>Explore the map</strong><small>See pressure and live activity</small></span><ChevronRight size={15} /></button></div></div><div className="intro-side"><span className="intro-side__label">Network lens</span><div className="mode-picker" role="group" aria-label="Network mode"><button type="button" className={mode === "all" ? "is-active" : ""} onClick={() => setMode("all")}>Everything</button><button type="button" className={mode === "transit" ? "is-active" : ""} onClick={() => setMode("transit")}><Train size={14} />Transit</button><button type="button" className={mode === "roads" ? "is-active" : ""} onClick={() => setMode("roads")}><Car size={14} />Roads</button></div><span className="mode-explainer">{mode === "all" ? "Everything stays visible." : mode === "transit" ? "Rail, bus and tram only." : "Road corridors only."}</span><span className="snapshot-note"><span className="snapshot-dot" />Baseline review · live activity is separate</span></div></section>
    <section className="wayfinder" aria-label="How to use the review"><div className="wayfinder__lead"><div><span className="eyebrow">First visit?</span><strong>Three moves. One clear answer.</strong></div><button type="button" className="wayfinder-toggle" aria-expanded={guideOpen} onClick={() => setGuideOpen((open) => !open)}>{guideOpen ? "Hide guide" : "How it works"}{guideOpen ? <X size={13} /> : <ChevronRight size={13} />}</button></div>{guideOpen && <div className="wayfinder__steps"><button type="button" className="wayfinder__step" onClick={() => { setMode("all"); scrollTo(".map-card"); }}><span className="wayfinder__step-number">01</span><span className="wayfinder__step-icon wayfinder__step-icon--blue"><Compass size={15} /></span><span><strong>Choose a lens</strong><small>Everything, transit or roads.</small></span><ChevronRight size={14} /></button><button type="button" className="wayfinder__step" onClick={() => scrollTo(".map-card")}><span className="wayfinder__step-number">02</span><span className="wayfinder__step-icon wayfinder__step-icon--coral"><MapPinned size={15} /></span><span><strong>Pick a coloured point</strong><small>Each point opens one review.</small></span><ChevronRight size={14} /></button><button type="button" className="wayfinder__step" onClick={() => { setNotesOpen(true); scrollTo(".insight-column"); }}><span className="wayfinder__step-number">03</span><span className="wayfinder__step-icon wayfinder__step-icon--lilac"><Info size={15} /></span><span><strong>Read the reason</strong><small>Then open the corridor note.</small></span><ChevronRight size={14} /></button></div>}</section>
    <section className="headline-metrics"><article><div className="metric-label"><span>Transit reliability</span><span className="metric-icon metric-icon--lilac"><Train size={15} /></span></div><strong>84.2<span>%</span></strong><div className="metric-bottom"><span className="metric-change metric-change--down"><ArrowDownRight size={13} />2.1 pts</span><small>normalised service time</small><SmallSpark colour="#8172c8" /></div></article><article><div className="metric-label"><span>Road travel time</span><span className="metric-icon metric-icon--amber"><Car size={15} /></span></div><strong>1.34<span>×</span></strong><div className="metric-bottom"><span className="metric-change metric-change--up"><ArrowUpRight size={13} />0.08×</span><small>above free-flow</small><SmallSpark colour="#e89b45" /></div></article><article><div className="metric-label"><span>Context signals</span><span className="metric-icon metric-icon--blue"><Info size={15} /></span></div><strong>36</strong><div className="metric-bottom"><span className="metric-change metric-change--neutral">4 source groups</span><small>joinable review points</small><SmallSpark colour="#4b86c6" /></div></article><article><div className="metric-label"><span>Priority reviews</span><span className="metric-icon metric-icon--coral"><TriangleAlert size={15} /></span></div><strong>6</strong><div className="metric-bottom"><span className="metric-change metric-change--coral">2 urgent</span><small>ranked by pressure</small><SmallSpark colour="#e36d5d" /></div></article></section>
    <section className="map-layout"><article className="map-card"><div className="card-heading"><div><span className="eyebrow">London network map</span><h2>Where the network is under pressure</h2><p className="map-heading-copy">Select a signal or plan a journey to see what deserves attention next.</p></div><div className="map-heading-actions"><button type="button" className="planner-trigger" aria-expanded={plannerOpen} onClick={() => setPlannerOpen((open) => !open)}><Route size={14} />{plannerOpen ? "Hide planner" : "Plan a journey"}</button><button type="button" className="map-controls-trigger" aria-expanded={mapControlsOpen} onClick={() => setMapControlsOpen((open) => !open)}><Layers3 size={14} />{mapControlsOpen ? "Hide controls" : "Map controls"}{mapControlsOpen ? <X size={13} /> : <ChevronRight size={13} />}</button><button type="button" className="map-controls-trigger map-focus-trigger" aria-pressed={focusMode} onClick={() => setFocusMode((open) => !open)}>{focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{focusMode ? "Exit focus" : "Focus map"}</button></div></div>{mapControlsOpen && <div className="map-controls-panel"><span className="utility-label">Map layers</span><div className="layer-picker">{(["pressure", "transit", "roads", "incidents", "parks"] as LayerKey[]).map((key) => <button type="button" aria-pressed={layers[key]} className={layers[key] ? "is-on" : ""} key={key} onClick={() => toggleLayer(key)}><i />{key === "pressure" ? "Pressure" : key === "transit" ? "Transit" : key === "roads" ? "Roads" : key === "incidents" ? "Incidents" : "Parks"}</button>)}</div><span className="map-controls-help">Use the strip inside the map to focus Tube, rail, bus or tram. Turn on Live to see moving fleet markers.</span><button type="button" className="quiet-action" onClick={exportReview}><Download size={14} />Download points</button></div>}<RoutePlanner open={plannerOpen} origin={plannerOrigin} destination={plannerDestination} preference={routePreference} routeReady={routeReady} onOriginChange={(value) => { setPlannerOrigin(value); setRouteReady(false); }} onDestinationChange={(value) => { setPlannerDestination(value); setRouteReady(false); }} onPreferenceChange={(value) => { setRoutePreference(value); setRouteReady(false); }} onSwap={() => { setPlannerOrigin(plannerDestination); setPlannerDestination(plannerOrigin); setRouteReady(false); }} onPlan={() => setRouteReady(true)} onClose={() => setPlannerOpen(false)} /><LondonEarthMap layers={layers} mode={mode} selectedId={selectedId} onSelect={setSelectedId} activeRoute={activeRoute} /><div className="map-legend"><span><i className="legend-stroke legend-stroke--coral" />Tube / rail</span><span><i className="legend-stroke legend-stroke--blue" />Bus + tram</span><span><i className="legend-stroke legend-stroke--dashed" />Road pressure</span><span><i className="legend-pin legend-pin--coral" />Incident</span>{activeRoute && <span className="active-route-legend"><i className="legend-stroke" style={{ background: activeRoute.accent }} />{activeRoute.label} route</span>}<button type="button" className="legend-help" aria-expanded={legendOpen} onClick={() => setLegendOpen((open) => !open)}><Info size={12} />{legendOpen ? "Hide map key" : "What do the marks mean?"}</button></div>{legendOpen && <div className="map-explainer" role="note"><strong>Read the map in layers.</strong> Coloured lines are services, dashed lines are road corridors, circles are review points and darker zones show the pressure signal. Use a point as an investigation lead, not proof of causation. The moving fleet markers are a product preview; line status checks TfL when reachable.</div>}</article>
      <aside className="insight-column"><article key={selected.id} className="selected-card selected-card--animated"><div className="selected-card__top"><span className="eyebrow">Selected review</span><span className={statusClass(selected.severity)}>{selected.severity}</span></div><div className="selected-title"><span className="selected-chip" style={{ background: selected.color }} /> <h2>{selected.name}</h2></div><p>{selected.context}</p><div className="selected-stats"><div><span>Signal</span><strong>{selected.metric}</strong><small>{selected.detail}</small></div><div><span>Review score</span><strong>{selected.score}<em>/100</em></strong><small>pressure × evidence</small></div></div><div className="checks"><span className="checks-title">What to check next</span><div><CheckCircle2 size={15} /><span>Compare the same window last week</span></div><div><CheckCircle2 size={15} /><span>Match incidents to the corridor geometry</span></div><div><CheckCircle2 size={15} /><span>Keep association separate from causation</span></div></div><button type="button" className="card-link" onClick={() => setNotesOpen((open) => !open)}>{notesOpen ? "Close corridor notes" : "Open corridor notes"} {notesOpen ? <X size={14} /> : <ArrowUpRight size={15} />}</button>{notesOpen && <div className="notes-panel" role="dialog" aria-label={`${selected.name} corridor notes`}><div className="notes-panel__head"><span className="eyebrow">Working note</span><span>{selected.kind}</span></div><p>Use this point as a structured investigation lead. The prototype joins a location, a time window and a pressure signal; it does not claim that the nearby context caused the delay.</p><div className="notes-panel__row"><span>Window</span><strong>07:30–09:00</strong></div><div className="notes-panel__row"><span>Next join</span><strong>TfL event + road context</strong></div></div>}</article><article className="next-card"><div className="next-card__head"><div><span className="eyebrow">Next places to look</span><h2>Three useful reviews</h2></div><MapPinned size={18} /></div><div className="next-list">{nextPlaces.map((spot, index) => <button type="button" key={spot.id} onClick={() => setSelectedId(spot.id)} className={spot.id === selectedId ? "is-selected" : ""}><span className="list-number">0{index + 1}</span><span><strong>{spot.short}</strong><small>{spot.metric} · {spot.kind}</small></span><ChevronRight size={15} /></button>)}</div><div className="next-card__foot"><span><Clock3 size={13} />Morning peak window</span><button type="button" onClick={() => { setView("roads"); document.querySelector(".comparison-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>See pressure <ChevronRight size={13} /></button></div></article></aside>
    </section>
    <section className="comparison-card"><div className="comparison-tabs" role="tablist" aria-label="Analysis views">{navItems.map((item) => <button type="button" role="tab" aria-selected={view === item.id} className={view === item.id ? "is-active" : ""} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}</div><div className="comparison-body">{view === "overview" && <><div className="comparison-heading"><div><span className="eyebrow">Sector comparison</span><h2>Pressure by operating area</h2></div><div className="comparison-tools"><span className="coverage"><span />{filteredHotspots.length} review points in view</span><button type="button" className="quiet-action" onClick={exportReview}><Download size={14} />Export CSV</button></div></div><OverviewTable mode={mode} onSelect={(id) => { setSelectedId(id); document.querySelector(".map-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} /></>}{view === "reliability" && <ReliabilityPanel />}{view === "roads" && <RoadsPanel />}{view === "method" && <MethodPanel />}</div></section>
    <footer className="page-footer"><span><Database size={14} /> Built around TfL, DfT and London Datastore sources</span><span>Python · pandas · SQL · R · Tableau-ready output</span><a href="https://tfl.gov.uk/info-for/open-data-users/our-open-data" target="_blank" rel="noreferrer">Read source notes <ExternalLink size={13} /></a></footer>
  </main>;
}
