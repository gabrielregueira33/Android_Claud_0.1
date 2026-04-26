/* ClaudeMap - free-API live overlays on OpenStreetMap */
(function () {
    var status = document.getElementById('status');
    function setStatus(s) { status.textContent = s; }

    var map = L.map('map', {
        zoomControl: true,
        attributionControl: true
    }).setView([40.7128, -74.0060], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var precipLayer = L.tileLayer(
        'https://tilecache.rainviewer.com/v2/radar/0/256/{z}/{x}/{y}/2/1_1.png',
        { opacity: 0.55, attribution: 'RainViewer' }
    );

    var camLayer = L.layerGroup().addTo(map);
    var trafficLayer = L.layerGroup().addTo(map);
    var quakeLayer = L.layerGroup().addTo(map);

    function camIcon() {
        return L.divIcon({
            className: '',
            iconSize: [16, 16],
            html: '<div style="width:14px;height:14px;border-radius:50%;background:#06b6d4;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.5);"></div>'
        });
    }
    function trafficIcon() {
        return L.divIcon({
            className: '',
            iconSize: [12, 12],
            html: '<div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid #fff;"></div>'
        });
    }
    function quakeIcon(mag) {
        var size = Math.max(10, 6 + mag * 4);
        return L.divIcon({
            className: '',
            iconSize: [size, size],
            html: '<div class="pulse" style="width:' + size + 'px;height:' + size + 'px;background:#ef4444;opacity:.85;border:2px solid #fff;border-radius:50%;"></div>'
        });
    }

    var lastFetchKey = '';
    var fetchTimer = null;

    function bboxKey(b) {
        return [b.getSouth().toFixed(2), b.getWest().toFixed(2),
                b.getNorth().toFixed(2), b.getEast().toFixed(2)].join(',');
    }

    function refresh() {
        var b = map.getBounds();
        var key = bboxKey(b);
        if (key === lastFetchKey) return;
        lastFetchKey = key;
        if (map.getZoom() < 9) {
            setStatus('Zoom in to load cameras / signals');
            camLayer.clearLayers();
            trafficLayer.clearLayers();
            return;
        }
        setStatus('Loading overlays...');
        if (document.getElementById('lyr-cams').checked) loadOverpass(b);
        if (document.getElementById('lyr-quakes').checked) loadQuakes();
    }

    function loadOverpass(b) {
        var bbox = b.getSouth() + ',' + b.getWest() + ',' + b.getNorth() + ',' + b.getEast();
        var camsQ =
            '[out:json][timeout:20];' +
            '(' +
              'node["man_made"="surveillance"](' + bbox + ');' +
              'node["surveillance:type"="camera"](' + bbox + ');' +
              'node["highway"="traffic_signals"](' + bbox + ');' +
            ');out body;';
        fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(camsQ)
        }).then(function (r) { return r.json(); })
          .then(function (data) {
              camLayer.clearLayers();
              trafficLayer.clearLayers();
              var cams = 0, sigs = 0;
              data.elements.forEach(function (el) {
                  if (!el.lat || !el.lon) return;
                  var t = el.tags || {};
                  if (t['highway'] === 'traffic_signals') {
                      L.marker([el.lat, el.lon], { icon: trafficIcon() })
                          .bindPopup('Traffic signal')
                          .addTo(trafficLayer);
                      sigs++;
                  } else {
                      var name = t.name || t.operator || 'Surveillance camera';
                      var typ = t['surveillance:type'] || t['surveillance'] || 'camera';
                      L.marker([el.lat, el.lon], { icon: camIcon() })
                          .bindPopup('<b>' + escapeHtml(name) + '</b><br/>' + escapeHtml(typ))
                          .addTo(camLayer);
                      cams++;
                  }
              });
              setStatus(cams + ' cameras · ' + sigs + ' signals');
          }).catch(function (e) {
              setStatus('Overpass error');
          });
    }

    function loadQuakes() {
        fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                quakeLayer.clearLayers();
                data.features.forEach(function (f) {
                    var c = f.geometry.coordinates;
                    var p = f.properties;
                    L.marker([c[1], c[0]], { icon: quakeIcon(p.mag || 1) })
                        .bindPopup('<b>M ' + (p.mag || '?') + '</b><br/>' +
                                   escapeHtml(p.place || '') +
                                   '<br/><small>' + new Date(p.time).toLocaleString() + '</small>')
                        .addTo(quakeLayer);
                });
            }).catch(function () { /* ignore */ });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function debouncedRefresh() {
        if (fetchTimer) clearTimeout(fetchTimer);
        fetchTimer = setTimeout(refresh, 500);
    }

    map.on('moveend', debouncedRefresh);

    document.getElementById('lyr-cams').addEventListener('change', function (e) {
        if (e.target.checked) { camLayer.addTo(map); refresh(); }
        else map.removeLayer(camLayer);
    });
    document.getElementById('lyr-traffic').addEventListener('change', function (e) {
        if (e.target.checked) { trafficLayer.addTo(map); refresh(); }
        else map.removeLayer(trafficLayer);
    });
    document.getElementById('lyr-quakes').addEventListener('change', function (e) {
        if (e.target.checked) { quakeLayer.addTo(map); loadQuakes(); }
        else map.removeLayer(quakeLayer);
    });
    document.getElementById('lyr-weather').addEventListener('change', function (e) {
        if (e.target.checked) precipLayer.addTo(map);
        else map.removeLayer(precipLayer);
    });

    document.getElementById('locate').addEventListener('click', function () {
        try {
            if (window.Native && Native.getLastLocation) {
                var d = JSON.parse(Native.getLastLocation() || '{}');
                if (d.lat && d.lon) {
                    map.setView([d.lat, d.lon], 14);
                    return;
                }
            }
        } catch (e) {}
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (p) {
                map.setView([p.coords.latitude, p.coords.longitude], 14);
            }, function () { setStatus('Location unavailable'); });
        }
    });

    loadQuakes();
    refresh();
})();
