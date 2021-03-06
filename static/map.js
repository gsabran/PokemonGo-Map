document.addEventListener("DOMContentLoaded", function () {
    if (!Notification) {
        console.log('could not load notifications');
        return;
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
});

var $selectExclude = $("#exclude-pokemon");
var $selectExcludeModal = $("#exclude-pokemon-modal");
var $selectNotify = $("#notify-pokemon");

var idToPokemon = {};

$.getJSON("static/locales/pokemon." + document.documentElement.lang + ".json").done(function(data) {
    var pokeList = []

    $.each(data, function(key, value) {
        pokeList.push( { id: parseInt(key), text: value } );
        idToPokemon[key] = value;
    });

    function showModal(localStorageKey, $modal, onChange) {
        $modal.removeClass('hidden');
        var toBeAppended = [];
        var $div = $(`
            <div class="back">
                < Back
            </div>
        `);
        $div.click(function() {
            setTimeout(function(){
                $modal.addClass('hidden');
                $modal.empty();
            }, 0)
        });
        toBeAppended.push($div);

        var pokeIds = JSON.parse(localStorage[localStorageKey] || '[]');
        pokeList.forEach(function(poke) {
            if (poke.id > 151) { return; }
            var isExculded = pokeIds.indexOf(poke.id) !== -1;
            var $div2 = $(`
                <div class="poke-container">
                    <img src="/static/icons/${poke.id}.png"/>
                    <br/>
                    <input type="checkbox" ${isExculded && 'checked="checked"'} />
                </div>
            `);
            $div2.click(function() {
                pokeIds = JSON.parse(localStorage[localStorageKey] || '[]');

                var pokeIdx = pokeIds.indexOf(poke.id);
                if (pokeIdx !== -1) {
                    pokeIds.splice(pokeIdx, 1);
                } else {
                    pokeIds.push(poke.id);
                }
                localStorage[localStorageKey] = JSON.stringify(pokeIds);
                $div2.find('input').prop('checked', pokeIdx === -1);
                onChange(pokeIds);
                clearStaleMarkers();
            });
            toBeAppended.push($div2);
        });
        $modal.append(toBeAppended);
    };

    $selectExclude.click(function() {
        showModal('excluded_pok_ids', $selectExcludeModal, function(pokeIds) { excludedPokemon = pokeIds; });
    });
    $selectNotify.click(function() {
        showModal('notified_pok_ids', $selectExcludeModal, function(pokeIds) { notifiedPokemon = pokeIds; });
    });
});

var excludedPokemon = JSON.parse(localStorage['excluded_pok_ids'] || '[]');
var notifiedPokemon = JSON.parse(localStorage['notified_pok_ids'] || '[]');

var map;

var light2Style=[{"elementType":"geometry","stylers":[{"hue":"#ff4400"},{"saturation":-68},{"lightness":-4},{"gamma":0.72}]},{"featureType":"road","elementType":"labels.icon"},{"featureType":"landscape.man_made","elementType":"geometry","stylers":[{"hue":"#0077ff"},{"gamma":3.1}]},{"featureType":"water","stylers":[{"hue":"#00ccff"},{"gamma":0.44},{"saturation":-33}]},{"featureType":"poi.park","stylers":[{"hue":"#44ff00"},{"saturation":-23}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"hue":"#007fff"},{"gamma":0.77},{"saturation":65},{"lightness":99}]},{"featureType":"water","elementType":"labels.text.stroke","stylers":[{"gamma":0.11},{"weight":5.6},{"saturation":99},{"hue":"#0091ff"},{"lightness":-86}]},{"featureType":"transit.line","elementType":"geometry","stylers":[{"lightness":-48},{"hue":"#ff5e00"},{"gamma":1.2},{"saturation":-23}]},{"featureType":"transit","elementType":"labels.text.stroke","stylers":[{"saturation":-64},{"hue":"#ff9100"},{"lightness":16},{"gamma":0.47},{"weight":2.7}]}];
var darkStyle=[{"featureType":"all","elementType":"labels.text.fill","stylers":[{"saturation":36},{"color":"#b39964"},{"lightness":40}]},{"featureType":"all","elementType":"labels.text.stroke","stylers":[{"visibility":"on"},{"color":"#000000"},{"lightness":16}]},{"featureType":"all","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"administrative","elementType":"geometry.fill","stylers":[{"color":"#000000"},{"lightness":20}]},{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#000000"},{"lightness":17},{"weight":1.2}]},{"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":20}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":21}]},{"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#000000"},{"lightness":17}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#000000"},{"lightness":29},{"weight":0.2}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":18}]},{"featureType":"road.local","elementType":"geometry","stylers":[{"color":"#181818"},{"lightness":16}]},{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":19}]},{"featureType":"water","elementType":"geometry","stylers":[{"lightness":17},{"color":"#525252"}]}];
var pGoStyle=[{"featureType":"landscape.man_made","elementType":"geometry.fill","stylers":[{"color":"#a1f199"}]},{"featureType":"landscape.natural.landcover","elementType":"geometry.fill","stylers":[{"color":"#37bda2"}]},{"featureType":"landscape.natural.terrain","elementType":"geometry.fill","stylers":[{"color":"#37bda2"}]},{"featureType":"poi.attraction","elementType":"geometry.fill","stylers":[{"visibility":"on"}]},{"featureType":"poi.business","elementType":"geometry.fill","stylers":[{"color":"#e4dfd9"}]},{"featureType":"poi.business","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"poi.park","elementType":"geometry.fill","stylers":[{"color":"#37bda2"}]},{"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#84b09e"}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#fafeb8"},{"weight":"1.25"}]},{"featureType":"road.highway","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"water","elementType":"geometry.fill","stylers":[{"color":"#5ddad6"}]}];

var selectedStyle = 'light';

function initMap() {
    var mapCenter = {   
        lat: parseFloat(localStorage['map_lat']) || center_lat,
        lng: parseFloat(localStorage['map_lng']) || center_lng
    };
    var zoom = 16;
    try {
        var lat = parseFloat(localStorage['map_lat']);
        var lng = parseFloat(localStorage['map_lng']);
        if (lng === lng && lat === lat) {
            mapCenter = {
                lat: lat,
                lng: lng,
            };
        }
    } catch (e) {}
    try {
        var _zoom = parseFloat(localStorage['map_zoom']);
        if (_zoom === _zoom) {
            zoom = _zoom;
        }
    } catch (e) {}

    map = new google.maps.Map(document.getElementById('map'), {
        center: mapCenter,
        zoom: zoom,
        fullscreenControl: true,
        streetViewControl: false,
		mapTypeControl: true,
		mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: google.maps.ControlPosition.RIGHT_TOP,
          mapTypeIds: [
              google.maps.MapTypeId.ROADMAP,
              google.maps.MapTypeId.SATELLITE,
              'dark_style',
              'style_light2',
              'style_pgo']
        },
    });

	var style_dark = new google.maps.StyledMapType(darkStyle, {name: "Dark"});
	map.mapTypes.set('dark_style', style_dark);

	var style_light2 = new google.maps.StyledMapType(light2Style, {name: "Light2"});
	map.mapTypes.set('style_light2', style_light2);

	var style_pgo = new google.maps.StyledMapType(pGoStyle, {name: "PokemonGo"});
	map.mapTypes.set('style_pgo', style_pgo);

    map.addListener('maptypeid_changed', function(s) {
        localStorage['map_style'] = this.mapTypeId;
    });

    map.addListener('zoom_changed', function(s) {
        localStorage['map_zoom'] = map.getZoom();
    });

    map.addListener('center_changed', function(e) {
        var center = map.getCenter()
        localStorage['map_lat'] = center.lat();
        localStorage['map_lng'] = center.lng();
    });

    if (!localStorage['map_style'] || localStorage['map_style'] === 'undefined') {
        localStorage['map_style'] = 'roadmap';
    }

    map.setMapTypeId(localStorage['map_style']);
    initSidebar();

    
    window.setInterval(updateMap, 1000);
    updateMap();
    watchPositionChange();
};

function initSidebar() {
    $('#gyms-switch').prop('checked', localStorage.showGyms === 'true');
    $('#pokemon-switch').prop('checked', localStorage.showPokemon === 'true');
    $('#pokestops-switch').prop('checked', localStorage.showPokestops === 'true');
    $('#scanned-switch').prop('checked', localStorage.showScanned === 'true');
}

var pad = function (number) { return number <= 99 ? ("0" + number).slice(-2) : number; }


function pokemonLabel(name, disappear_time, id, latitude, longitude) {
    disappear_date = new Date(disappear_time)

    var contentstring = `
        <div>
            <b>${name}</b>
            <span> - </span>
            <small>
                <a href='http://www.pokemon.com/us/pokedex/${id}' target='_blank' title='View in Pokedex'>#${id}</a>
            </small>
        </div>
        <div>
            Disappears at ${pad(disappear_date.getHours())}:${pad(disappear_date.getMinutes())}:${pad(disappear_date.getSeconds())}
            <span class='label-countdown' disappears-at='${disappear_time}'>(00m00s)</span></div>
        <div>
            <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}'
                    target='_blank' title='View in Maps'>Get directions</a>
        </div>`;
    return contentstring;
}

function gymLabel(team_name, team_id, gym_points) {
    var gym_color = ["0, 0, 0, .4", "74, 138, 202, .6", "240, 68, 58, .6", "254, 217, 40, .6"];
    var str;
    if (team_id == 0) {
        str = `<div><center>
            <div>
                <b style='color:rgba(${gym_color[team_id]})'>${team_name}</b><br>
                <img height='70px' style='padding: 5px;' src='static/forts/${team_name}_large.png'>
            </div>
            </center></div>`;
    } else {
        str = `
            <div><center>
            <div style='padding-bottom: 2px'>Gym owned by:</div>
            <div>
                <b style='color:rgba(${gym_color[team_id]})'>Team ${team_name}</b><br>
                <img height='70px' style='padding: 5px;' src='static/forts/${team_name}_large.png'>
            </div>
            <div>Prestige: ${gym_points}</div>
            </center></div>`;
    }

    return str;
}

function pokestopLabel(lured, last_modified, active_pokemon_id, latitude, longitude) {
    var str;
    if (lured) {
        var active_pokemon = idToPokemon[active_pokemon_id];

        var last_modified_date = new Date(last_modified);
        var current_date = new Date();

        var time_until_expire = current_date.getTime() - last_modified_date.getTime();

        var expire_date = new Date(current_date.getTime() + time_until_expire);
        var expire_time = expire_date.getTime();

        str = `
            <div>
                <b>Lured Pokéstop</b>
            </div>
            <div>
                Lured Pokémon: ${active_pokemon}
                <span> - </span>
                <small>
                    <a href='http://www.pokemon.com/us/pokedex/${active_pokemon_id}' target='_blank' title='View in Pokedex'>#${active_pokemon_id}</a>
                </small>
            </div>
            <div>
                Lure expires at ${pad(expire_date.getHours())}:${pad(expire_date.getMinutes())}:${pad(expire_date.getSeconds())}
                <span class='label-countdown' disappears-at='${expire_time}'>(00m00s)</span></div>
            <div>
            <div>
                <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}'
                        target='_blank' title='View in Maps'>Get directions</a>
            </div>`;
    } else {
        str = `
            <div>
                <b>Pokéstop</b>
            </div>
            <div>
                <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}'
                        target='_blank' title='View in Maps'>Get directions</a>
            </div>`;
    }

    return str;
}

function scannedLabel(last_modified) {
    scanned_date = new Date(last_modified)
    var pad = function (number) { return number <= 99 ? ("0" + number).slice(-2) : number; }

    var contentstring = `
        <div>
            Scanned at ${pad(scanned_date.getHours())}:${pad(scanned_date.getMinutes())}:${pad(scanned_date.getSeconds())}
        </div>`;
    return contentstring;
};

// Dicts
map_pokemons = {} // Pokemon
map_gyms = {} // Gyms
map_pokestops = {} // Pokestops
map_players = {} // Players
map_scanned = {} // Pokestops
var gym_types = ["Uncontested", "Mystic", "Valor", "Instinct"];

function setupPokemonMarker(item) {
    var marker = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude
        },
        map: map,
        icon: 'static/icons/' + item.pokemon_id + '.png'
    });

    marker.infoWindow = new google.maps.InfoWindow({
        content: pokemonLabel(item.pokemon_name, item.disappear_time, item.pokemon_id, item.latitude, item.longitude)
    });
    
    var distance = distanceToPokemon(item);
    if (notifiedPokemon.indexOf(item.pokemon_id) > -1 && distance < notificationDistance && distance !== -1) {
        sendNotification('A wild ' + item.pokemon_name + ' appeared ' + distance.toFixed(1) + ' km away!', 'Click to load map', 'static/icons/' + item.pokemon_id + '.png')
    }

    addListeners(marker);
    return marker;
};

function setupGymMarker(item) {
    var marker = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude
        },
        map: map,
        icon: 'static/forts/' + gym_types[item.team_id] + '.png'
    });

    marker.infoWindow = new google.maps.InfoWindow({
        content: gymLabel(gym_types[item.team_id], item.team_id, item.gym_points)
    });

    addListeners(marker);
    return marker;
};

function setupPokestopMarker(item) {
    var imagename = item.lure_expiration ? "PstopLured" : "Pstop";
    var marker = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude
        },
        map: map,
        icon: 'static/forts/' + imagename + '.png',
    });

    marker.infoWindow = new google.maps.InfoWindow({
        content: pokestopLabel(!!item.lure_expiration, item.last_modified, item.active_pokemon_id, item.latitude, item.longitude)
    });

    addListeners(marker);
    return marker;
};

function setupPlayerMarker(item) {
    // remove old markers
    var player_id = item.player_id;
    if (map_players[player_id]) {
        map_players[player_id].current.setMap(null);
    }
    map_players[player_id] = map_players[player_id] || {};

    var currentPositionMarker = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude
        },
        map: map,
        icon: 'static/forts/sacha.png',
    });
    currentPositionMarker.infoWindow = new google.maps.InfoWindow({
        content: item.name
    });
    addListeners(currentPositionMarker);
    map_players[player_id].current = currentPositionMarker;

    function almostEquals(a, b) {
        return Math.abs(a - b) < 0.00000001;
    }
    if (map_players[player_id].origin) {
        if (map_players[player_id].origin.isBeingDragged) {
            return;
        }
        if (almostEquals(map_players[player_id].origin.position.lat(), item.start_latitude) &&
            almostEquals(map_players[player_id].origin.position.lng(), item.start_longitude)) {
            return;
        }
        map_players[player_id].origin.setMap(null);
    }

    var originPositionMarker = new google.maps.Marker({
        position: {
            lat: item.start_latitude,
            lng: item.start_longitude,
        },
        map: map,
        draggable: true,
    });
    originPositionMarker.addListener('dragstart', function() {
        originPositionMarker.isBeingDragged = true;
    });
    originPositionMarker.addListener('dragend', function() {
        var loc = originPositionMarker.position;
        originPositionMarker.isBeingDragged = false;
        $.post("/next_loc?lat=" + loc.lat() + "&lng=" + loc.lng() + '&player_id=' + player_id, {});
    });
    originPositionMarker.infoWindow = new google.maps.InfoWindow({
        content: item.name + ' original position'
    });
    addListeners(originPositionMarker);

    map_players[player_id].origin = originPositionMarker;
};

function getColorByDate(value){
    //Changes the Color from Red to green over 15 mins
    var diff = (Date.now() - value) / 1000 / 60 / 15;

    if(diff > 1){
        diff = 1;
    }

    //value from 0 to 1 - Green to Red
    var hue=((1-diff)*120).toString(10);
    return ["hsl(",hue,",100%,50%)"].join("");
}

function setupScannedMarker(item) {
    var circleCenter = new google.maps.LatLng(item.latitude, item.longitude);

    var marker = new google.maps.Circle({
        map: map,
        center: circleCenter,
        radius: 100,    // 10 miles in metres
        fillColor: getColorByDate(item.last_modified),
        strokeWeight: 1
    });

    return marker;
};

function addListeners(marker) {
    marker.addListener('click', function() {
        marker.infoWindow.open(map, marker);
        updateLabelDiffTime();
        marker.persist = true;
    });

    google.maps.event.addListener(marker.infoWindow, 'closeclick', function() {
        marker.persist = null;
    });
    return marker
};

function clearStaleMarkers() {
    $.each(map_pokemons, function(key, value) {

        if (map_pokemons[key]['disappear_time'] < new Date().getTime() ||
                excludedPokemon.indexOf(parseInt(map_pokemons[key]['pokemon_id'])) >= 0) {
            map_pokemons[key].marker.setMap(null);
            delete map_pokemons[key];
        }
    });
    
    $.each(map_scanned, function(key, value) {
        //If older than 15mins remove
        if (map_scanned[key]['last_modified'] < (new Date().getTime() - 15 * 60 * 1000)) {
            map_scanned[key].marker.setMap(null);
            delete map_scanned[key];
        }
    });
};

function updateMap() {
    
    localStorage.showPokemon = localStorage.showPokemon || true;
    localStorage.showGyms = localStorage.showGyms || true;
    localStorage.showPokestops = localStorage.showPokestops || true;
    localStorage.showScanned = localStorage.showScanned || true;

    $.ajax({
        url: "raw_data",
        type: 'GET',
        data: {
            'pokemon': localStorage.showPokemon,
            'pokestops': localStorage.showPokestops,
            'gyms': localStorage.showGyms,
            'scanned': localStorage.showScanned
        },
        dataType: "json"
    }).done(function(result) {
      $.each(result.pokemons, function(i, item){
          if (!localStorage.showPokemon) {
              return false; // in case the checkbox was unchecked in the meantime.
          }
          if (!(item.encounter_id in map_pokemons) &&
                    excludedPokemon.indexOf(item.pokemon_id) < 0) {
              // add marker to map and item to dict
              if (item.marker) item.marker.setMap(null);
              item.marker = setupPokemonMarker(item);
              map_pokemons[item.encounter_id] = item;
          }
        });

        $.each(result.pokestops, function(i, item) {
            if (!localStorage.showPokestops) {
                return false;
            } else if (!(item.pokestop_id in map_pokestops)) { // add marker to map and item to dict
                // add marker to map and item to dict
                if (item.marker) item.marker.setMap(null);
                item.marker = setupPokestopMarker(item);
                map_pokestops[item.pokestop_id] = item;
            }

        });

        $.each(result.gyms, function(i, item){
            if (!localStorage.showGyms) {
                return false; // in case the checkbox was unchecked in the meantime.
            }

            if (item.gym_id in map_gyms) {
                // if team has changed, create new marker (new icon)
                if (map_gyms[item.gym_id].team_id != item.team_id) {
                    map_gyms[item.gym_id].marker.setMap(null);
                    map_gyms[item.gym_id].marker = setupGymMarker(item);
                } else { // if it hasn't changed generate new label only (in case prestige has changed)
                    map_gyms[item.gym_id].marker.infoWindow = new google.maps.InfoWindow({
                        content: gymLabel(gym_types[item.team_id], item.team_id, item.gym_points)
                    });
                }
            }
            else { // add marker to map and item to dict
                if (item.marker) item.marker.setMap(null);
                item.marker = setupGymMarker(item);
                map_gyms[item.gym_id] = item;
            }

        });
        result.players.forEach(function(player) {
            setupPlayerMarker(player);
        });

        $.each(result.scanned, function(i, item) {
            if (!localStorage.showScanned) {
                return false;
            }

            if (item.scanned_id in map_scanned) {
                map_scanned[item.scanned_id].marker.setOptions({fillColor: getColorByDate(item.last_modified)});
            }
            else { // add marker to map and item to dict
                if (item.marker) item.marker.setMap(null);
                item.marker = setupScannedMarker(item);
                map_scanned[item.scanned_id] = item;
            }

        });

        clearStaleMarkers();
    });
};

var currentPositionMarker;
var currentPosition;
function showCurrentPosition(position) {
    currentPosition = position;
    if (currentPositionMarker) {
        var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        currentPositionMarker.setPosition(latlng);
    } else {
        currentPositionMarker = new google.maps.Marker({
            position: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            },
            map: map,
            icon: 'static/forts/Pstop.png'
        });   
    }
};
function watchPositionChange() {
    navigator.geolocation.watchPosition(showCurrentPosition, function(){}, {
        timeout: 30000,
        enableHighAccuracy: true,
        maximumAge: 1000
    });
};

document.getElementById('gyms-switch').onclick = function() {
    localStorage["showGyms"] = this.checked;
    if (this.checked) {
        updateMap();
    } else {
        $.each(map_gyms, function(key, value) {
            map_gyms[key].marker.setMap(null);
        });
        map_gyms = {}
    }
};

$('#pokemon-switch').change(function() {
    localStorage["showPokemon"] = this.checked;
    if (this.checked) {
        updateMap();
    } else {
        $.each(map_pokemons, function(key, value) {
            map_pokemons[key].marker.setMap(null);
        });
        map_pokemons = {}
    }
});

$('#pokestops-switch').change(function() {
    localStorage["showPokestops"] = this.checked;
    if (this.checked) {
        updateMap();
    } else {
        $.each(map_pokestops, function(key, value) {
            map_pokestops[key].marker.setMap(null);
        });
        map_pokestops = {}
    }
});


$('#scanned-switch').change(function() {
    localStorage["showScanned"] = this.checked;
    if (this.checked) {
        updateMap();
    } else {
        $.each(map_scanned, function(key, value) {
            map_scanned[key].marker.setMap(null);
        });
        map_scanned = {}
    }
});

var updateLabelDiffTime = function() {
    $('.label-countdown').each(function(index, element) {
        var disappearsAt = new Date(parseInt(element.getAttribute("disappears-at")));
        var now = new Date();

        var difference = Math.abs(disappearsAt - now);
        var hours = Math.floor(difference / 36e5);
        var minutes = Math.floor((difference - (hours * 36e5)) / 6e4);
        var seconds = Math.floor((difference - (hours * 36e5) - (minutes * 6e4)) / 1e3);

        if (disappearsAt < now) {
            timestring = "(expired)";
        } else {
            timestring = "(";
            if (hours > 0)
                timestring = hours + "h";

            timestring += ("0" + minutes).slice(-2) + "m";
            timestring += ("0" + seconds).slice(-2) + "s";
            timestring += ")";
        }

        $(element).text(timestring)
    });
};

window.setInterval(updateLabelDiffTime, 1000);

function sendNotification(title, text, icon) {
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    } else {
        var notification = new Notification(title, {
            icon: icon,
            body: text,
            sound: 'sounds/ding.mp3'
        });

        notification.onclick = function () {
            window.open(window.location.href);
        };
    }
}

var notificationDistance = JSON.parse(localStorage['notification-distance'] || '11');
$('#notification-distance input').val(notificationDistance);

function handleNotificationDistanceChange() {
    notificationDistance =  $('#notification-distance input').val();
    localStorage['notification-distance'] = JSON.stringify(notificationDistance);
};
$('#notification-distance').change(handleNotificationDistanceChange);

function distanceToPokemon(pokemon) {
    if (!currentPosition) { return -1; }

    // http://stackoverflow.com/a/27943/2054629
    function deg2rad(deg) {
      return deg * (Math.PI/180)
    }
    function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
      var R = 6371; // Radius of the earth in km
      var dLat = deg2rad(lat2-lat1);  // deg2rad below
      var dLon = deg2rad(lon2-lon1); 
      var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      var d = R * c; // Distance in km
      return d;
    }

    return getDistanceFromLatLonInKm(
        currentPosition.coords.latitude,
        currentPosition.coords.longitude,
        pokemon.latitude,
        pokemon.longitude
    );
};
