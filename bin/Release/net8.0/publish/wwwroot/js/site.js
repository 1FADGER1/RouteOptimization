document.addEventListener("DOMContentLoaded", async function () {
    console.log("Ожидание загрузки Yandex Maps API...");

    ymaps.ready(initMap);
});

let map, route;
let points = [];
let geocodePromises = [];
let tempMarker = null;

function initMap() {
    map = new ymaps.Map("map", {
        center: [51.660781, 39.200296],
        zoom: 10,
        controls: ["zoomControl"]
    });

    map.setType('yandex#map');

    // Клик по карте
    map.events.add("click", function (event) {
        let coords = event.get("coords");

        if (tempMarker) {
            map.geoObjects.remove(tempMarker);
        }

        tempMarker = new ymaps.Placemark(coords, { iconCaption: "Точка" }, { preset: "islands#redDotIcon" });
        map.geoObjects.add(tempMarker);

        if (confirm("Добавить эту точку в маршрут?")) {
            addPoint(coords);
            tempMarker = null;
        } else {
            map.geoObjects.remove(tempMarker);
            tempMarker = null;
        }
    });

    // Обработчики кнопок
    document.getElementById("buildRoute").addEventListener("click", buildOptimizedRoute);
    document.getElementById("findPoint").addEventListener("click", findPoint);
}

function addPoint(coords) {
    points.push(coords);

    let listItem = document.createElement("li");
    listItem.dataset.coords = JSON.stringify(coords); // Устанавливаем координаты сразу
    listItem.textContent = `Загрузка адреса (${coords.join(", ")})`; // Временный текст
    document.getElementById("pointsList").appendChild(listItem);

    let marker = new ymaps.Placemark(coords, { iconCaption: `Точка ${points.length}` }, { preset: "islands#blueDotIcon" });
    map.geoObjects.add(marker);

    // Геокодирование асинхронно
    const geocodePromise = ymaps.geocode(coords, { results: 1 }).then(function (res) {
        const geoObject = res.geoObjects.get(0);
        const address = geoObject ? geoObject.getAddressLine() : "Адрес не найден";
        const shortAddress = address.split(', ').slice(0, 2).join(', ');
        listItem.textContent = `${shortAddress} (${coords.join(", ")})`; // Обновляем текст после получения адреса
    }).catch(function (error) {
        console.error("Ошибка обратного геокодирования:", error);
        listItem.textContent = `Адрес не найден (${coords.join(", ")})`;
    });

    geocodePromises.push(geocodePromise);
}

// Получение времени маршрута через API
function getRouteDuration(points) {
    return new Promise((resolve) => {
        const testRoute = new ymaps.multiRouter.MultiRoute(
            {
                referencePoints: points,
                params: { routingMode: 'auto', avoidTrafficJams: true }
            },
            { routeActiveStrokeWidth: 0 }
        );
        testRoute.model.events.add('requestsuccess', () => {
            const activeRoute = testRoute.getActiveRoute();
            resolve(activeRoute ? activeRoute.properties.get("duration").value : Infinity);
        });
        testRoute.model.events.add('requestfail', () => resolve(Infinity));
        map.geoObjects.add(testRoute);
        setTimeout(() => map.geoObjects.remove(testRoute), 0);
    });
}

// Генерация всех перестановок
function permute(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
        const perms = permute(remaining);
        for (let perm of perms) {
            result.push([current].concat(perm));
        }
    }
    return result;
}

async function buildOptimizedRoute() {
    if (points.length < 2) {
        alert("Добавьте хотя бы 2 точки!");
        return;
    }

    if (route) {
        map.geoObjects.remove(route);
    }

    // Ждём завершения всех геокодирований
    await Promise.all(geocodePromises);

    let optimizedPoints = points;
    if (points.length > 2) {
        const startPoint = points[0];
        const waypoints = points.slice(1);

        const permutations = permute(waypoints);
        let minDuration = Infinity;
        let bestPoints = waypoints;

        for (let perm of permutations) {
            const orderedPoints = [startPoint, ...perm];
            const duration = await getRouteDuration(orderedPoints);
            if (duration < minDuration) {
                minDuration = duration;
                bestPoints = orderedPoints;
            }
        }

        optimizedPoints = bestPoints;
    }

    // Строим финальный маршрут
    const multiRoute = new ymaps.multiRouter.MultiRoute(
        {
            referencePoints: optimizedPoints,
            params: {
                routingMode: 'auto',
                avoidTrafficJams: true,
                results: 1
            }
        },
        {
            boundsAutoApply: true,
            wayPointVisible: false,
            routeActiveStrokeWidth: 4,
            routeActiveStrokeColor: "#FF0000"
        }
    );

    map.geoObjects.add(multiRoute);
    route = multiRoute;

    multiRoute.model.events.add('requestsuccess', function () {
        const activeRoute = multiRoute.getActiveRoute();
        if (activeRoute) {
            const duration = activeRoute.properties.get("duration").value;
            const distance = activeRoute.properties.get("distance").value;
            const minutes = Math.round(duration / 60);
            const kilometers = (distance / 1000).toFixed(1);

            // Собираем путь из адресов
            const pointItems = Array.from(document.getElementById("pointsList").getElementsByTagName("li"));
            const pathAddresses = optimizedPoints.map(coords => {
                const item = pointItems.find(li => {
                    const liCoords = JSON.parse(li.dataset.coords || "[]");
                    return liCoords.length && liCoords[0] === coords[0] && liCoords[1] === coords[1];
                });
                return item ? item.textContent.split(' (')[0] : "Неизвестная точка";
            });
            const pathText = pathAddresses.join(" → ");

            document.getElementById("routeInfo").innerHTML = `${pathText}<br>Время: ${minutes} мин, Расстояние: ${kilometers} км`;
        } else {
            document.getElementById("routeInfo").textContent = "Данные маршрута недоступны";
        }
    });

    multiRoute.model.events.add('requestfail', function (error) {
        console.error("Ошибка построения маршрута:", error);
        alert("Не удалось построить маршрут");
    });
}

function findPoint() {
    const input = document.getElementById("pointInput").value.trim();
    if (!input) {
        alert("Введите адрес или координаты!");
        return;
    }

    // Удаляем предыдущий временный маркер
    if (tempMarker) {
        map.geoObjects.remove(tempMarker);
        tempMarker = null;
    }

    // Проверяем, является ли ввод координатами
    const coordsMatch = input.match(/^[\s[]*(\d+\.\d+)[\s,]+(\d+\.\d+)[\s\]]*$/);
    if (coordsMatch) {
        const lat = parseFloat(coordsMatch[1]);
        const lon = parseFloat(coordsMatch[2]);
        showTempMarker([lat, lon]);
    } else {
        // Геокодирование по адресу
        ymaps.geocode(input, { results: 1 }).then(function (res) {
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
                const coords = firstGeoObject.geometry.getCoordinates();
                showTempMarker(coords);
            } else {
                alert("Не удалось найти точку по указанному адресу!");
            }
        }).catch(function (error) {
            console.error("Ошибка геокодирования:", error);
            alert("Ошибка при поиске точки!");
        });
    }
}

function showTempMarker(coords) {
    tempMarker = new ymaps.Placemark(coords, { iconCaption: "Найденная точка" }, { preset: "islands#redDotIcon" });
    map.geoObjects.add(tempMarker);
    map.panTo(coords, { duration: 500 }).then(() => {
        map.setZoom(18, { duration: 300 }); // Зум после перемещения
        setTimeout(() => { // Задержка для завершения анимации
            if (confirm("Добавить эту точку в маршрут?")) {
                map.geoObjects.remove(tempMarker);
                tempMarker = null;
                addPoint(coords);
                document.getElementById("pointInput").value = ""; // Очищаем поле ввода
            } else {
                map.geoObjects.remove(tempMarker);
                tempMarker = null;
            }
        }, 300); // Задержка синхронизирована с анимацией зума
    });
}