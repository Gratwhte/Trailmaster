console.log('App.js loaded');

// Check if Leaflet is loaded
if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded!');
    alert('Error: Map library not loaded. Please refresh the page.');
}

// Initialize the map with error handling
let map;
try {
    map = L.map('map').setView([40.7128, -74.0060], 10); // Default to New York
    console.log('Map initialized successfully');
} catch (error) {
    console.error('Error initializing map:', error);
    alert('Error initializing map: ' + error.message);
}

// Add OpenStreetMap tiles
try {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);
    console.log('Map tiles added successfully');
} catch (error) {
    console.error('Error adding map tiles:', error);
}

// Feature group to store all drawn/loaded trails
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Add drawing controls
try {
    const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            polygon: false,
            circle: false,
            rectangle: false,
            marker: false,
            circlemarker: false,
            polyline: {
                shapeOptions: {
                    color: '#3498db',
                    weight: 4,
                    opacity: 0.7
                }
            }
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    map.addControl(drawControl);
    console.log('Draw controls added successfully');
} catch (error) {
    console.error('Error adding draw controls:', error);
}

// Store trail metadata
let trails = [];
let trailCounter = 0;

// Status message helper
function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('loadStatus');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Event handler when a new shape is drawn
map.on(L.Draw.Event.CREATED, function (event) {
    console.log('Trail created');
    const layer = event.layer;
    drawnItems.addLayer(layer);
    
    // Add trail to list
    const trailId = `trail_${++trailCounter}`;
    layer.trailId = trailId;
    
    trails.push({
        id: trailId,
        name: `Trail ${trailCounter}`,
        layer: layer,
        latlngs: layer.getLatLngs()
    });
    
    updateTrailsList();
    showStatus('Trail created successfully!', 'success');
});

// Event handler when shapes are edited
map.on(L.Draw.Event.EDITED, function (event) {
    console.log('Trails edited');
    const layers = event.layers;
    layers.eachLayer(function (layer) {
        const trail = trails.find(t => t.id === layer.trailId);
        if (trail) {
            trail.latlngs = layer.getLatLngs();
        }
    });
    showStatus('Trails updated!', 'success');
});

// Event handler when shapes are deleted
map.on(L.Draw.Event.DELETED, function (event) {
    console.log('Trails deleted');
    const layers = event.layers;
    layers.eachLayer(function (layer) {
        trails = trails.filter(t => t.id !== layer.trailId);
    });
    updateTrailsList();
    showStatus('Trails deleted!', 'success');
});

// Load GPX file
document.getElementById('loadGpxBtn').addEventListener('click', function() {
    console.log('Load GPX button clicked');
    const fileInput = document.getElementById('gpxFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showStatus('Please select a GPX file first', 'error');
        return;
    }
    
    console.log('Reading file:', file.name);
    showStatus('Loading GPX file...', 'success');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('File read successfully, parsing...');
        const gpxContent = e.target.result;
        parseAndDisplayGPX(gpxContent, file.name);
    };
    reader.onerror = function(e) {
        console.error('Error reading file:', e);
        showStatus('Error reading file', 'error');
    };
    reader.readAsText(file);
});

// Parse and display GPX content
function parseAndDisplayGPX(gpxContent, filename) {
    console.log('Parsing GPX content...');
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = gpxDoc.querySelector('parsererror');
    if (parseError) {
        console.error('Parse error:', parseError.textContent);
        showStatus('Error parsing GPX file', 'error');
        return;
    }
    
    // Try to extract tracks first
    const trks = gpxDoc.querySelectorAll('trk');
    console.log('Found tracks:', trks.length);
    
    if (trks.length > 0) {
        trks.forEach((trk, index) => {
            const trkpts = trk.querySelectorAll('trkpt');
            console.log(`Track ${index} has ${trkpts.length} points`);
            if (trkpts.length > 0) {
                parsePoints(trkpts, `${filename.replace('.gpx', '')} - Track ${index + 1}`);
            }
        });
        return;
    }
    
    // Try route points if no tracks
    const rtes = gpxDoc.querySelectorAll('rte');
    console.log('Found routes:', rtes.length);
    
    if (rtes.length > 0) {
        rtes.forEach((rte, index) => {
            const rtepts = rte.querySelectorAll('rtept');
            console.log(`Route ${index} has ${rtepts.length} points`);
            if (rtepts.length > 0) {
                parsePoints(rtepts, `${filename.replace('.gpx', '')} - Route ${index + 1}`);
            }
        });
        return;
    }
    
    // Try all track points as fallback
    const allTrkpts = gpxDoc.querySelectorAll('trkpt');
    if (allTrkpts.length > 0) {
        console.log('Found track points:', allTrkpts.length);
        parsePoints(allTrkpts, filename.replace('.gpx', ''));
        return;
    }
    
    // Try all route points as fallback
    const allRtepts = gpxDoc.querySelectorAll('rtept');
    if (allRtepts.length > 0) {
        console.log('Found route points:', allRtepts.length);
        parsePoints(allRtepts, filename.replace('.gpx', ''));
        return;
    }
    
    console.error('No valid points found in GPX file');
    showStatus('No track or route points found in GPX file', 'error');
}

function parsePoints(points, name) {
    const latlngs = [];
    
    points.forEach(point => {
        const lat = parseFloat(point.getAttribute('lat'));
        const lon = parseFloat(point.getAttribute('lon'));
        if (!isNaN(lat) && !isNaN(lon)) {
            latlngs.push([lat, lon]);
        }
    });
    
    console.log('Parsed coordinates:', latlngs.length);
    
    if (latlngs.length === 0) {
        showStatus('No valid coordinates found', 'error');
        return;
    }
    
    // Create polyline
    const polyline = L.polyline(latlngs, {
        color: '#e74c3c',
        weight: 4,
        opacity: 0.7
    });
    
    // Add trail ID
    const trailId = `trail_${++trailCounter}`;
    polyline.trailId = trailId;
    
    // Add to map
    drawnItems.addLayer(polyline);
    
    // Fit map to bounds
    try {
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    } catch (error) {
        console.error('Error fitting bounds:', error);
    }
    
    // Add to trails list
    trails.push({
        id: trailId,
        name: name,
        layer: polyline,
        latlngs: [latlngs]
    });
    
    updateTrailsList();
    showStatus(`Loaded: ${name} (${latlngs.length} points)`, 'success');
}

// Update trails list in sidebar
function updateTrailsList() {
    const trailsList = document.getElementById('trailsList');
    
    if (trails.length === 0) {
        trailsList.innerHTML = '<p class="info">No trails loaded</p>';
        return;
    }
    
    trailsList.innerHTML = '';
    
    trails.forEach(trail => {
        const trailItem = document.createElement('div');
        trailItem.className = 'trail-item';
        
        const trailName = document.createElement('span');
        trailName.textContent = trail.name;
        trailName.style.cursor = 'pointer';
        trailName.onclick = function() {
            map.fitBounds(trail.layer.getBounds(), { padding: [50, 50] });
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = function() {
            drawnItems.removeLayer(trail.layer);
            trails = trails.filter(t => t.id !== trail.id);
            updateTrailsList();
            showStatus('Trail deleted', 'success');
        };
        
        trailItem.appendChild(trailName);
        trailItem.appendChild(deleteBtn);
        trailsList.appendChild(trailItem);
    });
}

// Clear map
document.getElementById('clearMapBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all trails from the map?')) {
        drawnItems.clearLayers();
        trails = [];
        trailCounter = 0;
        updateTrailsList();
        showStatus('Map cleared', 'success');
    }
});

// Export as GPX
document.getElementById('exportGpxBtn').addEventListener('click', function() {
    if (trails.length === 0) {
        showStatus('No trails to export. Draw or load a trail first.', 'error');
        return;
    }
    
    const trailName = document.getElementById('trailName').value || 'My Trail';
    const gpxContent = generateGPX(trailName);
    
    // Download file
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trailName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('GPX file exported successfully!', 'success');
});

// Generate GPX XML content
function generateGPX(name) {
    const now = new Date().toISOString();
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPX Trail Editor" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${now}</time>
  </metadata>\n`;
    
    trails.forEach((trail, index) => {
        gpx += `  <trk>
    <name>${escapeXml(trail.name)}</name>
    <trkseg>\n`;
        
        // Handle both single array and nested array structures
        const coords = Array.isArray(trail.latlngs[0]) && typeof trail.latlngs[0][0] === 'number' 
            ? trail.latlngs 
            : trail.latlngs[0];
        
        coords.forEach(latlng => {
            const lat = latlng.lat !== undefined ? latlng.lat : latlng[0];
            const lon = latlng.lng !== undefined ? latlng.lng : latlng[1];
            gpx += `      <trkpt lat="${lat}" lon="${lon}"></trkpt>\n`;
        });
        
        gpx += `    </trkseg>
  </trk>\n`;
    });
    
    gpx += `</gpx>`;
    
    return gpx;
}

// Escape XML special characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Get user's location on load (optional)
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            map.setView([position.coords.latitude, position.coords.longitude], 13);
            console.log('User location set');
        },
        function(error) {
            console.log('Geolocation error:', error.message);
        }
    );
}

console.log('App initialization complete');
