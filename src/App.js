import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import Globe from 'react-globe.gl';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const issIcon = new L.Icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/International_Space_Station.svg',
  iconSize: [50, 32],
});

function App() {
  const [issData, setIssData] = useState({ lat: 0, lng: 0, alt: 0, vel: 0 });
  const [locationName, setLocationName] = useState('Loading...');
  const [crew, setCrew] = useState([]);
  const [is3D, setIs3D] = useState(false);
  const globeRef = useRef();

  // Fetch ISS data
  useEffect(() => {
    const fetchISS = async () => {
      const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      const data = await res.json();
      setIssData({
        lat: data.latitude,
        lng: data.longitude,
        alt: data.altitude,
        vel: data.velocity
      });
    };
    fetchISS();
    const interval = setInterval(fetchISS, 3000);
    return () => clearInterval(interval);
  }, []);

  // FIXED: Changed http to https for crew API
  useEffect(() => {
    const fetchCrew = async () => {
      try {
        const res = await fetch('https://api.open-notify.org/astros.json');
        const data = await res.json();
        const issCrew = data.people.filter(person => person.craft === 'ISS');
        setCrew(issCrew);
      } catch (err) {
        console.log('Crew API error:', err);
        setCrew([{ name: 'API blocked by browser' }]);
      }
    };
    fetchCrew();
  }, []);

  // Get location name from lat/lng
  useEffect(() => {
    const getLocation = async () => {
      if (issData.lat === 0 && issData.lng === 0) return;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${issData.lat}&lon=${issData.lng}&format=json`
        );
        const data = await res.json();
        if (data.address) {
          const { country, ocean, sea } = data.address;
          setLocationName(country || ocean || sea || 'Over International Waters');
        } else {
          setLocationName('Over International Waters');
        }
      } catch {
        setLocationName('Over International Waters');
      }
    };
    getLocation();
  }, [issData.lat, issData.lng]);

  // Auto-rotate camera in 3D mode
  useEffect(() => {
    if (is3D && globeRef.current) {
      globeRef.current.pointOfView({ lat: issData.lat, lng: issData.lng, altitude: 2 }, 1000);
    }
  }, [is3D, issData.lat, issData.lng]);

  const issMarker = [{
    lat: issData.lat,
    lng: issData.lng,
    alt: issData.alt / 6371,
    name: 'ISS'
  }];

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <button 
        onClick={() => setIs3D(!is3D)}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          padding: '10px 20px', background: '#000', color: '#fff',
          border: '2px solid #0ff', borderRadius: '8px', cursor: 'pointer'
        }}
      >
        {is3D ? 'Switch to 2D Map' : 'Switch to 3D Globe'}
      </button>

      {/* FIXED: Moved panel down to avoid zoom buttons */}
      <div style={{
        position: 'absolute', top: 60, left: 10, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', padding: '15px', borderRadius: '8px', maxWidth: '320px'
      }}>
        <h3 style={{ marginTop: 0 }}>ISS Tracker built by Vishnupriya Rajesh</h3>
        <p><b>Location:</b> {locationName}</p>
        <p><b>Lat:</b> {issData.lat.toFixed(4)} | <b>Lng:</b> {issData.lng.toFixed(4)}</p>
        <p><b>Speed:</b> {Math.round(issData.vel)} km/h | <b>Altitude:</b> {Math.round(issData.alt)} km</p>
        
        <div style={{ marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
          <b>Crew on board ({crew.length}):</b>
          {crew.length > 0 ? (
            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
              {crew.map((person, i) => (
                <li key={i} style={{ fontSize: '14px' }}>{person.name}</li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '14px', margin: '5px 0' }}>Loading crew...</p>
          )}
        </div>
      </div>

      {is3D ? (
        <Globe
          ref={globeRef}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          htmlElementsData={issMarker}
          htmlElement={d => {
            const el = document.createElement('div');
            el.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/International_Space_Station.svg" width="40" style="transform: rotate(45deg); filter: drop-shadow(0 0 5px cyan);" />`;
            el.style.pointerEvents = 'auto';
            el.title = 'ISS';
            return el;
          }}
          htmlAltitude={d => d.alt}
        />
      ) : (
        <MapContainer 
          center={[issData.lat, issData.lng]} 
          zoom={3} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false} // FIXED: Disable default zoom, we'll add it below
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ZoomControl position="bottomright" /> {/* FIXED: Move zoom to bottom-right */}
          <Marker position={[issData.lat, issData.lng]} icon={issIcon}>
            <Popup>ISS - {locationName}<br/>Crew: {crew.length}</Popup>
          </Marker>
        </MapContainer>
      )}
    </div>
  );
}

export default App;