import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import Globe from 'react-globe.gl';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const issIcon = new L.Icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/International_Space_Station.svg',
  iconSize: [40, 25],
  iconAnchor: [20, 12],
});

function App() {
  const [issData, setIssData] = useState({
    latitude: 0,
    longitude: 0,
    velocity: 0,
    altitude: 0,
    visibility: 'calculating...'
  });
  const [pastPath, setPastPath] = useState([]);
  const [futurePath, setFuturePath] = useState([]);
  const [is3D, setIs3D] = useState(false); // 2D loads first
  const [loading, setLoading] = useState(true);
  const globeEl = useRef();

  useEffect(() => {
    const updatePosition = () => {
      fetch('https://api.wheretheiss.at/v1/satellites/25544')
       .then(res => res.json())
       .then(data => {
          setIssData({
            latitude: data.latitude,
            longitude: data.longitude,
            velocity: Math.round(data.velocity),
            altitude: Math.round(data.altitude),
            visibility: data.visibility === 'daylight' ? 'In Sunlight ☀️' : 'In Earth\'s Shadow 🌑'
          });

          setPastPath(prev => {
            const newPath = [...prev, [data.latitude, data.longitude]];
            return newPath.slice(-60); // Keep last 2min
          });

          setLoading(false);
        })
       .catch(err => console.log('ISS API error:', err));
    };

    const getPrediction = () => {
      const now = Math.floor(Date.now() / 1000);
      const timestamps = [];
      for (let i = 1; i <= 90; i++) {
        timestamps.push(now + i * 60);
      }
      
      fetch(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${timestamps.join(',')}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            const path = data
              .filter(pos => pos && typeof pos.latitude === 'number' && typeof pos.longitude === 'number')
              .map(pos => [pos.latitude, pos.longitude]);
            setFuturePath(path);
          }
        })
        .catch(err => console.log('Prediction API error:', err));
    };

    updatePosition();
    getPrediction();
    const interval = setInterval(updatePosition, 2000);
    const predictInterval = setInterval(getPrediction, 60000);
    
    return () => {
      clearInterval(interval);
      clearInterval(predictInterval);
    };
  }, []);

  useEffect(() => {
    if (globeEl.current && is3D && !loading && issData.latitude !== 0) {
      globeEl.current.pointOfView({ 
        lat: issData.latitude, 
        lng: issData.longitude, 
        altitude: 2.5 
      }, 1000);
    }
  }, [issData.latitude, issData.longitude, is3D, loading]);

  // Build stable 3D arcs from path data
  const buildArcs = (pathArray, isPrediction = false) => {
    if (pathArray.length < 2) return [];
    const arcs = [];
    for (let i = 0; i < pathArray.length - 1; i++) {
      arcs.push({
        startLat: pathArray[i][0],
        startLng: pathArray[i][1],
        endLat: pathArray[i + 1][0],
        endLng: pathArray[i + 1][1],
        color: isPrediction ? 'rgba(255, 51, 51, 0.4)' : '#ff3333'
      });
    }
    return arcs;
  };

  const hasPosition = issData.latitude !== 0 && issData.longitude !== 0;
  const pastArcs = buildArcs(pastPath, false);
  const futureArcs = buildArcs(futurePath, true);
  const allArcs = [...pastArcs, ...futureArcs];

  const globeProps = {
    globeImageUrl: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    bumpImageUrl: "//unpkg.com/three-globe/example/img/earth-topology.png",
    backgroundImageUrl: "//unpkg.com/three-globe/example/img/night-sky.png",
    width: window.innerWidth,
    height: window.innerHeight,
    ...(hasPosition && {
      pointsData: [{ lat: issData.latitude, lng: issData.longitude }],
      pointAltitude: 0.05,
      pointColor: () => '#ff3333',
      pointRadius: 0.5,
    }),
    ...(allArcs.length > 0 && {
      arcsData: allArcs,
      arcColor: 'color',
      arcStroke: 0.5,
      arcDashLength: 0.4,
      arcDashGap: 0.2,
      arcDashAnimateTime: 2000,
      arcAltitude: 0.01,
    })
  };

  return (
    <div style={{ 
      fontFamily: 'Segoe UI, Arial', 
      background: '#000', 
      color: '#fff', 
      height: '100vh', 
      margin: 0,
      overflow: 'hidden' 
    }}>
      <style>{`
       .card {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(20, 20, 30, 0.85);
          backdrop-filter: blur(10px);
          padding: 20px 25px;
          border-radius: 12px;
          z-index: 1000;
          width: 300px;
          border: 1px solid rgba(255,255,255,0.1);
        }
       .card h1 {
          margin: 0 0 15px 0;
          font-size: 20px;
          color: #64ffda;
        }
       .card p {
          margin: 8px 0;
          font-size: 14px;
        }
       .toggle-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 1000;
          padding: 10px 18px;
          background: rgba(0,0,0,0.8);
          color: #fff;
          border: 1px solid #64ffda;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        }
       .toggle-btn:hover {
          background: #64ffda;
          color: #000;
        }
       .footer {
          position: absolute;
          bottom: 15px;
          left: 20px;
          font-size: 12px;
          opacity: 0.7;
          z-index: 1000;
        }
       .status {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          background: ${issData.visibility.includes('Sunlight') ? '#ffa500' : '#4a4a6a'};
          color: #000;
          font-weight: bold;
        }
       .legend {
          position: absolute;
          bottom: 15px;
          right: 20px;
          background: rgba(20, 20, 30, 0.85);
          padding: 10px;
          border-radius: 6px;
          font-size: 12px;
          z-index: 1000;
        }
      `}</style>

      <div className="card">
        <h1>ISS Live Tracker</h1>
        {loading ? <p>Acquiring signal...</p> : (
          <>
            <p><b>Location:</b> Over International Waters</p>
            <p><b>Status:</b> <span className="status">{issData.visibility}</span></p>
            <p><b>Latitude:</b> {issData.latitude.toFixed(4)}°</p>
            <p><b>Longitude:</b> {issData.longitude.toFixed(4)}°</p>
            <p><b>Speed:</b> {issData.velocity.toLocaleString()} km/h</p>
            <p><b>Altitude:</b> {issData.altitude} km</p>
          </>
        )}
      </div>

      <button className="toggle-btn" onClick={() => setIs3D(!is3D)}>
        {is3D ? 'Switch to 2D Map' : 'Switch to 3D Globe'}
      </button>

      <div className="footer">Built by Vishnupriya | 2026</div>
      
      <div className="legend">
        <div><span style={{color:'#ff3333'}}>●</span> Past path - 2min</div>
        <div><span style={{color:'#ff3333', opacity:0.4}}>●</span> Predicted - 90min</div>
      </div>

      {is3D ? (
        <Globe ref={globeEl} {...globeProps} />
      ) : (
        <MapContainer 
          key={loading ? 'loading' : 'loaded'}
          center={[issData.latitude || 0, issData.longitude || 0]} 
          zoom={3} 
          style={{ height: '100vh', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {pastPath.length > 1 && <Polyline positions={pastPath} color="#ff3333" weight={3} />}
          {futurePath.length > 1 && <Polyline 
            positions={futurePath} 
            color="#ff3333" 
            weight={2} 
            opacity={0.5}
            dashArray="5, 10"
          />}
          {hasPosition && <Marker position={[issData.latitude, issData.longitude]} icon={issIcon} />}
        </MapContainer>
      )}
    </div>
  );
}

export default App;